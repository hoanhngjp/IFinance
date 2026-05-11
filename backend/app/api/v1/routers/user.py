import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from fastapi.encoders import jsonable_encoder

from app.db.database import get_db
from app.models.user import User
from app.schemas.user import UserResponse, UserUpdate, UserChangePassword, UserPreferencesUpdate
from app.api.deps import get_current_user
from app.services.user_service import user_service

logger = logging.getLogger(__name__)
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
    except Exception:
        logger.exception("Lỗi khi cập nhật thông tin user_id=%s", current_user.user_id)
        raise HTTPException(status_code=500, detail="Lỗi server, vui lòng thử lại.")

@router.patch("/me/preferences", response_model=dict)
def update_user_preferences(
    prefs_in: UserPreferencesUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        updated_user = user_service.update_preferences(db, current_user, prefs_in)
        return {
            "status": "success",
            "data": jsonable_encoder(UserResponse.model_validate(updated_user))
        }
    except Exception:
        logger.exception("Lỗi khi cập nhật preferences user_id=%s", current_user.user_id)
        raise HTTPException(status_code=500, detail="Lỗi server, vui lòng thử lại.")

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
    except Exception:
        logger.exception("Lỗi khi đổi mật khẩu user_id=%s", current_user.user_id)
        raise HTTPException(status_code=500, detail="Lỗi server, vui lòng thử lại.")