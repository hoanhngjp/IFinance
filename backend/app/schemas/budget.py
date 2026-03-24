from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import date
from decimal import Decimal
from app.models.enums import BudgetPeriod

# Schema thiết lập ngân sách
class BudgetCreate(BaseModel):
    category_id: int
    amount_limit: Decimal = Field(..., gt=0, description="Hạn mức chi tiêu")
    period: BudgetPeriod
    start_date: date
    end_date: date

# Schema trả về thông tin ngân sách
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

# Schema đặc biệt cho API /progress (Tiến độ chi tiêu)
class BudgetProgressResponse(BaseModel):
    budget_id: int
    category_id: int
    category_name: str
    amount_limit: Decimal
    spent: Decimal
    remaining: Decimal
    warning: bool