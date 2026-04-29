from pydantic import BaseModel, Field, model_validator
from typing import Optional
from decimal import Decimal
from app.models.enums import WalletType

class WalletBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    type: WalletType
    currency: Optional[str] = "VND"
    credit_limit: Optional[float] = 0

class WalletCreate(WalletBase):
    initial_balance: Optional[float] = 0

    @model_validator(mode='after')
    def check_credit_limit(self):
        if self.type == WalletType.credit and (self.credit_limit is None or self.credit_limit <= 0):
            raise ValueError("Ví tín dụng (credit) bắt buộc phải có hạn mức tín dụng (credit_limit > 0)")
        return self

class WalletUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[WalletType] = None
    credit_limit: Optional[float] = None

class WalletResponse(WalletBase):
    wallet_id: int
    user_id: int
    balance: Decimal
    is_active: bool

    class Config:
        from_attributes = True