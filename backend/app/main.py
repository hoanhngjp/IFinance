from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1.routers import auth

app = FastAPI(
    title="IFinance API",
    description="API cho hệ thống quản lý tài chính cá nhân",
    version="1.0.0"
)

# Cho phép Frontend gọi API mà không bị lỗi CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1/auth", tags=["Authentication"])

@app.get("/")
def read_root():
    return {"message": "Server IFinance Backend đang chạy thành công!"}