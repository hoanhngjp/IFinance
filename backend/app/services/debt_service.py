from sqlalchemy.orm import Session
from datetime import date
from decimal import Decimal

from app.crud.crud_debt import debt as crud_debt
from app.crud.crud_wallet import wallet as crud_wallet
from app.models.finance_modules import Debt, DebtRepayment
from app.models.transaction import Transaction
from app.models.enums import TransactionType, DebtType, WalletType
from app.schemas.debt import DebtCreate, DebtRepaymentCreate

class DebtService:
    def create_debt(self, db: Session, debt_in: DebtCreate, user_id: int) -> Debt:
        wallet = crud_wallet.get_by_user_id(db, user_id=user_id, wallet_id=debt_in.wallet_id)
        if not wallet:
            raise ValueError("Không tìm thấy ví tiền")

        current_balance = Decimal(str(wallet.balance or 0))
        loan_amount = Decimal(str(debt_in.total_amount))
        
        debt_type_val = debt_in.type.value if hasattr(debt_in.type, 'value') else debt_in.type
        wallet_type_val = wallet.type.value if hasattr(wallet.type, 'value') else wallet.type

        is_receivable = (debt_type_val == "receivable")
        is_credit_wallet = (wallet_type_val == "credit")

        if is_receivable and not is_credit_wallet:
            if current_balance < loan_amount:
                raise ValueError(f"Ví không đủ số dư để cho vay. Số dư hiện tại chỉ còn {current_balance:,.0f}đ")

        new_debt = Debt(
            user_id=user_id,
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
            user_id=user_id,
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
        return new_debt

    def get_all(self, db: Session, user_id: int, status: str = None):
        active_only = (status == "active")
        return crud_debt.get_all_by_user(db, user_id=user_id, active_only=active_only)

    def get_repayments(self, db: Session, debt_id: int, user_id: int):
        debt_obj = crud_debt.get_by_id_and_user(db, debt_id=debt_id, user_id=user_id)
        if not debt_obj:
            raise ValueError("Không tìm thấy khoản nợ")

        repayments = db.query(
            DebtRepayment.repayment_id,
            DebtRepayment.amount,
            DebtRepayment.date,
            Transaction.note
        ).join(Transaction, DebtRepayment.transaction_id == Transaction.transaction_id) \
         .filter(DebtRepayment.debt_id == debt_id) \
         .order_by(DebtRepayment.date.desc()).all()

        return [
            {"repayment_id": r.repayment_id, "amount": float(r.amount), "date": r.date, "note": r.note}
            for r in repayments
        ]

    def repay_debt(self, db: Session, debt_id: int, repay_in: DebtRepaymentCreate, user_id: int):
        debt_obj = crud_debt.get_by_id_and_user(db, debt_id=debt_id, user_id=user_id)
        if not debt_obj:
            raise ValueError("Không tìm thấy khoản nợ")

        current_remaining = Decimal(str(debt_obj.remaining_amount or 0))
        repay_amount = Decimal(str(repay_in.amount))

        if current_remaining == 0:
            raise ValueError("Khoản nợ này đã được thanh toán xong")
        if repay_amount > current_remaining:
            raise ValueError(f"Số tiền trả không được lớn hơn số nợ còn lại ({current_remaining:,.0f}đ)")

        wallet = crud_wallet.get_by_user_id(db, user_id=user_id, wallet_id=repay_in.wallet_id)
        if not wallet:
            raise ValueError("Không tìm thấy ví tiền")

        current_balance = Decimal(str(wallet.balance or 0))

        debt_type_val = debt_obj.type.value if hasattr(debt_obj.type, 'value') else debt_obj.type
        wallet_type_val = wallet.type.value if hasattr(wallet.type, 'value') else wallet.type

        is_payable = (debt_type_val == "payable")
        is_credit_wallet = (wallet_type_val == "credit")

        if is_payable and not is_credit_wallet:
            if current_balance < repay_amount:
                raise ValueError(f"Ví không đủ số dư để trả nợ. Số dư hiện tại chỉ còn {current_balance:,.0f}đ")

        debt_obj.remaining_amount = current_remaining - repay_amount
        tx_type = TransactionType.expense if is_payable else TransactionType.income
        
        tx = Transaction(
            user_id=user_id,
            wallet_id=repay_in.wallet_id,
            category_id=repay_in.category_id,
            amount=repay_in.amount,
            date=repay_in.date,
            transaction_type=tx_type,
            note=repay_in.note or f"Trả nợ cho: {debt_obj.creditor_name}"
        )
        db.add(tx)
        db.flush()

        repayment_record = DebtRepayment(
            debt_id=debt_obj.debt_id,
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
        return True

debt_service = DebtService()
