from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import date

from app.db.database import get_db
from app.models.wallet_category import Wallet, Category
from app.models.transaction import Transaction
from app.models.finance_modules import Debt, DebtRepayment
from app.models.user import User
from app.models.enums import TransactionType, DebtType
from app.schemas.debt import DebtCreate, DebtResponse, DebtRepaymentCreate
from app.api.deps import get_current_user

router = APIRouter()

@router.post("/", response_model=dict, status_code=status.HTTP_201_CREATED)
def create_debt(
    debt_in: DebtCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    wallet = db.query(Wallet).filter(Wallet.wallet_id == debt_in.wallet_id, Wallet.user_id == current_user.user_id).first()
    if not wallet: raise HTTPException(status_code=404, detail="Không tìm thấy ví tiền")

    try:
        # 1. Tạo khoản nợ trong bảng Debts
        new_debt = Debt(
            user_id=current_user.user_id,
            creditor_name=debt_in.creditor_name,
            type=debt_in.type,
            total_amount=debt_in.total_amount,
            remaining_amount=debt_in.total_amount, # Mới tạo thì nợ còn lại = tổng nợ
            interest_rate=debt_in.interest_rate,
            due_date=debt_in.due_date,
            is_installment=debt_in.is_installment
        )
        db.add(new_debt)
        db.flush() # Lấy debt_id ngay lập tức mà chưa commit

        # 2. Tạo giao dịch (Transaction) tương ứng
        tx = Transaction(
            user_id=current_user.user_id,
            wallet_id=debt_in.wallet_id,
            category_id=debt_in.category_id,
            amount=debt_in.total_amount,
            date=date.today(),
            transaction_type=TransactionType.debt_loan,
            note=f"Ghi nhận khoản nợ: {debt_in.creditor_name}"
        )
        db.add(tx)

        # 3. Cập nhật số dư Ví
        if debt_in.type == DebtType.payable: # Đi vay -> Nhận tiền vào ví
            wallet.balance += debt_in.total_amount
        elif debt_in.type == DebtType.receivable: # Cho vay -> Trừ tiền từ ví
            wallet.balance -= debt_in.total_amount

        db.commit()
        db.refresh(new_debt)

        return {
            "status": "success",
            "message": "Tạo khoản nợ và ghi nhận dòng tiền thành công",
            "data": DebtResponse.model_validate(new_debt)
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi hệ thống: {str(e)}")


@router.get("/", response_model=dict)
def get_debts(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    debts = db.query(Debt).filter(Debt.user_id == current_user.user_id).all()
    return {
        "status": "success",
        "data": [DebtResponse.model_validate(d) for d in debts]
    }


@router.post("/{debt_id}/repay", response_model=dict)
def repay_debt(
    debt_id: int,
    repay_in: DebtRepaymentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    debt = db.query(Debt).filter(Debt.debt_id == debt_id, Debt.user_id == current_user.user_id).first()
    if not debt: raise HTTPException(status_code=404, detail="Không tìm thấy khoản nợ")
    if debt.remaining_amount == 0:
        raise HTTPException(status_code=400, detail="Khoản nợ này đã được thanh toán xong")
    if repay_in.amount > debt.remaining_amount:
        raise HTTPException(status_code=400, detail="Số tiền trả không được lớn hơn số nợ còn lại")

    wallet = db.query(Wallet).filter(Wallet.wallet_id == repay_in.wallet_id).first()
    if not wallet: raise HTTPException(status_code=404, detail="Không tìm thấy ví tiền")

    try:
        # 1. Cập nhật số nợ còn lại
        debt.remaining_amount -= repay_in.amount

        # 2. Tạo Transaction (Dòng tiền thực tế)
        tx = Transaction(
            user_id=current_user.user_id,
            wallet_id=repay_in.wallet_id,
            category_id=repay_in.category_id,
            amount=repay_in.amount,
            date=repay_in.date,
            transaction_type=TransactionType.debt_repayment,
            note=repay_in.note or f"Trả nợ cho: {debt.creditor_name}"
        )
        db.add(tx)
        db.flush()

        # 3. Tạo record trong Debt_Repayments (Lịch sử trả nợ)
        repayment_record = DebtRepayment(
            debt_id=debt.debt_id,
            transaction_id=tx.transaction_id,
            amount=repay_in.amount,
            date=repay_in.date
        )
        db.add(repayment_record)

        # 4. Cập nhật số dư Ví
        if debt.type == DebtType.payable: # Trả nợ mình đã vay -> Trừ tiền ví
            wallet.balance -= repay_in.amount
        elif debt.type == DebtType.receivable: # Người khác trả nợ cho mình -> Cộng tiền ví
            wallet.balance += repay_in.amount

        db.commit()
        return {"status": "success", "message": "Ghi nhận trả nợ thành công"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi hệ thống: {str(e)}")