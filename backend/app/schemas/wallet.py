from pydantic import BaseModel
from typing import Optional
from decimal import Decimal
from app.models.enums import WalletType

class WalletBase(BaseModel):
    name: str
    type: WalletType
    currency: Optional[str] = "VND"

class WalletCreate(WalletBase):
    pass

class WalletUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[WalletType] = None

class WalletResponse(WalletBase):
    wallet_id: int
    user_id: int
    balance: Decimal

    class Config:
        from_attributes = True