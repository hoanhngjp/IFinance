import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.db.database import Base

# Tạo database SQLite in-memory để chạy test cực nhanh và an toàn
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="function")
def db_session():
    # Tạo lại bảng cho mỗi lần chạy test
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        # Xóa bảng sau khi test xong
        Base.metadata.drop_all(bind=engine)

from app.models.user import User
from app.models.wallet_category import Category
from app.core.security import get_password_hash

# Helper: Sinh giả User
@pytest.fixture
def test_user(db_session):
    u = User(username="test_user", email="test@a.com", password_hash=get_password_hash("123"), is_active=True)
    db_session.add(u)
    db_session.commit()
    db_session.refresh(u)
    return u

# Helper: Sinh giả Category
@pytest.fixture
def test_category(db_session, test_user):
    c = Category(name="Ăn uống", type="expense", user_id=test_user.user_id)
    db_session.add(c)
    db_session.commit()
    db_session.refresh(c)
    return c
