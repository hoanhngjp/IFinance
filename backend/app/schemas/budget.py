from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import date
from decimal import Decimal
from app.models.enums import BudgetPeriod

class BudgetCreate(BaseModel):
    category_id: int
    amount_limit: Decimal = Field(..., gt=0, description="Hạn mức chi tiêu")
    period: BudgetPeriod
    is_rollover: bool = False
    start_date: date
    end_date: date

class BudgetResponse(BaseModel):
    budget_id: int
    user_id: int
    category_id: int
    amount_limit: Decimal
    period: BudgetPeriod
    start_date: date
    end_date: date

    class Config:
        from_attributes = True

class BudgetProgressResponse(BaseModel):
    budget_id: int
    category_id: int
    category_name: str
    amount_limit: Decimal
    spent: Decimal
    remaining: Decimal
    warning: bool
    safe_to_spend_per_day: float
    is_rollover: bool