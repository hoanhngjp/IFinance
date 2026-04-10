from sqlalchemy.orm import Session
from typing import Optional
from app.crud.base import CRUDBase
from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate

class CRUDUser(CRUDBase[User, UserCreate, UserUpdate]):
    def get_by_email(self, db: Session, *, email: str) -> Optional[User]:
        return db.query(User).filter(User.email == email).first()

    def get_by_username(self, db: Session, *, username: str) -> Optional[User]:
        return db.query(User).filter(User.username == username).first()

    def get_by_username_or_email(self, db: Session, *, identity: str) -> Optional[User]:
        return db.query(User).filter((User.username == identity) | (User.email == identity)).first()

user = CRUDUser(User)
