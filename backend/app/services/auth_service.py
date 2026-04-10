import os
import string
import random
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from jose import jwt, JWTError

from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

from app.crud.crud_user import user as crud_user
from app.models.user import User, TokenBlacklist
from app.schemas.user import UserCreate
from app.core.security import get_password_hash, verify_password, create_access_token, create_refresh_token, SECRET_KEY, ALGORITHM

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com")

class AuthService:
    def register(self, db: Session, user_in: UserCreate) -> User:
        if crud_user.get_by_email(db, email=user_in.email):
            raise ValueError("Email này đã được đăng ký.")
        if crud_user.get_by_username(db, username=user_in.username):
            raise ValueError("Username này đã tồn tại.")

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
        return new_user

    def login(self, db: Session, identity: str, password: str):
        user = crud_user.get_by_username_or_email(db, identity=identity)
        if not user or not verify_password(password, user.password_hash):
            raise ValueError("Sai tài khoản hoặc mật khẩu")

        return self._generate_tokens(user.user_id)

    def google_auth(self, db: Session, token: str):
        try:
            idinfo = id_token.verify_oauth2_token(token, google_requests.Request(), GOOGLE_CLIENT_ID)
            email = idinfo.get("email")
            full_name = idinfo.get("name")

            if not email:
                raise ValueError("Token không chứa email hợp lệ")

            user = crud_user.get_by_email(db, email=email)
            if not user:
                base_username = email.split("@")[0]
                username = base_username
                counter = 1
                while crud_user.get_by_username(db, username=username):
                    username = f"{base_username}{counter}"
                    counter += 1

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

            return self._generate_tokens(user.user_id)
        except ValueError as ve:
             # Repackage id_token verification errors or custom ones
             if "Token không chứa email hợp lệ" in str(ve):
                 raise ValueError(str(ve))
             raise ValueError("Mã xác thực Google không hợp lệ hoặc đã hết hạn.")

    def refresh_token(self, db: Session, refresh_token: str):
        is_blacklisted = db.query(TokenBlacklist).filter(TokenBlacklist.token == refresh_token).first()
        if is_blacklisted:
            raise ValueError("Token đã bị thu hồi (Người dùng đã đăng xuất)")

        try:
            payload = jwt.decode(refresh_token, SECRET_KEY, algorithms=[ALGORITHM])
            user_id: str = payload.get("sub")
            token_type: str = payload.get("type")

            if user_id is None or token_type != "refresh":
                 raise ValueError("Refresh Token không hợp lệ")

            user = crud_user.get(db, id=int(user_id))
            if not user or not user.is_active:
                raise ValueError("User không tồn tại hoặc bị khóa")

            return self._generate_tokens(user.user_id)
        except JWTError:
            raise ValueError("Refresh token đã hết hạn hoặc không hợp lệ")

    def logout(self, db: Session, refresh_token: str):
        exists = db.query(TokenBlacklist).filter(TokenBlacklist.token == refresh_token).first()
        if not exists:
            blacklisted_token = TokenBlacklist(token=refresh_token)
            db.add(blacklisted_token)
            db.commit()
        return True
        
    def _generate_tokens(self, user_id: int):
        access_token = create_access_token(subject=user_id)
        refresh_token = create_refresh_token(subject=user_id)
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer"
        }

auth_service = AuthService()
