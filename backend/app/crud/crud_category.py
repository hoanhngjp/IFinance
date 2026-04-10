from sqlalchemy.orm import Session
from typing import List, Optional
from app.crud.base import CRUDBase
from app.models.wallet_category import Category
from app.schemas.category import CategoryCreate

class CRUDCategory(CRUDBase[Category, CategoryCreate, CategoryCreate]):
    def get_by_id_and_user(self, db: Session, *, category_id: int, user_id: int) -> Optional[Category]:
        return db.query(Category).filter(
            Category.category_id == category_id,
            Category.user_id == user_id
        ).first()

    def get_root_categories(self, db: Session, *, user_id: int) -> List[Category]:
        return db.query(Category).filter(
            ((Category.user_id == user_id) | (Category.user_id == None)),
            Category.parent_id == None
        ).all()

    def get_parent_category(self, db: Session, *, parent_id: int, user_id: int) -> Optional[Category]:
        return db.query(Category).filter(
            Category.category_id == parent_id,
            (Category.user_id == user_id) | (Category.user_id == None)
        ).first()

    def count_children(self, db: Session, *, category_id: int) -> int:
        return db.query(Category).filter(Category.parent_id == category_id).count()

category = CRUDCategory(Category)
