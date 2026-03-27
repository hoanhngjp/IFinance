from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import Optional
from datetime import date

from app.db.database import get_db
from app.models.wallet_category import Wallet, Category
from app.models.transaction import Transaction
from app.models.user import User
from app.models.enums import TransactionType
from app.schemas.transaction import TransactionCreate, TransactionResponse, TransactionListResponse, TransactionTransfer
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
        limit: int = Query(100, ge=1),
        type: Optional[str] = Query(None, description="Lọc: expense/income"),
        wallet_id: Optional[int] = Query(None, description="Lọc theo ID ví"),
        category_id: Optional[int] = Query(None, description="Lọc theo ID danh mục"),
        start_date: Optional[date] = Query(None, description="Từ ngày"),
        end_date: Optional[date] = Query(None, description="Đến ngày"),
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    # Khởi tạo câu query cơ bản (chỉ lấy giao dịch của user đang đăng nhập)
    query = db.query(Transaction).filter(Transaction.user_id == current_user.user_id)

    # BẮT ĐẦU ÁP DỤNG CÁC BỘ LỌC (Dựa theo API Design)
    if type:
        query = query.filter(Transaction.transaction_type == type)
    if wallet_id:
        query = query.filter(Transaction.wallet_id == wallet_id)
    if category_id:
        query = query.filter(Transaction.category_id == category_id)
    if start_date:
        query = query.filter(Transaction.date >= start_date)
    if end_date:
        query = query.filter(Transaction.date <= end_date)

    total = query.count()
    transactions = query.order_by(desc(Transaction.date), desc(Transaction.transaction_id)).offset(skip).limit(
        limit).all()

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
    tx = db.query(Transaction).filter(
        Transaction.transaction_id == transaction_id,
        Transaction.user_id == current_user.user_id
    ).first()

    if not tx:
        raise HTTPException(status_code=404, detail="Không tìm thấy giao dịch")

    # 2. Tìm ví tương ứng
    wallet = db.query(Wallet).filter(Wallet.wallet_id == tx.wallet_id).first()

    # 3. Mở Block Atomic Transaction
    try:
        # ĐẢO NGƯỢC LOGIC: Xóa chi phí -> Cộng lại tiền ví; Xóa thu nhập -> Trừ lại tiền ví
        if wallet:
            if tx.transaction_type == TransactionType.expense:
                wallet.balance += tx.amount
            elif tx.transaction_type == TransactionType.income:
                wallet.balance -= tx.amount

        # Xóa giao dịch khỏi DB
        db.delete(tx)

        # Chốt dữ liệu
        db.commit()
        return {
            "status": "success",
            "message": "Đã xóa giao dịch và hoàn lại tiền ví thành công"
        }
    except Exception as e:
        # Nếu có lỗi trong quá trình trừ tiền/xóa, rollback toàn bộ
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi hệ thống: Không thể xóa giao dịch. Error: {str(e)}")


@router.post("/transfer", response_model=dict)
def transfer_money(
        transfer_in: TransactionTransfer,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    # 1. Kiểm tra logic cơ bản
    if transfer_in.source_wallet_id == transfer_in.dest_wallet_id:
        raise HTTPException(status_code=400, detail="Không thể chuyển tiền cho cùng một ví")

    # 2. Tìm hai ví và đảm bảo nó thuộc về user này
    source_wallet = db.query(Wallet).filter(
        Wallet.wallet_id == transfer_in.source_wallet_id,
        Wallet.user_id == current_user.user_id
    ).first()

    dest_wallet = db.query(Wallet).filter(
        Wallet.wallet_id == transfer_in.dest_wallet_id,
        Wallet.user_id == current_user.user_id
    ).first()

    if not source_wallet or not dest_wallet:
        raise HTTPException(status_code=404, detail="Không tìm thấy ví nguồn hoặc ví đích")

    # 3. Kiểm tra số dư ví nguồn
    if source_wallet.balance < transfer_in.amount:
        raise HTTPException(status_code=400, detail="Ví nguồn không đủ số dư để thực hiện chuyển tiền")

    # ==========================================
    # BLOCK ATOMIC TRANSACTION (Đảm bảo an toàn dữ liệu)
    # ==========================================
    try:
        # A. Cập nhật số dư hai ví
        source_wallet.balance -= transfer_in.amount
        dest_wallet.balance += transfer_in.amount

        # B. Ghi lại 2 giao dịch lịch sử (để sau này filter thu/chi còn thấy được)
        # Giả sử category_id để None (hoặc bạn có thể tạo 1 Category "Chuyển tiền" riêng)
        tx_out = Transaction(
            user_id=current_user.user_id,
            wallet_id=source_wallet.wallet_id,
            category_id=17,
            amount=transfer_in.amount,
            transaction_type=TransactionType.expense,
            note=f"{transfer_in.note} (Tới: {dest_wallet.name})",
            date=transfer_in.date
        )

        tx_in = Transaction(
            user_id=current_user.user_id,
            wallet_id=dest_wallet.wallet_id,
            category_id=18,
            amount=transfer_in.amount,
            transaction_type=TransactionType.income,
            note=f"{transfer_in.note} (Từ: {source_wallet.name})",
            date=transfer_in.date
        )

        db.add(tx_out)
        db.add(tx_in)

        # C. Chốt tất cả lại, nếu mọi thứ từ A -> B đều trơn tru
        db.commit()
        db.refresh(tx_out)
        db.refresh(tx_in)

        return {
            "status": "success",
            "message": "Chuyển tiền thành công",
            "data": {
                "transaction_ids": [tx_out.transaction_id, tx_in.transaction_id]
            }
        }
    except Exception as e:
        # Nếu có bất kỳ lỗi gì, hủy toàn bộ thay đổi (Tiền và Giao dịch không được lưu)
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi hệ thống: {str(e)}")