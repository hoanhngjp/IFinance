from sqlalchemy.orm import Session
from typing import List, Optional
from app.crud.base import CRUDBase
from app.models.wallet_category import Wallet
from app.schemas.wallet import WalletCreate, WalletUpdate

class CRUDWallet(CRUDBase[Wallet, WalletCreate, WalletUpdate]):
    def get_by_user_id(self, db: Session, *, user_id: int, wallet_id: int) -> Optional[Wallet]:
        return db.query(Wallet).filter_by(
            wallet_id=wallet_id,
            user_id=user_id,
            is_active=True
        ).first()

    def get_active_wallets_by_user(self, db: Session, *, user_id: int) -> List[Wallet]:
        return db.query(Wallet).filter_by(
            user_id=user_id,
            is_active=True
        ).all()

wallet = CRUDWallet(Wallet)
