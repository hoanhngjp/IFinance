from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import date
from decimal import Decimal
from app.models.enums import TransactionType

class TransactionBase(BaseModel):
    wallet_id: int
    category_id: int
    # Ràng buộc amount luôn phải lớn hơn 0
    amount: Decimal = Field(..., gt=0, description="Số tiền giao dịch (luôn dương)")
    date: date
    transaction_type: TransactionType
    note: Optional[str] = None
    ocr_data: Optional[Dict[str, Any]] = None

class TransactionCreate(TransactionBase):
    pass

class TransactionResponse(TransactionBase):
    transaction_id: int
    user_id: int

    class Config:
        from_attributes = True

# Schema hỗ trợ phân trang
class TransactionListResponse(BaseModel):
    status: str
    total: int
    data: list[TransactionResponse]