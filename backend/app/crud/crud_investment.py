from sqlalchemy.orm import Session
from typing import List, Optional
from app.crud.base import CRUDBase
from app.models.finance_modules import Investment
from app.schemas.investment import InvestmentCreate, InvestmentUpdateValue

class CRUDInvestment(CRUDBase[Investment, InvestmentCreate, InvestmentUpdateValue]):
    def get_by_id_and_user(self, db: Session, *, inv_id: int, user_id: int) -> Optional[Investment]:
        return db.query(Investment).filter(
            Investment.investment_id == inv_id, 
            Investment.user_id == user_id
        ).first()

    def get_all_by_user(self, db: Session, *, user_id: int) -> List[Investment]:
        return db.query(Investment).filter(Investment.user_id == user_id)\
                   .order_by(Investment.start_date.desc()).all()

investment = CRUDInvestment(Investment)
