from pydantic import BaseModel, Field
from typing import Optional
from datetime import date
from decimal import Decimal
from app.models.enums import FrequencyType

class SubscriptionBase(BaseModel):
    name: str = Field(..., description="Tên dịch vụ (VD: Netflix, Spotify)")
    amount: Decimal = Field(..., gt=0)
    frequency: FrequencyType = FrequencyType.monthly
    default_wallet_id: int
    category_id: int
    next_due_date: date
    is_active: bool = True

class SubscriptionCreate(SubscriptionBase):
    pass

class SubscriptionUpdate(BaseModel):
    name: Optional[str] = None
    amount: Optional[Decimal] = Field(None, gt=0)
    frequency: Optional[FrequencyType] = None
    default_wallet_id: Optional[int] = None
    category_id: Optional[int] = None
    next_due_date: Optional[date] = None
    is_active: Optional[bool] = None

class SubscriptionResponse(SubscriptionBase):
    subscription_id: int
    user_id: int

    class Config:
        from_attributes = True