import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv

# Load biến môi trường từ file .env
load_dotenv()

SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL")

# Tạo engine kết nối (PostgreSQL)
engine = create_engine(SQLALCHEMY_DATABASE_URL)

# Tạo SessionLocal class để mỗi request sẽ sinh ra một phiên làm việc độc lập
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class để các Model kế thừa
Base = declarative_base()

# Dependency để sử dụng trong FastAPI (Sẽ dùng trong các Endpoints)
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()