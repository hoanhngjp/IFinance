from sqlalchemy.orm import Session
from datetime import date
from decimal import Decimal
import pandas as pd

from app.crud.crud_investment import investment as crud_investment
from app.crud.crud_wallet import wallet as crud_wallet
from app.crud.crud_category import category as crud_category
from app.models.finance_modules import Investment
from app.models.wallet_category import Category
from app.models.transaction import Transaction
from app.models.enums import TransactionType
from app.schemas.investment import InvestmentCreate, InvestmentUpdateValue, InvestmentSell, InvestmentPassiveIncome

class InvestmentService:
    def get_all(self, db: Session, user_id: int):
        return crud_investment.get_all_by_user(db, user_id=user_id)

    def get_analytics(self, db: Session, user_id: int):
        investments = crud_investment.get_all_by_user(db, user_id=user_id)
        if not investments:
            return {"allocation": [], "trend": []}

        data = [{"type": inv.type.value if hasattr(inv.type, 'value') else inv.type, "current_value": float(inv.current_value)} for inv in investments]
        df = pd.DataFrame(data)

        allocation_df = df.groupby("type")["current_value"].sum().reset_index()
        total_value = allocation_df["current_value"].sum()
        allocation_df["percent"] = (allocation_df["current_value"] / total_value) * 100
        allocation_df["percent"] = allocation_df["percent"].round(2)
        allocation_data = allocation_df.to_dict("records")

        return {"allocation": allocation_data, "trend": []}

    def get_detail(self, db: Session, inv_id: int, user_id: int):
        inv = crud_investment.get_by_id_and_user(db, inv_id=inv_id, user_id=user_id)
        if not inv:
             raise ValueError("Không tìm thấy tài sản")

        transactions = db.query(Transaction).filter(
            Transaction.user_id == user_id,
            Transaction.note.ilike(f"%{inv.name}%")
        ).order_by(Transaction.date.desc()).all()

        unrealized_pnl = float(inv.current_value) - float(inv.principal_amount)
        return {
            "investment": inv,
            "transactions": transactions,
            "unrealized_pnl": unrealized_pnl
        }

    def create_investment(self, db: Session, inv_in: InvestmentCreate, user_id: int) -> Investment:
        wallet = crud_wallet.get_by_user_id(db, user_id=user_id, wallet_id=inv_in.wallet_id)
        
        fee = Decimal(str(getattr(inv_in, 'fee', 0)))
        tax = Decimal(str(getattr(inv_in, 'tax', 0)))
        principal = Decimal(str(inv_in.principal_amount))
        total_cost = principal + fee + tax

        current_balance = Decimal(str(wallet.balance or 0)) if wallet else 0

        if not wallet or current_balance < total_cost:
            raise ValueError("Ví không tồn tại hoặc không đủ số dư để chịu vốn và phí")

        cat_invest = db.query(Category).filter(Category.name == "Đầu tư tài sản", ((Category.user_id == user_id) | (Category.user_id == None))).first()
        cat_id = cat_invest.category_id if cat_invest else 28

        wallet.balance = current_balance - total_cost

        new_tx = Transaction(
            user_id=user_id,
            wallet_id=inv_in.wallet_id,
            category_id=cat_id,
            amount=total_cost,
            transaction_type=TransactionType.investment_in,
            date=getattr(inv_in, 'start_date', date.today()),
            note=f"Mua tài sản: {inv_in.name} (Vốn: {inv_in.principal_amount}, Phí/Thuế: {fee + tax})"
        )
        db.add(new_tx)

        inv_data = inv_in.model_dump(exclude={'fee', 'tax'} if hasattr(inv_in, 'fee') else None)
        new_inv = Investment(
            user_id=user_id,
            current_value=inv_in.principal_amount,
            **inv_data
        )
        db.add(new_inv)
        db.commit()
        db.refresh(new_inv)
        return new_inv

    def update_value(self, db: Session, inv_id: int, val_in: InvestmentUpdateValue, user_id: int):
        inv = crud_investment.get_by_id_and_user(db, inv_id=inv_id, user_id=user_id)
        if not inv:
             raise ValueError("Không tìm thấy tài sản")

        new_value = Decimal(str(val_in.current_value))
        if new_value < 0:
            raise ValueError("Giá trị thị trường không được âm")

        inv.current_value = new_value
        db.commit()
        
        profit = float(inv.current_value) - float(inv.principal_amount)
        roi = (profit / float(inv.principal_amount)) * 100 if inv.principal_amount > 0 else 0
        return {"current_value": float(inv.current_value), "profit": profit, "profit_percent": round(float(roi), 2)}

    def receive_passive_income(self, db: Session, inv_id: int, inc_in: InvestmentPassiveIncome, user_id: int):
        inv = crud_investment.get_by_id_and_user(db, inv_id=inv_id, user_id=user_id)
        if not inv: raise ValueError("Không tìm thấy tài sản")

        wallet = crud_wallet.get_by_user_id(db, user_id=user_id, wallet_id=inc_in.wallet_id)
        if not wallet: raise ValueError("Không tìm thấy ví nhận tiền")

        inc_amount = Decimal(str(inc_in.amount))
        wallet.balance = Decimal(str(wallet.balance or 0)) + inc_amount

        if hasattr(inv, 'total_passive_income'):
            inv.total_passive_income = Decimal(str(inv.total_passive_income or 0)) + inc_amount

        cat_profit = db.query(Category).filter(Category.name == "Lợi nhuận đầu tư").first()
        cat_id = cat_profit.category_id if cat_profit else 29

        new_tx = Transaction(
            user_id=user_id,
            wallet_id=inc_in.wallet_id,
            category_id=cat_id,
            amount=inc_amount,
            transaction_type=TransactionType.investment_return,
            date=getattr(inc_in, 'date', date.today()),
            note=inc_in.description or f"Nhận lãi/cổ tức từ: {inv.name}"
        )
        db.add(new_tx)
        db.commit()

        return {"transaction_id": new_tx.transaction_id, "total_passive": float(getattr(inv, 'total_passive_income', inc_amount))}

    def sell(self, db: Session, inv_id: int, sell_in: InvestmentSell, user_id: int):
        inv = crud_investment.get_by_id_and_user(db, inv_id=inv_id, user_id=user_id)
        if not inv: raise ValueError("Không tìm thấy tài sản")

        wallet = crud_wallet.get_by_user_id(db, user_id=user_id, wallet_id=sell_in.wallet_id)
        if not wallet: raise ValueError("Không tìm thấy ví nhận tiền")

        fee = Decimal(str(getattr(sell_in, 'fee', 0)))
        tax = Decimal(str(getattr(sell_in, 'tax', 0)))
        selling_price = Decimal(str(sell_in.selling_price))

        net_receive = selling_price - fee - tax
        wallet.balance = Decimal(str(wallet.balance or 0)) + net_receive

        cat_profit = db.query(Category).filter(Category.name == "Lợi nhuận đầu tư", ((Category.user_id == user_id) | (Category.user_id == None))).first()
        cat_id = cat_profit.category_id if cat_profit else 29

        new_tx = Transaction(
            user_id=user_id,
            wallet_id=sell_in.wallet_id,
            category_id=cat_id,
            amount=net_receive,
            transaction_type=TransactionType.investment_return,
            date=getattr(sell_in, 'date', date.today()),
            note=getattr(sell_in, 'note', f"Bán tài sản: {inv.name} (Bán: {sell_in.selling_price}, Phí/Thuế: {fee + tax})")
        )
        db.add(new_tx)

        profit = float(net_receive) - float(inv.principal_amount)
        roi = (profit / float(inv.principal_amount)) * 100 if inv.principal_amount > 0 else 0

        db.flush()
        tx_id = new_tx.transaction_id

        crud_investment.remove(db, id=inv.investment_id)
        return {"profit": profit, "roi": round(float(roi), 2), "transaction_id": tx_id}

investment_service = InvestmentService()
