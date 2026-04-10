from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from fastapi.encoders import jsonable_encoder

from app.db.database import get_db
from app.models.user import User
from app.schemas.user import UserResponse, UserUpdate, UserChangePassword
from app.api.deps import get_current_user
from app.services.user_service import user_service

router = APIRouter()

@router.get("/me", response_model=dict)
def read_user_me(current_user: User = Depends(get_current_user)):
    return {
        "status": "success",
        "data": jsonable_encoder(UserResponse.model_validate(current_user))
    }

@router.put("/me", response_model=dict)
def update_user_me(
    user_in: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        updated_user = user_service.update_profile(db, current_user, user_in)
        return {
            "status": "success",
            "message": "Cập nhật thông tin thành công",
            "data": jsonable_encoder(UserResponse.model_validate(updated_user))
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi hệ thống: {str(e)}")

@router.put("/me/password", response_model=dict)
def update_user_password(
    pass_in: UserChangePassword,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        user_service.change_password(db, current_user, pass_in)
        return {
            "status": "success",
            "message": "Đổi mật khẩu thành công. Vui lòng đăng nhập lại (nếu hệ thống yêu cầu)."
        }
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi hệ thống khi đổi mật khẩu: {str(e)}")