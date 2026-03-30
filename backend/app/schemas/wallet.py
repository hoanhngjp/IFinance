from pydantic import BaseModel
from typing import Optional
from decimal import Decimal
from app.models.enums import WalletType

class WalletBase(BaseModel):
    name: str
    type: WalletType
    currency: Optional[str] = "VND"
    credit_limit: Optional[float] = 0

class WalletCreate(WalletBase):
    initial_balance: Optional[float] = 0

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