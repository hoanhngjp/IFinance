from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from datetime import date
from typing import Optional
from decimal import Decimal  # Cực kỳ quan trọng để xử lý tiền tệ

from app.db.database import get_db
from app.models.wallet_category import Wallet, Category
from app.models.transaction import Transaction
from app.models.finance_modules import Debt, DebtRepayment
from app.models.user import User
from app.models.enums import TransactionType, DebtType, WalletType
from app.schemas.debt import DebtCreate, DebtResponse, DebtRepaymentCreate
from app.api.deps import get_current_user

router = APIRouter()


@router.post("/", response_model=dict, status_code=status.HTTP_201_CREATED)
def create_debt(
        debt_in: DebtCreate,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    wallet = db.query(Wallet).filter(Wallet.wallet_id == debt_in.wallet_id,
                                     Wallet.user_id == current_user.user_id).first()
    if not wallet: raise HTTPException(status_code=404, detail="Không tìm thấy ví tiền")

    # Ép kiểu an toàn
    current_balance = Decimal(str(wallet.balance or 0))
    loan_amount = Decimal(str(debt_in.total_amount))

    # Lấy giá trị chuỗi thuần túy từ Enum để loại bỏ mọi lỗi so sánh
    debt_type_val = debt_in.type.value if hasattr(debt_in.type, 'value') else debt_in.type
    wallet_type_val = wallet.type.value if hasattr(wallet.type, 'value') else wallet.type

    is_receivable = (debt_type_val == "receivable")
    is_credit_wallet = (wallet_type_val == "credit")

    if is_receivable and not is_credit_wallet:
        if current_balance < loan_amount:
            raise HTTPException(
                status_code=400,
                detail=f"Ví không đủ số dư để cho vay. Số dư hiện tại chỉ còn {current_balance:,.0f}đ"
            )

    try:
        new_debt = Debt(
            user_id=current_user.user_id,
            creditor_name=debt_in.creditor_name,
            type=debt_in.type,
            total_amount=debt_in.total_amount,
            remaining_amount=debt_in.total_amount,
            interest_rate=debt_in.interest_rate,
            due_date=debt_in.due_date,
            is_installment=debt_in.is_installment
        )
        db.add(new_debt)
        db.flush()

        tx_type = TransactionType.income if debt_type_val == "payable" else TransactionType.expense

        tx = Transaction(
            user_id=current_user.user_id,
            wallet_id=debt_in.wallet_id,
            category_id=debt_in.category_id,
            amount=debt_in.total_amount,
            date=date.today(),
            transaction_type=tx_type,
            note=f"Ghi nhận khoản nợ: {debt_in.creditor_name}"
        )
        db.add(tx)

        if debt_type_val == "payable":
            wallet.balance = current_balance + loan_amount
        elif debt_type_val == "receivable":
            wallet.balance = current_balance - loan_amount

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
def get_debts(
        status: Optional[str] = Query(None, description="Lọc trạng thái nợ (ví dụ: active)"),
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    query = db.query(Debt).filter(Debt.user_id == current_user.user_id)

    if status == "active":
        query = query.filter(Debt.remaining_amount > 0)

    debts = query.order_by(Debt.due_date.asc()).all()

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

    current_remaining = Decimal(str(debt.remaining_amount or 0))
    repay_amount = Decimal(str(repay_in.amount))

    if current_remaining == 0:
        raise HTTPException(status_code=400, detail="Khoản nợ này đã được thanh toán xong")
    if repay_amount > current_remaining:
        raise HTTPException(status_code=400,
                            detail=f"Số tiền trả không được lớn hơn số nợ còn lại ({current_remaining:,.0f}đ)")

    wallet = db.query(Wallet).filter(Wallet.wallet_id == repay_in.wallet_id).first()
    if not wallet: raise HTTPException(status_code=404, detail="Không tìm thấy ví tiền")

    current_balance = Decimal(str(wallet.balance or 0))

    debt_type_val = debt.type.value if hasattr(debt.type, 'value') else debt.type
    wallet_type_val = wallet.type.value if hasattr(wallet.type, 'value') else wallet.type

    is_payable = (debt_type_val == "payable")
    is_credit_wallet = (wallet_type_val == "credit")

    if is_payable and not is_credit_wallet:
        if current_balance < repay_amount:
            raise HTTPException(
                status_code=400,
                detail=f"Ví không đủ số dư để trả nợ. Số dư hiện tại chỉ còn {current_balance:,.0f}đ"
            )

    try:
        debt.remaining_amount = current_remaining - repay_amount
        tx_type = TransactionType.expense if is_payable else TransactionType.income
        tx = Transaction(
            user_id=current_user.user_id,
            wallet_id=repay_in.wallet_id,
            category_id=repay_in.category_id,
            amount=repay_in.amount,
            date=repay_in.date,
            transaction_type=tx_type,
            note=repay_in.note or f"Trả nợ cho: {debt.creditor_name}"
        )
        db.add(tx)
        db.flush()

        repayment_record = DebtRepayment(
            debt_id=debt.debt_id,
            transaction_id=tx.transaction_id,
            amount=repay_in.amount,
            date=repay_in.date
        )
        db.add(repayment_record)

        if is_payable:
            wallet.balance = current_balance - repay_amount
        elif debt_type_val == "receivable":
            wallet.balance = current_balance + repay_amount

        db.commit()
        return {"status": "success", "message": "Ghi nhận trả nợ thành công"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi hệ thống: {str(e)}")


@router.get("/{debt_id}/repayments", response_model=dict)
def get_debt_repayments(
        debt_id: int,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    debt = db.query(Debt).filter(Debt.debt_id == debt_id, Debt.user_id == current_user.user_id).first()
    if not debt:
        raise HTTPException(status_code=404, detail="Không tìm thấy khoản nợ")

    repayments = db.query(
        DebtRepayment.repayment_id,
        DebtRepayment.amount,
        DebtRepayment.date,
        Transaction.note
    ).join(Transaction, DebtRepayment.transaction_id == Transaction.transaction_id) \
        .filter(DebtRepayment.debt_id == debt_id) \
        .order_by(DebtRepayment.date.desc()).all()

    history = [
        {"repayment_id": r.repayment_id, "amount": float(r.amount), "date": r.date, "note": r.note}
        for r in repayments
    ]

    return {
        "status": "success",
        "data": history
    }