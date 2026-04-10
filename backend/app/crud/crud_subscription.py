from sqlalchemy.orm import Session
from typing import List, Optional
from app.crud.base import CRUDBase
from app.models.finance_modules import Subscription
from app.schemas.subscription import SubscriptionCreate, SubscriptionUpdate

class CRUDSubscription(CRUDBase[Subscription, SubscriptionCreate, SubscriptionUpdate]):
    def get_by_id_and_user(self, db: Session, *, sub_id: int, user_id: int) -> Optional[Subscription]:
        return db.query(Subscription).filter(
            Subscription.subscription_id == sub_id, 
            Subscription.user_id == user_id
        ).first()

    def get_all_by_user(self, db: Session, *, user_id: int, active_only: Optional[bool] = None) -> List[Subscription]:
        query = db.query(Subscription).filter(Subscription.user_id == user_id)
        if active_only is not None:
             query = query.filter(Subscription.is_active == active_only)
        return query.order_by(Subscription.next_due_date.asc()).all()

subscription = CRUDSubscription(Subscription)
