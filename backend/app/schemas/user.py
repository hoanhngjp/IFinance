from pydantic import BaseModel, EmailStr, Field, model_validator
from typing import Optional
from datetime import datetime

# ==========================================
# SCHEMAS CHO AUTH (Đăng ký, Đăng nhập)
# ==========================================
class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=6)
    full_name: Optional[str] = None

class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class RefreshTokenRequest(BaseModel):
    refresh_token: str

class LogoutRequest(BaseModel):
    refresh_token: str

class GoogleAuthRequest(BaseModel):
    token: str  # Chuỗi ID Token do Google cấp từ Frontend

# ==========================================
# SCHEMAS CHO USER PROFILE
# ==========================================
class UserResponse(BaseModel):
    user_id: int
    username: str
    email: str
    full_name: Optional[str] = None
    is_active: bool
    has_seen_tutorial: bool = False
    created_at: datetime

    class Config:
        from_attributes = True

class UserPreferencesUpdate(BaseModel):
    has_seen_tutorial: bool

# Schema Cập nhật thông tin (Chỉ cho phép đổi tên)
class UserUpdate(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=100)

# Schema Đổi mật khẩu
class UserChangePassword(BaseModel):
    old_password: str = Field(..., min_length=6)
    new_password: str = Field(..., min_length=6)
    confirm_password: str = Field(..., min_length=6)

    # Validation chéo: Xác nhận mật khẩu phải khớp
    @model_validator(mode='after')
    def check_passwords_match(self):
        if self.new_password != self.confirm_password:
            raise ValueError('Mật khẩu xác nhận không khớp với mật khẩu mới')
        return self