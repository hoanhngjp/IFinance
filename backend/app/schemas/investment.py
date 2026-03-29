from pydantic import BaseModel, Field
from typing import Optional
from datetime import date
from decimal import Decimal
from app.models.enums import InvestmentType

class InvestmentBase(BaseModel):
    wallet_id: int
    name: str = Field(..., description="Tên tài sản (VD: Vàng SJC, Cổ phiếu FPT)")
    type: InvestmentType
    principal_amount: Decimal = Field(..., gt=0, description="Số vốn đầu tư ban đầu")
    start_date: Optional[date] = None

class InvestmentCreate(InvestmentBase):
    pass

class InvestmentUpdateValue(BaseModel):
    current_value: Decimal = Field(..., ge=0, description="Giá trị thị trường hiện tại")

class InvestmentSell(BaseModel):
    selling_price: Decimal = Field(..., ge=0, description="Giá bán thực tế")
    wallet_id: int
    date: date
    note: Optional[str] = None

class InvestmentResponse(InvestmentBase):
    investment_id: int
    user_id: int
    current_value: Optional[Decimal]

    class Config:
        from_attributes = True