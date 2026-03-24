from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date
from decimal import Decimal

from app.db.database import get_db
from app.models.finance_modules import Budget
from app.models.wallet_category import Category
from app.models.transaction import Transaction
from app.models.user import User
from app.models.enums import TransactionType, BudgetPeriod
from app.schemas.budget import BudgetCreate, BudgetResponse, BudgetProgressResponse
from app.api.deps import get_current_user

router = APIRouter()


@router.post("/", response_model=dict, status_code=status.HTTP_201_CREATED)
def create_budget(
        budget_in: BudgetCreate,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    # 1. Kiểm tra Category có tồn tại không
    category = db.query(Category).filter(
        Category.category_id == budget_in.category_id,
        (Category.user_id == current_user.user_id) | (Category.user_id == None)
    ).first()
    if not category:
        raise HTTPException(status_code=404, detail="Không tìm thấy danh mục")

    # 2. (Optional) Kiểm tra xem đã có ngân sách cho danh mục này trong kỳ đó chưa
    existing_budget = db.query(Budget).filter(
        Budget.user_id == current_user.user_id,
        Budget.category_id == budget_in.category_id,
        Budget.period == budget_in.period,
        Budget.start_date == budget_in.start_date
    ).first()

    if existing_budget:
        # Nếu đã có, tiến hành cập nhật hạn mức
        existing_budget.amount_limit = budget_in.amount_limit
        db.commit()
        db.refresh(existing_budget)
        return {"status": "success", "message": "Cập nhật ngân sách thành công",
                "data": BudgetResponse.model_validate(existing_budget)}

    # 3. Tạo mới
    new_budget = Budget(
        user_id=current_user.user_id,
        category_id=budget_in.category_id,
        amount_limit=budget_in.amount_limit,
        period=budget_in.period,
        start_date=budget_in.start_date,
        end_date=budget_in.end_date
    )
    db.add(new_budget)
    db.commit()
    db.refresh(new_budget)

    return {
        "status": "success",
        "message": "Thiết lập ngân sách thành công",
        "data": BudgetResponse.model_validate(new_budget)
    }


@router.get("/progress", response_model=dict)
def get_budget_progress(
        period: BudgetPeriod = Query(..., description="Chọn kỳ ngân sách (VD: monthly, weekly)"),
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    # 1. Lấy tất cả ngân sách của user theo chu kỳ
    # Dùng join để lấy luôn tên của Category (tránh phải query N+1)
    budgets = db.query(Budget, Category.name).join(Category, Budget.category_id == Category.category_id) \
        .filter(Budget.user_id == current_user.user_id, Budget.period == period).all()

    progress_list = []

    # 2. Tính toán tiền đã tiêu cho TỪNG ngân sách
    for budget, category_name in budgets:
        # Query tính tổng (SUM) các Giao dịch Thuộc danh mục + Là chi phí + Nằm trong khoảng thời gian ngân sách
        spent_amount = db.query(func.sum(Transaction.amount)).filter(
            Transaction.user_id == current_user.user_id,
            Transaction.category_id == budget.category_id,
            Transaction.transaction_type == TransactionType.expense,
            Transaction.date >= budget.start_date,
            Transaction.date <= budget.end_date
        ).scalar()  # .scalar() lấy ra con số duy nhất thay vì trả về Tuple

        # Nếu chưa tiêu gì, func.sum sẽ trả về None -> Chuyển thành 0
        spent = spent_amount if spent_amount is not None else Decimal(0)
        remaining = budget.amount_limit - spent

        # Bật cờ "Cảnh báo" nếu đã xài từ 80% ngân sách trở lên
        warning = spent >= (budget.amount_limit * Decimal('0.8'))

        progress_list.append(BudgetProgressResponse(
            budget_id=budget.budget_id,
            category_id=budget.category_id,
            category_name=category_name,
            amount_limit=budget.amount_limit,
            spent=spent,
            remaining=remaining,
            warning=warning
        ))

    return {
        "status": "success",
        "data": progress_list
    }