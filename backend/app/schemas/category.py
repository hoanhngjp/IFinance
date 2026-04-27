from pydantic import BaseModel
from typing import Optional, List
from app.models.enums import CategoryType

class CategoryBase(BaseModel):
    name: str
    type: CategoryType
    icon: Optional[str] = None
    parent_id: Optional[int] = None

class CategoryCreate(CategoryBase):
    pass

class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    icon: Optional[str] = None

class CategoryResponse(CategoryBase):
    category_id: int
    user_id: Optional[int] = None

    class Config:
        from_attributes = True

# Schema để trả về cây danh mục (Nested)
class CategoryTreeResponse(CategoryResponse):
    subcategories: Optional[List['CategoryTreeResponse']] = []

    class Config:
        from_attributes = True

# Bắt buộc trong Pydantic V2 để xử lý cấu trúc đệ quy (Forward Reference)
CategoryTreeResponse.model_rebuild()