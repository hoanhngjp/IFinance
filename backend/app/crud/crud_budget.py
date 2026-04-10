from sqlalchemy.orm import Session
from typing import Optional
from app.crud.base import CRUDBase
from app.models.finance_modules import Budget
from app.schemas.budget import BudgetCreate

class CRUDBudget(CRUDBase[Budget, BudgetCreate, BudgetCreate]):
    def get_by_id_and_user(self, db: Session, *, budget_id: int, user_id: int) -> Optional[Budget]:
        return db.query(Budget).filter(
            Budget.budget_id == budget_id, 
            Budget.user_id == user_id
        ).first()

budget = CRUDBudget(Budget)
