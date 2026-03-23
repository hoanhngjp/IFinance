from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from fastapi.security import OAuth2PasswordRequestForm
from jose import jwt, JWTError

from app.db.database import get_db
from app.models.user import User
from app.schemas.user import UserCreate, UserResponse, Token, RefreshTokenRequest
from app.core.security import get_password_hash, verify_password, create_access_token, create_refresh_token, SECRET_KEY, \
    ALGORITHM
from app.api.deps import get_current_user

router = APIRouter()


@router.post("/register", response_model=dict, status_code=status.HTTP_201_CREATED)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    # 1. Kiểm tra Email hoặc Username đã tồn tại chưa
    if db.query(User).filter(User.email == user_in.email).first():
        raise HTTPException(status_code=400, detail="Email này đã được đăng ký.")
    if db.query(User).filter(User.username == user_in.username).first():
        raise HTTPException(status_code=400, detail="Username này đã tồn tại.")

    # 2. Băm mật khẩu và lưu DB
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
    # OAuth2PasswordRequestForm mặc định nhận field 'username' (bạn có thể nhập email hoặc username vào đây)
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


@router.post("/refresh-token", response_model=Token)
def refresh_token(request: RefreshTokenRequest, db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(request.refresh_token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        token_type: str = payload.get("type")

        if user_id is None or token_type != "refresh":
            raise HTTPException(status_code=401, detail="Refresh Token không hợp lệ")

        user = db.query(User).filter(User.user_id == int(user_id)).first()
        if not user or not user.is_active:
            raise HTTPException(status_code=401, detail="User không tồn tại hoặc bị khóa")

        # Cấp lại cặp token mới
        new_access_token = create_access_token(subject=user.user_id)
        new_refresh_token = create_refresh_token(subject=user.user_id)

        return {
            "access_token": new_access_token,
            "refresh_token": new_refresh_token,
            "token_type": "bearer"
        }
    except JWTError:
        raise HTTPException(status_code=401, detail="Refresh token đã hết hạn hoặc không hợp lệ")


@router.get("/me", response_model=dict)
def read_users_me(current_user: User = Depends(get_current_user)):
    return {
        "status": "success",
        "data": UserResponse.model_validate(current_user)
    }