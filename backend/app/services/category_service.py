from sqlalchemy.orm import Session
from app.crud.crud_category import category as crud_category
from app.models.wallet_category import Category
from app.schemas.category import CategoryCreate
from app.models.transaction import Transaction

class CategoryService:
    def create(self, db: Session, category_in: CategoryCreate, user_id: int):
        if category_in.parent_id:
            parent = crud_category.get_parent_category(db, parent_id=category_in.parent_id, user_id=user_id)
            if not parent:
                raise ValueError("Danh mục cha không tồn tại")
            if parent.type != category_in.type:
                raise ValueError("Loại danh mục con phải trùng khớp với danh mục cha")

        new_category = Category(
            user_id=user_id,
            name=category_in.name,
            type=category_in.type,
            icon=category_in.icon,
            parent_id=category_in.parent_id
        )
        db.add(new_category)
        db.commit()
        db.refresh(new_category)
        return new_category

    def get_all(self, db: Session, user_id: int):
        return crud_category.get_root_categories(db, user_id=user_id)

    def delete(self, db: Session, category_id: int, user_id: int):
        category = crud_category.get_by_id_and_user(db, category_id=category_id, user_id=user_id)
        if not category:
            raise ValueError("Không tìm thấy danh mục hoặc bạn không có quyền xóa danh mục hệ thống.")

        has_children = crud_category.count_children(db, category_id=category_id)
        if has_children > 0:
            raise ValueError("Không thể xóa vì đang có danh mục con trực thuộc.")

        has_transactions = db.query(Transaction).filter(Transaction.category_id == category_id).count()
        if has_transactions > 0:
            raise ValueError("Danh mục này đã phát sinh giao dịch. Không thể xóa để bảo toàn dữ liệu!")

        crud_category.remove(db, id=category.category_id)
        return category

category_service = CategoryService()
