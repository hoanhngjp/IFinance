from sqlalchemy.orm import Session
from app.models.user import User
from app.schemas.user import UserUpdate, UserChangePassword, UserPreferencesUpdate
from app.core.security import verify_password, get_password_hash

class UserService:
    def update_profile(self, db: Session, user: User, user_in: UserUpdate) -> User:
        user.full_name = user_in.full_name
        db.commit()
        db.refresh(user)
        return user

    def change_password(self, db: Session, user: User, pass_in: UserChangePassword):
        if not verify_password(pass_in.old_password, user.password_hash):
            raise ValueError("Mật khẩu cũ không chính xác")

        if pass_in.old_password == pass_in.new_password:
            raise ValueError("Mật khẩu mới không được trùng với mật khẩu cũ")

        user.password_hash = get_password_hash(pass_in.new_password)
        db.commit()
        return True

    def update_preferences(self, db: Session, user: User, prefs_in: UserPreferencesUpdate) -> User:
        user.has_seen_tutorial = prefs_in.has_seen_tutorial
        db.commit()
        db.refresh(user)
        return user

user_service = UserService()
