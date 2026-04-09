import os
import string
import random
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from fastapi.security import OAuth2PasswordRequestForm
from jose import jwt, JWTError

# Bổ sung thư viện cho Google Auth
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

from app.db.database import get_db
from app.models.user import User, TokenBlacklist
from app.schemas.user import UserCreate, UserResponse, Token, RefreshTokenRequest, LogoutRequest, GoogleAuthRequest
from app.core.security import get_password_hash, verify_password, create_access_token, create_refresh_token, SECRET_KEY, \
    ALGORITHM
from app.api.deps import get_current_user

router = APIRouter()

# Lấy Client ID từ biến môi trường (Bạn nhớ thêm GOOGLE_CLIENT_ID vào file .env nhé)
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com")


@router.post("/register", response_model=dict, status_code=status.HTTP_201_CREATED)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == user_in.email).first():
        raise HTTPException(status_code=400, detail="Email này đã được đăng ký.")
    if db.query(User).filter(User.username == user_in.username).first():
        raise HTTPException(status_code=400, detail="Username này đã tồn tại.")

    hashed_password = get_password_hash(user_in.password)
    new_user = User(
        username=user_in.username,
        email=user_in.email,
        password_hash=hashed_password,
        full_name=user_in.full_name
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return {
        "status": "success",
        "message": "Đăng ký thành công",
        "data": UserResponse.model_validate(new_user)
    }


@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter((User.username == form_data.username) | (User.email == form_data.username)).first()

    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sai tài khoản hoặc mật khẩu")

    access_token = create_access_token(subject=user.user_id)
    refresh_token = create_refresh_token(subject=user.user_id)

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }


# ==========================================
# API ĐĂNG NHẬP BẰNG GOOGLE OAUTH2
# ==========================================
@router.post("/google", response_model=Token)
def google_auth(req: GoogleAuthRequest, db: Session = Depends(get_db)):
    try:
        # 1. Xác minh Token với Google
        idinfo = id_token.verify_oauth2_token(
            req.token, google_requests.Request(), GOOGLE_CLIENT_ID
        )

        # 2. Lấy thông tin user từ Payload của Google
        email = idinfo.get("email")
        full_name = idinfo.get("name")

        if not email:
            raise HTTPException(status_code=400, detail="Token không chứa email hợp lệ")

        # 3. Kiểm tra user trong Database
        user = db.query(User).filter(User.email == email).first()

        # Nếu user chưa tồn tại -> Tự động đăng ký
        if not user:
            # Sinh username duy nhất từ email
            base_username = email.split("@")[0]
            username = base_username
            counter = 1
            while db.query(User).filter(User.username == username).first():
                username = f"{base_username}{counter}"
                counter += 1

            # Sinh mật khẩu ngẫu nhiên siêu dài và băm ra để đảm bảo an toàn Database
            random_password = ''.join(random.choices(string.ascii_letters + string.digits, k=32))
            hashed_password = get_password_hash(random_password)

            user = User(
                username=username,
                email=email,
                password_hash=hashed_password,
                full_name=full_name
            )
            db.add(user)
            db.commit()
            db.refresh(user)

        # 4. Cấp cặp Token nội bộ của hệ thống IFinance
        access_token = create_access_token(subject=user.user_id)
        refresh_token = create_refresh_token(subject=user.user_id)

        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer"
        }

    except ValueError:
        raise HTTPException(status_code=400, detail="Mã xác thực Google không hợp lệ hoặc đã hết hạn.")
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi hệ thống khi đăng nhập bằng Google: {str(e)}")


@router.post("/refresh-token", response_model=Token)
def refresh_token(request: RefreshTokenRequest, db: Session = Depends(get_db)):
    is_blacklisted = db.query(TokenBlacklist).filter(TokenBlacklist.token == request.refresh_token).first()
    if is_blacklisted:
        raise HTTPException(status_code=401, detail="Token đã bị thu hồi (Người dùng đã đăng xuất)")

    try:
        payload = jwt.decode(request.refresh_token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        token_type: str = payload.get("type")

        if user_id is None or token_type != "refresh":
            raise HTTPException(status_code=401, detail="Refresh Token không hợp lệ")

        user = db.query(User).filter(User.user_id == int(user_id)).first()
        if not user or not user.is_active:
            raise HTTPException(status_code=401, detail="User không tồn tại hoặc bị khóa")

        new_access_token = create_access_token(subject=user.user_id)
        new_refresh_token = create_refresh_token(subject=user.user_id)

        return {
            "access_token": new_access_token,
            "refresh_token": new_refresh_token,
            "token_type": "bearer"
        }
    except JWTError:
        raise HTTPException(status_code=401, detail="Refresh token đã hết hạn hoặc không hợp lệ")


@router.post("/logout", response_model=dict)
def logout(
        request: LogoutRequest,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)  # Bắt buộc có token access để logout
):
    exists = db.query(TokenBlacklist).filter(TokenBlacklist.token == request.refresh_token).first()

    if not exists:
        try:
            blacklisted_token = TokenBlacklist(token=request.refresh_token)
            db.add(blacklisted_token)
            db.commit()
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=500, detail="Không thể xử lý quá trình đăng xuất")

    return {
        "status": "success",
        "message": "Đăng xuất thành công"
    }