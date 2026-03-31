from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import Optional
from datetime import date

from app.db.database import get_db
from app.models.wallet_category import Wallet, Category
from app.models.transaction import Transaction
from app.models.user import User
from app.models.enums import TransactionType, WalletType  # Đã import thêm WalletType
# Yêu cầu import thêm TransactionUpdate từ schema
from app.schemas.transaction import TransactionCreate, TransactionResponse, TransactionTransfer, TransactionUpdate
from app.api.deps import get_current_user

router = APIRouter()


@router.get("/", response_model=dict)
def get_transactions(
        page: int = Query(1, ge=1, description="Số trang hiện tại"),
        size: int = Query(20, ge=1, description="Số item trên 1 trang"),
        type: Optional[str] = Query(None, description="Lọc: expense/income"),
        wallet_id: Optional[int] = Query(None, description="Lọc theo ID ví"),
        category_id: Optional[int] = Query(None, description="Lọc theo ID danh mục"),
        start_date: Optional[date] = Query(None, description="Từ ngày"),
        end_date: Optional[date] = Query(None, description="Đến ngày"),
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    # Validate ngày tháng
    if start_date and end_date and start_date > end_date:
        raise HTTPException(status_code=400, detail="Ngày bắt đầu không được lớn hơn ngày kết thúc")

    query = db.query(Transaction).filter_by(user_id=current_user.user_id)

    # Áp dụng bộ lọc
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

    # Phân trang & Tính tổng số lượng
    total = query.count()
    offset = (page - 1) * size
    transactions = query.order_by(desc(Transaction.date), desc(Transaction.transaction_id)).offset(offset).limit(
        size).all()

    # Trả về chuẩn format API Design với object data bọc ngoài
    return {
        "status": "success",
        "data": {
            "items": [TransactionResponse.model_validate(tx) for tx in transactions],
            "total": total,
            "page": page,
            "size": size
        }
    }


@router.post("/", response_model=dict, status_code=status.HTTP_201_CREATED)
def create_transaction(
        tx_in: TransactionCreate,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    wallet = db.query(Wallet).filter_by(wallet_id=tx_in.wallet_id, user_id=current_user.user_id).first()
    if not wallet:
        raise HTTPException(status_code=404, detail="Không tìm thấy ví tiền")

    # Xử lý Logic tìm Category (Của hệ thống hoặc của User)
    category = db.query(Category).filter(
        Category.category_id == tx_in.category_id,
        (Category.user_id == current_user.user_id) | Category.user_id.is_(None)
    ).first()

    if not category:
        raise HTTPException(status_code=404, detail="Không tìm thấy danh mục")

    # Kiểm tra số dư đối với ví Tiền mặt / Ngân hàng (Ví Tín dụng được phép âm tiền)
    if tx_in.transaction_type == TransactionType.expense and wallet.type != WalletType.credit:
        if wallet.balance < tx_in.amount:
            raise HTTPException(status_code=400, detail="Ví nguồn không đủ số dư để chi tiêu")

    try:
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

        # Cập nhật balance
        if tx_in.transaction_type == TransactionType.expense:
            wallet.balance -= tx_in.amount
        elif tx_in.transaction_type == TransactionType.income:
            wallet.balance += tx_in.amount

        db.commit()
        db.refresh(new_tx)

        return {
            "status": "success",
            "message": "Ghi nhận giao dịch thành công",
            "data": TransactionResponse.model_validate(new_tx)
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi hệ thống: Không thể xử lý giao dịch. Error: {str(e)}")


@router.put("/{transaction_id}", response_model=dict)
def update_transaction(
        transaction_id: int,
        tx_in: TransactionUpdate,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    tx = db.query(Transaction).filter_by(transaction_id=transaction_id, user_id=current_user.user_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Không tìm thấy giao dịch")

    wallet = db.query(Wallet).filter_by(wallet_id=tx.wallet_id).first()

    try:
        # BƯỚC 1: Hoàn lại (Revert) số dư cũ vào ví
        if tx.transaction_type == TransactionType.expense:
            wallet.balance += tx.amount
        elif tx.transaction_type == TransactionType.income:
            wallet.balance -= tx.amount

        # BƯỚC 2: Cập nhật thông tin mới vào giao dịch
        if tx_in.amount is not None:
            tx.amount = tx_in.amount
        if tx_in.category_id is not None:
            tx.category_id = tx_in.category_id
        if tx_in.note is not None:
            tx.note = tx_in.note
        if tx_in.date is not None:
            tx.date = tx_in.date

        # BƯỚC 3: Trừ/Cộng tiền dựa trên số tiền mới
        if tx.transaction_type == TransactionType.expense:
            wallet.balance -= tx.amount
        elif tx.transaction_type == TransactionType.income:
            wallet.balance += tx.amount

        # BƯỚC 4: Kiểm tra Validation chặn âm tiền (Ví thường không được âm)
        if wallet.type != WalletType.credit and wallet.balance < 0:
            # Chủ động ném lỗi Value Error để nhảy vào khối except bên dưới
            raise ValueError("Số dư ví không đủ để cập nhật giao dịch này (ví sẽ bị âm).")

        db.commit()
        db.refresh(tx)

        return {
            "status": "success",
            "message": "Cập nhật giao dịch thành công",
            "data": TransactionResponse.model_validate(tx)
        }
    except ValueError as ve:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi hệ thống: {str(e)}")


@router.delete("/{transaction_id}", response_model=dict)
def delete_transaction(
        transaction_id: int,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    tx = db.query(Transaction).filter_by(transaction_id=transaction_id, user_id=current_user.user_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Không tìm thấy giao dịch")

    wallet = db.query(Wallet).filter_by(wallet_id=tx.wallet_id).first()

    try:
        if wallet:
            # Revert logic
            if tx.transaction_type == TransactionType.expense:
                wallet.balance += tx.amount
            elif tx.transaction_type == TransactionType.income:
                wallet.balance -= tx.amount

            # Kiểm tra âm tiền khi xóa Thu nhập
            if wallet.type != WalletType.credit and wallet.balance < 0:
                raise ValueError("Không thể xóa khoản thu này vì số dư ví hiện tại không đủ để hoàn lại (ví sẽ bị âm).")

        db.delete(tx)
        db.commit()

        return {
            "status": "success",
            "message": "Đã xóa giao dịch và hoàn lại tiền ví thành công"
        }
    except ValueError as ve:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi hệ thống: Không thể xóa giao dịch. Error: {str(e)}")


@router.post("/transfer", response_model=dict)
def transfer_money(
        transfer_in: TransactionTransfer,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    if transfer_in.source_wallet_id == transfer_in.dest_wallet_id:
        raise HTTPException(status_code=400, detail="Không thể chuyển tiền cho cùng một ví")

    source_wallet = db.query(Wallet).filter_by(wallet_id=transfer_in.source_wallet_id,
                                               user_id=current_user.user_id).first()
    dest_wallet = db.query(Wallet).filter_by(wallet_id=transfer_in.dest_wallet_id, user_id=current_user.user_id).first()

    if not source_wallet or not dest_wallet:
        raise HTTPException(status_code=404, detail="Không tìm thấy ví nguồn hoặc ví đích")

    # Thẻ tín dụng được phép âm tiền, chỉ chặn ví thường
    if source_wallet.type != WalletType.credit and source_wallet.balance < transfer_in.amount:
        raise HTTPException(status_code=400, detail="Ví nguồn không đủ số dư để thực hiện chuyển tiền")

    try:
        source_wallet.balance -= transfer_in.amount
        dest_wallet.balance += transfer_in.amount

        # ID 17, 18 là giả định, bạn nên đảm bảo DB có danh mục "Chuyển tiền" (Expense/Income)
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

        db.commit()

        return {
            "status": "success",
            "message": "Chuyển tiền thành công",
            "data": {
                "transaction_ids": [tx_out.transaction_id, tx_in.transaction_id]
            }
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi hệ thống: {str(e)}")