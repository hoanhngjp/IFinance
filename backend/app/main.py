from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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

@app.get("/")
def read_root():
    return {"message": "Server IFinance Backend đang chạy thành công!"}