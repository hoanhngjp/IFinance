from pydantic import BaseModel
from typing import Optional

class AIParseRequest(BaseModel):
    text: str

class AIChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None

class AIBudgetTemplateRequest(BaseModel):
    income: float
    template_type: str
