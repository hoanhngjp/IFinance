from sqlalchemy.orm import Session
from typing import List, Optional
from app.crud.base import CRUDBase
from app.models.finance_modules import Debt
from app.schemas.debt import DebtCreate, DebtCreate  # Placeholder for update

class CRUDDebt(CRUDBase[Debt, DebtCreate, DebtCreate]):
    def get_by_id_and_user(self, db: Session, *, debt_id: int, user_id: int) -> Optional[Debt]:
        return db.query(Debt).filter(
            Debt.debt_id == debt_id, 
            Debt.user_id == user_id
        ).first()

    def get_all_by_user(self, db: Session, *, user_id: int, active_only: bool = False) -> List[Debt]:
        query = db.query(Debt).filter(Debt.user_id == user_id)
        if active_only:
            query = query.filter(Debt.remaining_amount > 0)
        return query.order_by(Debt.due_date.asc()).all()

debt = CRUDDebt(Debt)
