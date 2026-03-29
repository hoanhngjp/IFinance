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
    fee: Optional[Decimal] = Field(0, ge=0, description="Phí giao dịch mua")
    tax: Optional[Decimal] = Field(0, ge=0, description="Thuế giao dịch mua")

class InvestmentUpdateValue(BaseModel):
    current_value: Decimal = Field(..., ge=0, description="Giá trị thị trường hiện tại")

class InvestmentSell(BaseModel):
    selling_price: Decimal = Field(..., ge=0, description="Giá bán thực tế")
    wallet_id: int
    date: date
    fee: Optional[Decimal] = Field(0, ge=0, description="Phí giao dịch bán")
    tax: Optional[Decimal] = Field(0, ge=0, description="Thuế giao dịch bán")
    note: Optional[str] = None

class InvestmentPassiveIncome(BaseModel):
    amount: Decimal = Field(..., gt=0, description="Số tiền nhận được (Cổ tức/Lãi)")
    wallet_id: int
    date: Optional[date] = None
    description: Optional[str] = Field(None, description="Mô tả khoản thu nhập")

class InvestmentResponse(InvestmentBase):
    investment_id: int
    user_id: int
    current_value: Optional[Decimal]
    total_passive_income: Optional[Decimal]

    class Config:
        from_attributes = True