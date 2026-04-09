from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from fastapi.encoders import jsonable_encoder

from app.db.database import get_db
from app.models.user import User
from app.schemas.user import UserResponse, UserUpdate, UserChangePassword
from app.api.deps import get_current_user

# Đảm bảo bạn đã có 2 hàm băm mật khẩu này trong thư mục core/security.py
from app.core.security import verify_password, get_password_hash

router = APIRouter()

# ==========================================
# 1. LẤY THÔNG TIN HỒ SƠ (GET /me)
# ==========================================
@router.get("/me", response_model=dict)
def read_user_me(current_user: User = Depends(get_current_user)):
    """
    Lấy thông tin tài khoản đang đăng nhập.
    Bảo mật: Không cần truyền ID, tự động lấy từ Token.
    """
    return {
        "status": "success",
        "data": jsonable_encoder(UserResponse.model_validate(current_user))
    }

# ==========================================
# 2. CẬP NHẬT THÔNG TIN (PUT /me)
# ==========================================
@router.put("/me", response_model=dict)
def update_user_me(
    user_in: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Cập nhật thông tin cá nhân.
    Bảo mật: Chỉ cho phép đổi full_name. Không cho đổi email/username ở đây.
    """
    try:
        current_user.full_name = user_in.full_name
        db.commit()
        db.refresh(current_user)

        return {
            "status": "success",
            "message": "Cập nhật thông tin thành công",
            "data": jsonable_encoder(UserResponse.model_validate(current_user))
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi hệ thống: {str(e)}")

# ==========================================
# 3. ĐỔI MẬT KHẨU (PUT /me/password)
# ==========================================
@router.put("/me/password", response_model=dict)
def update_user_password(
    pass_in: UserChangePassword,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Đổi mật khẩu an toàn.
    Bảo mật: Phải xác thực mật khẩu cũ. Mật khẩu mới được băm (hash) trước khi lưu.
    """
    # 1. Kiểm tra mật khẩu cũ có đúng không
    if not verify_password(pass_in.old_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Mật khẩu cũ không chính xác")

    # (Lưu ý: Việc kiểm tra new_password == confirm_password đã được Pydantic lo ở tầng Schema)

    # 2. Kiểm tra mật khẩu mới không được trùng mật khẩu cũ
    if pass_in.old_password == pass_in.new_password:
        raise HTTPException(status_code=400, detail="Mật khẩu mới không được trùng với mật khẩu cũ")

    try:
        # 3. Băm và lưu mật khẩu mới
        current_user.password_hash = get_password_hash(pass_in.new_password)
        db.commit()

        return {
            "status": "success",
            "message": "Đổi mật khẩu thành công. Vui lòng đăng nhập lại (nếu hệ thống yêu cầu)."
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi hệ thống khi đổi mật khẩu: {str(e)}")