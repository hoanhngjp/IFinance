from pydantic import BaseModel, Field, field_validator
from typing import Optional, Dict, Any, List
from datetime import date, datetime
from decimal import Decimal
from app.models.enums import TransactionType


class TransactionBase(BaseModel):
    wallet_id: int
    category_id: int
    amount: Decimal = Field(..., gt=0, description="Số tiền giao dịch (luôn dương)")
    date: date
    transaction_type: TransactionType
    note: Optional[str] = None
    ocr_data: Optional[Dict[str, Any]] = None
    creditor_name: Optional[str] = Field(None, description="Tên Nợ/Chủ Nợ để tích hợp Import Hàng loạt (Debts)")
    new_category_name: Optional[str] = Field(None, description="Tên danh mục mới nếu cần khởi tạo tự động trong Bulk Import")
    new_wallet_name: Optional[str] = Field(None, description="Tên ví mới cần khởi tạo tự động")

    @field_validator('date', mode='before')
    @classmethod
    def parse_datetime_to_date(cls, v):
        if isinstance(v, datetime):
            return v.date()
        return v


class TransactionCreate(TransactionBase):
    pass


class TransactionResponse(TransactionBase):
    transaction_id: int
    user_id: int

    class Config:
        from_attributes = True


# ==========================================
# CẤU TRÚC PHÂN TRANG (PAGINATION)
# ==========================================
class TransactionPaginationData(BaseModel):
    items: List[TransactionResponse]
    total: int
    page: int
    size: int


class TransactionListResponse(BaseModel):
    status: str
    data: TransactionPaginationData


# ==========================================
# CÁC SCHEMA KHÁC
# ==========================================
class TransactionTransfer(BaseModel):
    source_wallet_id: int = Field(..., description="ID của ví bị trừ tiền")
    dest_wallet_id: int = Field(..., description="ID của ví được cộng tiền")
    amount: Decimal = Field(..., gt=0, description="Số tiền cần chuyển (phải > 0)")
    note: Optional[str] = "Chuyển tiền nội bộ"
    date: date


class TransactionUpdate(BaseModel):
    amount: Optional[Decimal] = Field(None, gt=0, description="Số tiền cập nhật (nếu có, phải lớn hơn 0)")
    category_id: Optional[int] = None
    note: Optional[str] = None
    date: Optional[date] = None