from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date
from dateutil.relativedelta import relativedelta
from app.crud.crud_subscription import subscription as crud_subscription
from app.crud.crud_wallet import wallet as crud_wallet
from app.models.finance_modules import Subscription
from app.models.wallet_category import Category
from app.models.transaction import Transaction
from app.models.enums import TransactionType
from app.schemas.subscription import SubscriptionCreate, SubscriptionUpdate

class SubscriptionService:
    def get_all(self, db: Session, user_id: int, active: bool = None):
        return crud_subscription.get_all_by_user(db, user_id=user_id, active_only=active)

    def create(self, db: Session, sub_in: SubscriptionCreate, user_id: int):
        if sub_in.next_due_date < date.today():
            raise ValueError("Ngày thanh toán tiếp theo không được nằm trong quá khứ")

        wallet = crud_wallet.get_by_user_id(db, user_id=user_id, wallet_id=sub_in.default_wallet_id)
        if not wallet:
             raise ValueError("Không tìm thấy ví thanh toán")

        new_sub = Subscription(
            user_id=user_id,
            **sub_in.model_dump()
        )
        db.add(new_sub)
        db.commit()
        db.refresh(new_sub)
        return new_sub

    def update(self, db: Session, sub_id: int, sub_in: SubscriptionUpdate, user_id: int):
        sub = crud_subscription.get_by_id_and_user(db, sub_id=sub_id, user_id=user_id)
        if not sub: raise ValueError("Không tìm thấy gói đăng ký")

        update_data = sub_in.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(sub, key, value)

        db.commit()
        return True

    def delete(self, db: Session, sub_id: int, user_id: int):
        sub = crud_subscription.get_by_id_and_user(db, sub_id=sub_id, user_id=user_id)
        if not sub: raise ValueError("Không tìm thấy gói đăng ký")

        sub.is_active = False
        sub.next_due_date = None
        db.commit()
        return True

    def detect_ai(self, db: Session, user_id: int):
        three_months_ago = date.today() - relativedelta(months=3)

        potential_subs = db.query(
            Transaction.category_id,
            Transaction.amount,
            func.count(Transaction.transaction_id).label('frequency_count'),
            func.max(Transaction.date).label('last_payment_date')
        ).filter(
            Transaction.user_id == user_id,
            Transaction.transaction_type == TransactionType.expense,
            Transaction.date >= three_months_ago
        ).group_by(
            Transaction.category_id,
            Transaction.amount
        ).having(
            func.count(Transaction.transaction_id) >= 2
        ).all()

        suggestions = []
        for sub in potential_subs:
            existing = db.query(Subscription).filter(
                Subscription.user_id == user_id,
                Subscription.amount == sub.amount,
                Subscription.category_id == sub.category_id,
                Subscription.is_active == True
            ).first()

            if not existing:
                cat = db.query(Category).filter(Category.category_id == sub.category_id).first()
                category_name = cat.name if cat else "Khác"

                latest_tx = db.query(Transaction).filter(
                    Transaction.user_id == user_id,
                    Transaction.category_id == sub.category_id,
                    Transaction.amount == sub.amount
                ).order_by(Transaction.date.desc()).first()

                note_snippet = f" (Ghi chú gần nhất: '{latest_tx.note}')" if latest_tx and latest_tx.note else ""

                suggestions.append({
                    "category_id": sub.category_id,
                    "category_name": category_name,
                    "suggested_amount": float(sub.amount),
                    "confidence_score": 0.85 if sub.frequency_count >= 3 else 0.6,
                    "message": f"Bạn đã chi {float(sub.amount):,.0f}đ cho danh mục [{category_name}]{note_snippet} lặp lại {sub.frequency_count} lần gần đây. Đây có phải là khoản đóng định kỳ không?"
                })
        return suggestions

subscription_service = SubscriptionService()
