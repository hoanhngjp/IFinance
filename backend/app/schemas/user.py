from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime

# Schema cho input Đăng ký
class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    full_name: Optional[str] = None

# Schema cho Output trả về chung
class UserResponse(BaseModel):
    user_id: int
    username: str
    email: str
    full_name: Optional[str] = None
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

# Schema cho Auth Token
class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class RefreshTokenRequest(BaseModel):
    refresh_token: str

class LogoutRequest(BaseModel):
    refresh_token: str