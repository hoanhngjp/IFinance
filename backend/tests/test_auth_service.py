import pytest
from app.services.auth_service import auth_service
from app.schemas.user import UserCreate

# ===============================================
# TC-14: Đăng ký tài khoản (User Registration)
# ===============================================
def test_user_registration(db_session):
    # HP: Đăng ký thành công
    user_in = UserCreate(
        username="newuser_123",
        email="newuser@example.com",
        password="SecurePassword123!",
        full_name="New Test User"
    )
    new_user = auth_service.register(db_session, user_in)
    
    assert new_user.username == "newuser_123"
    assert new_user.email == "newuser@example.com"
    assert new_user.is_active is True
    # Đảm bảo password đã được băm chứ không lưu plaintext
    assert new_user.password_hash != "SecurePassword123!"

    # UP: Đăng ký với Email đã tồn tại (Phải bị văng Exception)
    with pytest.raises(ValueError, match="Email này đã được đăng ký."):
        duplicate_email_user = UserCreate(
            username="another_user",
            email="newuser@example.com",
            password="Password111",
            full_name="Duplicate"
        )
        auth_service.register(db_session, duplicate_email_user)

    # UP: Đăng ký với Username đã tồn tại
    with pytest.raises(ValueError, match="Username này đã tồn tại."):
        duplicate_username_user = UserCreate(
            username="newuser_123",
            email="different@example.com",
            password="Password222",
            full_name="Duplicate"
        )
        auth_service.register(db_session, duplicate_username_user)


# ===============================================
# TC-15: Đăng nhập & Cơ chế Token (JWT Authentication)
# ===============================================
def test_user_login_and_token_refresh(db_session):
    # Chuẩn bị dữ liệu: Tạo User trước
    user_in = UserCreate(username="login_test", email="login@test.com", password="MyPassword1!", full_name="Test")
    auth_service.register(db_session, user_in)

    # HP: Đăng nhập thành công với Username
    tokens = auth_service.login(db_session, identity="login_test", password="MyPassword1!")
    assert "access_token" in tokens
    assert "refresh_token" in tokens
    assert tokens["token_type"] == "bearer"

    # HP: Đăng nhập thành công với Email
    tokens_by_email = auth_service.login(db_session, identity="login@test.com", password="MyPassword1!")
    assert "access_token" in tokens_by_email

    # UP: Sai mật khẩu
    with pytest.raises(ValueError, match="Sai tài khoản hoặc mật khẩu"):
        auth_service.login(db_session, identity="login_test", password="WrongPassword")
        
    # UP: Sai tài khoản
    with pytest.raises(ValueError, match="Sai tài khoản hoặc mật khẩu"):
        auth_service.login(db_session, identity="idontexist", password="MyPassword1!")

    # =============================================
    # Giao thức Refresh Token
    # =============================================
    refresh_token = tokens["refresh_token"]
    
    # Lấy access_token mới bằng refresh_token hợp lệ
    new_tokens = auth_service.refresh_token(db_session, refresh_token=refresh_token)
    assert new_tokens["access_token"] != tokens["access_token"]

    # =============================================
    # Giao thức Logout (Blacklist token)
    # =============================================
    auth_service.logout(db_session, refresh_token=refresh_token)
    
    # Cố tình dùng token đã bị logout để lấy quyền
    with pytest.raises(ValueError, match="Token đã bị thu hồi \\(Người dùng đã đăng xuất\\)"):
        auth_service.refresh_token(db_session, refresh_token=refresh_token)
