from pydantic import BaseModel, Field, field_validator
from typing import Optional
from datetime import date, timedelta
from decimal import Decimal
from app.models.enums import DebtType

# Schema cho Tạo Khoản Nợ mới
class DebtCreate(BaseModel):
    creditor_name: str = Field(..., description="Tên người vay/cho vay hoặc tên khoản nợ")
    type: DebtType
    total_amount: Decimal = Field(..., gt=0, description="Tổng số tiền vay/nợ")
    interest_rate: Optional[float] = 0.0
    due_date: Optional[date] = None
    is_installment: Optional[bool] = False

    # 2 trường này dùng để tự động tạo Giao dịch (Transaction) ban đầu
    wallet_id: int
    category_id: int

    @field_validator('due_date', mode='after')
    @classmethod
    def validate_due_date_not_in_past(cls, v):
        # Buffer 1 ngày để tránh user bị lỗi oan do lệch timezone UTC vs UTC+7
        if v is not None and v < date.today() - timedelta(days=1):
            raise ValueError("Ngày đến hạn (due_date) không được là ngày trong quá khứ")
        return v

# Schema cho Output Khoản Nợ
class DebtResponse(BaseModel):
    debt_id: int
    user_id: int
    creditor_name: str
    type: DebtType
    total_amount: Decimal
    remaining_amount: Decimal
    interest_rate: Optional[float]
    due_date: Optional[date]
    is_installment: Optional[bool]

    class Config:
        from_attributes = True

# Schema cho việc Trả Nợ (Repayment)
class DebtRepaymentCreate(BaseModel):
    amount: Decimal = Field(..., gt=0, description="Số tiền trả đợt này")
    wallet_id: int
    category_id: int
    date: date
    note: Optional[str] = None