import calendar
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date, timedelta
from decimal import Decimal

from app.db.database import get_db
from app.models.finance_modules import Budget
from app.models.wallet_category import Category
from app.models.transaction import Transaction
from app.models.user import User
from app.models.enums import TransactionType, BudgetPeriod
from app.api.deps import get_current_user

# CHÚ Ý: Bạn cần đảm bảo đã thêm is_rollover vào Budget models và schema nhé
from app.schemas.budget import BudgetCreate, BudgetResponse, BudgetProgressResponse

router = APIRouter()


# ==========================================
# 1. TẠO NGÂN SÁCH (POST /)
# ==========================================
@router.post("/", response_model=dict, status_code=status.HTTP_201_CREATED)
def create_budget(
        budget_in: BudgetCreate,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    # Kiểm tra Category
    category = db.query(Category).filter(
        Category.category_id == budget_in.category_id,
        (Category.user_id == current_user.user_id) | (Category.user_id == None)
    ).first()
    if not category:
        raise HTTPException(status_code=404, detail="Không tìm thấy danh mục")

    # Kiểm tra xem đã có ngân sách cho danh mục này trong kỳ đó chưa
    existing_budget = db.query(Budget).filter(
        Budget.user_id == current_user.user_id,
        Budget.category_id == budget_in.category_id,
        Budget.period == budget_in.period,
        Budget.start_date == budget_in.start_date,
        Budget.end_date == budget_in.end_date
    ).first()

    if existing_budget:
        # Tự động cập nhật nếu đã tồn tại
        existing_budget.amount_limit = budget_in.amount_limit
        if hasattr(budget_in, 'is_rollover'):
            existing_budget.is_rollover = budget_in.is_rollover
        db.commit()
        db.refresh(existing_budget)
        return {
            "status": "success",
            "message": "Đã cập nhật ngân sách hiện tại",
            "data": {"budget_id": existing_budget.budget_id}
        }

    # Tạo mới
    new_budget = Budget(
        user_id=current_user.user_id,
        category_id=budget_in.category_id,
        amount_limit=budget_in.amount_limit,
        period=budget_in.period,
        start_date=budget_in.start_date,
        end_date=budget_in.end_date,
        # Nếu model/schema của bạn có is_rollover, hãy uncomment dòng dưới:
        # is_rollover=getattr(budget_in, 'is_rollover', False)
    )
    db.add(new_budget)
    db.commit()
    db.refresh(new_budget)

    return {
        "status": "success",
        "message": "Tạo ngân sách thành công",
        "data": {"budget_id": new_budget.budget_id}
    }


# ==========================================
# 2. XEM TIẾN ĐỘ NGÂN SÁCH (GET /progress)
# ==========================================
@router.get("/progress", response_model=dict)
def get_budget_progress(
        period: BudgetPeriod = Query(BudgetPeriod.monthly, description="Kỳ ngân sách (vd: monthly)"),
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    budgets = db.query(Budget, Category.name).join(
        Category, Budget.category_id == Category.category_id
    ).filter(Budget.user_id == current_user.user_id, Budget.period == period).all()

    progress_list = []
    today = date.today()

    for budget, category_name in budgets:
        spent_amount = db.query(func.sum(Transaction.amount)).filter(
            Transaction.user_id == current_user.user_id,
            Transaction.category_id == budget.category_id,
            Transaction.transaction_type == TransactionType.expense,
            Transaction.date >= budget.start_date,
            Transaction.date <= budget.end_date
        ).scalar()

        spent = spent_amount if spent_amount is not None else Decimal(0)
        remaining = budget.amount_limit - spent
        warning = spent >= (budget.amount_limit * Decimal('0.8'))

        # TÍNH TOÁN SAFE-TO-SPEND (Số tiền an toàn mỗi ngày)
        safe_to_spend_per_day = Decimal(0)
        if remaining > 0 and today <= budget.end_date:
            days_remaining = (budget.end_date - today).days + 1
            if days_remaining > 0:
                safe_to_spend_per_day = remaining / Decimal(days_remaining)

        # Chuyển đổi thành dict để trả về (vì schema của bạn có thể chưa update)
        progress_data = {
            "budget_id": budget.budget_id,
            "category_id": budget.category_id,
            "category_name": category_name,
            "amount_limit": float(budget.amount_limit),
            "start_date": budget.start_date,
            "end_date": budget.end_date,
            "spent": float(spent),
            "remaining": float(remaining),
            "warning": warning,
            "safe_to_spend_per_day": float(safe_to_spend_per_day),
            "is_rollover": getattr(budget, 'is_rollover', False)
        }
        progress_list.append(progress_data)

    return {
        "status": "success",
        "data": progress_list
    }


# ==========================================
# 3. CẬP NHẬT NGÂN SÁCH (PUT /{id})
# ==========================================
@router.put("/{budget_id}", response_model=dict)
def update_budget(
        budget_id: int,
        budget_in: dict,  # Dùng dict tạm nếu chưa tạo Schema Update
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    budget = db.query(Budget).filter(
        Budget.budget_id == budget_id,
        Budget.user_id == current_user.user_id
    ).first()

    if not budget:
        raise HTTPException(status_code=404, detail="Không tìm thấy ngân sách")

    if "amount_limit" in budget_in:
        budget.amount_limit = budget_in["amount_limit"]
    if "is_rollover" in budget_in and hasattr(budget, 'is_rollover'):
        budget.is_rollover = budget_in["is_rollover"]

    db.commit()
    db.refresh(budget)

    return {"status": "success", "message": "Cập nhật ngân sách thành công"}


# ==========================================
# 4. XÓA NGÂN SÁCH (DELETE /{id})
# ==========================================
@router.delete("/{budget_id}", response_model=dict)
def delete_budget(
        budget_id: int,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    budget = db.query(Budget).filter(
        Budget.budget_id == budget_id,
        Budget.user_id == current_user.user_id
    ).first()

    if not budget:
        raise HTTPException(status_code=404, detail="Không tìm thấy ngân sách")

    db.delete(budget)
    db.commit()

    return {"status": "success", "message": "Xóa ngân sách thành công"}


# ==========================================
# 5. GỢI Ý NGÂN SÁCH THÔNG MINH (GET /recommendation)
# ==========================================
@router.get("/recommendation", response_model=dict)
def get_budget_recommendation(
        category_id: int = Query(...),
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    # Lấy ngày hiện tại và tính ngược lại 3 tháng trước
    today = date.today()
    first_day_current_month = date(today.year, today.month, 1)

    month_3_ago = first_day_current_month.month - 3
    year_3_ago = first_day_current_month.year
    if month_3_ago <= 0:
        month_3_ago += 12
        year_3_ago -= 1

    start_date_3_months_ago = date(year_3_ago, month_3_ago, 1)

    # Tính tổng tiền đã tiêu cho category này trong 3 tháng qua
    total_spent = db.query(func.sum(Transaction.amount)).filter(
        Transaction.user_id == current_user.user_id,
        Transaction.category_id == category_id,
        Transaction.transaction_type == TransactionType.expense,
        Transaction.date >= start_date_3_months_ago,
        Transaction.date < first_day_current_month
    ).scalar()

    spent = total_spent if total_spent is not None else Decimal(0)
    avg_spent = spent / Decimal(3)

    # Gợi ý = Trung bình + 5% buffer an toàn (làm tròn đến hàng nghìn)
    recommended_amount = (avg_spent * Decimal('1.05'))
    recommended_amount = (recommended_amount // 1000) * 1000

    if recommended_amount == 0:
        message = "Bạn chưa có dữ liệu chi tiêu cho danh mục này trong 3 tháng qua. Hãy thử bắt đầu với một con số nhỏ nhé!"
    else:
        message = f"Trung bình 3 tháng qua bạn tiêu {float(avg_spent):,.0f}đ/tháng. Hệ thống đề xuất mức ngân sách an toàn là {float(recommended_amount):,.0f}đ."

    return {
        "status": "success",
        "data": {
            "category_id": category_id,
            "avg_spent_last_3_months": float(avg_spent),
            "recommended_amount": float(recommended_amount),
            "message": message
        }
    }


# ==========================================
# 6. BIỂU ĐỒ XU HƯỚNG 6 THÁNG (GET /trend)
# ==========================================
@router.get("/trend", response_model=dict)
def get_budget_trend(
        category_id: int = Query(...),
        months: int = Query(6, ge=3, le=12),
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    trend_data = []
    today = date.today()

    # Chạy vòng lặp lùi về X tháng
    for i in range(months - 1, -1, -1):
        target_month = today.month - i
        target_year = today.year

        while target_month <= 0:
            target_month += 12
            target_year -= 1

        # Tìm ngày đầu và ngày cuối của tháng đó
        start_of_month = date(target_year, target_month, 1)
        last_day = calendar.monthrange(target_year, target_month)[1]
        end_of_month = date(target_year, target_month, last_day)

        # 1. Tính tổng chi tiêu
        spent_amount = db.query(func.sum(Transaction.amount)).filter(
            Transaction.user_id == current_user.user_id,
            Transaction.category_id == category_id,
            Transaction.transaction_type == TransactionType.expense,
            Transaction.date >= start_of_month,
            Transaction.date <= end_of_month
        ).scalar()
        spent = spent_amount if spent_amount is not None else Decimal(0)

        # 2. Lấy hạn mức ngân sách của tháng đó (nếu có)
        historical_budget = db.query(Budget).filter(
            Budget.user_id == current_user.user_id,
            Budget.category_id == category_id,
            Budget.start_date <= end_of_month,
            Budget.end_date >= start_of_month
        ).first()

        limit = historical_budget.amount_limit if historical_budget else Decimal(0)

        trend_data.append({
            "month_label": f"Tháng {target_month}/{str(target_year)[-2:]}",
            "limit": float(limit),
            "spent": float(spent)
        })

    return {
        "status": "success",
        "data": trend_data
    }