from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from fastapi.security import OAuth2PasswordRequestForm

from app.db.database import get_db
from app.models.user import User
from app.schemas.user import UserCreate, UserResponse, Token, RefreshTokenRequest, LogoutRequest, GoogleAuthRequest
from app.api.deps import get_current_user
from app.services.auth_service import auth_service

router = APIRouter()

@router.post("/register", response_model=dict, status_code=status.HTTP_201_CREATED)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    try:
        new_user = auth_service.register(db, user_in)
        return {
            "status": "success",
            "message": "Đăng ký thành công",
            "data": UserResponse.model_validate(new_user)
        }
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    try:
        return auth_service.login(db, form_data.username, form_data.password)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(ve))

@router.post("/google", response_model=Token)
def google_auth(req: GoogleAuthRequest, db: Session = Depends(get_db)):
    try:
        return auth_service.google_auth(db, req.token)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi hệ thống khi đăng nhập bằng Google: {str(e)}")

@router.post("/refresh-token", response_model=Token)
def refresh_token(request: RefreshTokenRequest, db: Session = Depends(get_db)):
    try:
        return auth_service.refresh_token(db, request.refresh_token)
    except ValueError as ve:
        raise HTTPException(status_code=401, detail=str(ve))

@router.post("/logout", response_model=dict)
def logout(
        request: LogoutRequest,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    try:
        auth_service.logout(db, request.refresh_token)
        return {
            "status": "success",
            "message": "Đăng xuất thành công"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail="Không thể xử lý quá trình đăng xuất")