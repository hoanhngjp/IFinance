from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.db.database import get_db
from app.models.wallet_category import Wallet, Category
from app.models.transaction import Transaction
from app.models.user import User
from app.models.enums import TransactionType
from app.schemas.transaction import TransactionCreate, TransactionResponse, TransactionListResponse
from app.api.deps import get_current_user

router = APIRouter()


@router.post("/", response_model=dict, status_code=status.HTTP_201_CREATED)
def create_transaction(
        tx_in: TransactionCreate,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    # 1. Kiểm tra Ví có tồn tại và thuộc về User không
    wallet = db.query(Wallet).filter(Wallet.wallet_id == tx_in.wallet_id,
                                     Wallet.user_id == current_user.user_id).first()
    if not wallet:
        raise HTTPException(status_code=404, detail="Không tìm thấy ví tiền")

    # 2. Kiểm tra Danh mục có hợp lệ không (Danh mục hệ thống hoặc của riêng User)
    category = db.query(Category).filter(
        Category.category_id == tx_in.category_id,
        (Category.user_id == current_user.user_id) | (Category.user_id == None)
    ).first()
    if not category:
        raise HTTPException(status_code=404, detail="Không tìm thấy danh mục")

    # 3. Mở Block Atomic Transaction (Bắt lỗi và Rollback)
    try:
        # Bước 3.1: Ghi nhận giao dịch vào bảng Transactions
        new_tx = Transaction(
            user_id=current_user.user_id,
            wallet_id=tx_in.wallet_id,
            category_id=tx_in.category_id,
            amount=tx_in.amount,
            date=tx_in.date,
            transaction_type=tx_in.transaction_type,
            note=tx_in.note,
            ocr_data=tx_in.ocr_data
        )
        db.add(new_tx)

        # Bước 3.2: Cập nhật số dư trong bảng Wallets
        if tx_in.transaction_type == TransactionType.expense:
            wallet.balance -= tx_in.amount
        elif tx_in.transaction_type == TransactionType.income:
            wallet.balance += tx_in.amount
        # Tương lai có thể mở rộng xử lý cho type: debt_loan, investment...

        # Bước 3.3: Chốt dữ liệu
        db.commit()
        db.refresh(new_tx)

        return {
            "status": "success",
            "message": "Ghi nhận giao dịch thành công",
            "data": TransactionResponse.model_validate(new_tx)
        }

    except Exception as e:
        # NẾU CÓ BẤT KỲ LỖI NÀO BÊN TRONG BLOCK NÀY, HỦY BỎ TẤT CẢ (Kể cả tiền ví)
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi hệ thống: Không thể xử lý giao dịch. Error: {str(e)}")


@router.get("/", response_model=TransactionListResponse)
def get_transactions(
        skip: int = Query(0, ge=0),
        limit: int = Query(50, ge=1, le=100),
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    # Lấy danh sách giao dịch, sắp xếp mới nhất lên đầu
    query = db.query(Transaction).filter(Transaction.user_id == current_user.user_id)
    total = query.count()
    transactions = query.order_by(desc(Transaction.date), desc(Transaction.transaction_id)).offset(
        skip).limit(limit).all()

    return {
        "status": "success",
        "total": total,
        "data": [TransactionResponse.model_validate(tx) for tx in transactions]
    }


@router.delete("/{transaction_id}", response_model=dict)
def delete_transaction(
        transaction_id: int,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    # 1. Tìm giao dịch
    tx = db.query(Transaction).filter(Transaction.transaction_id == transaction_id,
                                      Transaction.user_id == current_user.user_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Không tìm thấy giao dịch")

    # 2. Tìm ví tương ứng
    wallet = db.query(Wallet).filter(Wallet.wallet_id == tx.wallet_id).first()

    try:
        # ĐẢO NGƯỢC LOGIC: Xóa chi phí -> Cộng lại tiền ví; Xóa thu nhập -> Trừ lại tiền ví
        if wallet:
            if tx.transaction_type == TransactionType.expense:
                wallet.balance += tx.amount
            elif tx.transaction_type == TransactionType.income:
                wallet.balance -= tx.amount

        db.delete(tx)
        db.commit()
        return {"status": "success", "message": "Đã xóa giao dịch và hoàn lại tiền ví"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Không thể xóa giao dịch")