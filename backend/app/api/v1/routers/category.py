from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.db.database import get_db
from app.models.wallet_category import Category
from app.models.user import User
from app.schemas.category import CategoryCreate, CategoryResponse, CategoryTreeResponse
from app.api.deps import get_current_user

router = APIRouter()


@router.post("/", response_model=dict, status_code=status.HTTP_201_CREATED)
def create_category(
        category_in: CategoryCreate,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    # Nếu truyền parent_id, kiểm tra xem danh mục cha có tồn tại không
    if category_in.parent_id:
        parent = db.query(Category).filter(
            Category.category_id == category_in.parent_id,
            (Category.user_id == current_user.user_id) | (Category.user_id == None)
        ).first()
        if not parent:
            raise HTTPException(status_code=404, detail="Danh mục cha không tồn tại")

    new_category = Category(
        user_id=current_user.user_id,
        name=category_in.name,
        type=category_in.type,
        icon=category_in.icon,
        parent_id=category_in.parent_id
    )
    db.add(new_category)
    db.commit()
    db.refresh(new_category)

    return {
        "status": "success",
        "message": "Tạo danh mục cá nhân thành công",
        "data": CategoryResponse.model_validate(new_category)
    }


@router.get("/", response_model=dict)
def get_categories(
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    # CHỈ lấy các danh mục GỐC (parent_id == None)
    root_categories = db.query(Category).filter(
        ((Category.user_id == current_user.user_id) | (Category.user_id == None)),
        Category.parent_id == None
    ).all()

    # model_validate sẽ tự động đệ quy tìm các subcategories dựa vào relationship trong DB
    return {
        "status": "success",
        "data": [CategoryTreeResponse.model_validate(cat) for cat in root_categories]
    }