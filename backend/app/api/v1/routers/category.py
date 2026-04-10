from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.db.database import get_db
from app.models.user import User
from app.schemas.category import CategoryCreate, CategoryResponse, CategoryTreeResponse
from app.api.deps import get_current_user
from app.services.category_service import category_service

router = APIRouter()

@router.post("/", response_model=dict, status_code=status.HTTP_201_CREATED)
def create_category(
        category_in: CategoryCreate,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    try:
        new_category = category_service.create(db, category_in, current_user.user_id)
        return {
            "status": "success",
            "message": "Tạo danh mục cá nhân thành công",
            "data": CategoryResponse.model_validate(new_category)
        }
    except ValueError as ve:
        status_c = 404 if "tồn tại" in str(ve) else 400
        raise HTTPException(status_code=status_c, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi hệ thống: {str(e)}")

@router.get("/", response_model=dict)
def get_categories(
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    root_categories = category_service.get_all(db, current_user.user_id)
    return {
        "status": "success",
        "data": [CategoryTreeResponse.model_validate(cat) for cat in root_categories]
    }

@router.delete("/{category_id}", response_model=dict)
def delete_category(
        category_id: int,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    try:
        category_service.delete(db, category_id, current_user.user_id)
        return {
            "status": "success",
            "message": "Đã xóa danh mục thành công"
        }
    except ValueError as ve:
        status_c = 404 if "Không tìm thấy" in str(ve) else 400
        raise HTTPException(status_code=status_c, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi hệ thống: {str(e)}")