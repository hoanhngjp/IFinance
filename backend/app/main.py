from fastapi import FastAPI
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from contextlib import asynccontextmanager
from apscheduler.schedulers.background import BackgroundScheduler
from app.services.subscription_worker import process_due_subscriptions
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1.routers import auth, wallet, category, transaction, debt, budget, ai, subscription, investment

# --- KHỞI TẠO SCHEDULER CHẠY NGẦM ---
scheduler = BackgroundScheduler()
# Để Test
#scheduler.add_job(process_due_subscriptions, 'interval', minutes=1)
scheduler.add_job(process_due_subscriptions, 'cron', hour=0, minute=1)


# --- KHAI BÁO LIFESPAN ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. PHẦN STARTUP (Khởi động Server)
    scheduler.start()
    print("⏳ [APScheduler] Đã khởi động Background Worker!")

    process_due_subscriptions()

    yield  # <--- Ứng dụng FastAPI sẽ chạy và phục vụ người dùng ở điểm này

    # 2. PHẦN SHUTDOWN (Khi tắt Server bằng Ctrl+C)
    scheduler.shutdown()
    print("🛑 [APScheduler] Đã tắt Background Worker!")

app = FastAPI(
    title="IFinance API",
    description="API cho hệ thống quản lý tài chính cá nhân",
    lifespan=lifespan,
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

app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.include_router(auth.router, prefix="/api/v1/auth", tags=["Authentication"])
app.include_router(wallet.router, prefix="/api/v1/wallets", tags=["Wallets"])
app.include_router(category.router, prefix="/api/v1/categories", tags=["Categories"])
app.include_router(transaction.router, prefix="/api/v1/transactions", tags=["Transactions"])
app.include_router(debt.router, prefix="/api/v1/debts", tags=["Debts"])
app.include_router(budget.router, prefix="/api/v1/budgets", tags=["Budgets"])
app.include_router(ai.router, prefix="/api/v1/ai", tags=["AI Processing"])
app.include_router(subscription.router, prefix="/api/v1/subscriptions", tags=["Subscriptions"])
app.include_router(investment.router, prefix="/api/v1/investments", tags=["Investments"])


@app.get("/")
def read_root():
    return {"message": "Server IFinance Backend đang chạy thành công!"}