from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.db.database import get_db
from app.models.wallet_category import Category
from app.models.user import User
from app.schemas.category import CategoryCreate, CategoryResponse, CategoryTreeResponse
from app.models.transaction import Transaction
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

        if parent.type != category_in.type:
            raise HTTPException(status_code=400, detail="Loại danh mục con phải trùng khớp với danh mục cha")
        
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


@router.delete("/{category_id}", response_model=dict)
def delete_category(
        category_id: int,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    # 1. Tìm danh mục (Chỉ tìm những danh mục do chính user này tạo ra)
    category = db.query(Category).filter(
        Category.category_id == category_id,
        Category.user_id == current_user.user_id  # Đảm bảo không xóa nhầm danh mục hệ thống (user_id = None)
    ).first()

    if not category:
        raise HTTPException(status_code=404,
                            detail="Không tìm thấy danh mục hoặc bạn không có quyền xóa danh mục hệ thống.")

    # 2. Kiểm tra Khóa ngoại (Xem có giao dịch nào đang xài danh mục này không)
    # Bao gồm cả việc kiểm tra xem nó có đang là danh mục cha của các danh mục con khác không

    # Ktra danh mục con
    has_children = db.query(Category).filter(Category.parent_id == category_id).count()
    if has_children > 0:
        raise HTTPException(status_code=400, detail="Không thể xóa vì đang có danh mục con trực thuộc.")

    # Ktra giao dịch
    has_transactions = db.query(Transaction).filter(Transaction.category_id == category_id).count()
    if has_transactions > 0:
        raise HTTPException(status_code=400,
                            detail="Danh mục này đã phát sinh giao dịch. Không thể xóa để bảo toàn dữ liệu!")

    # 3. An toàn để xóa
    try:
        db.delete(category)
        db.commit()
        return {
            "status": "success",
            "message": "Đã xóa danh mục thành công"
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi hệ thống: {str(e)}")