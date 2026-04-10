import calendar
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date
from decimal import Decimal

from app.crud.crud_budget import budget as crud_budget
from app.crud.crud_category import category as crud_category
from app.models.finance_modules import Budget
from app.models.wallet_category import Category
from app.models.transaction import Transaction
from app.models.enums import TransactionType, BudgetPeriod
from app.schemas.budget import BudgetCreate

class BudgetService:
    def create_or_update(self, db: Session, budget_in: BudgetCreate, user_id: int):
        category = crud_category.get_parent_category(db, parent_id=budget_in.category_id, user_id=user_id)
        if not category:
            raise ValueError("Không tìm thấy danh mục")

        existing_budget = db.query(Budget).filter(
            Budget.user_id == user_id,
            Budget.category_id == budget_in.category_id,
            Budget.period == budget_in.period,
            Budget.start_date == budget_in.start_date,
            Budget.end_date == budget_in.end_date
        ).first()

        if existing_budget:
            existing_budget.amount_limit = budget_in.amount_limit
            if hasattr(budget_in, 'is_rollover'):
                existing_budget.is_rollover = budget_in.is_rollover
            db.commit()
            db.refresh(existing_budget)
            return existing_budget, False

        new_budget = Budget(
            user_id=user_id,
            category_id=budget_in.category_id,
            amount_limit=budget_in.amount_limit,
            period=budget_in.period,
            start_date=budget_in.start_date,
            end_date=budget_in.end_date,
            is_rollover=getattr(budget_in, 'is_rollover', False) if hasattr(Budget, 'is_rollover') else False
        )
        db.add(new_budget)
        db.commit()
        db.refresh(new_budget)
        return new_budget, True

    def get_progress(self, db: Session, period: BudgetPeriod, user_id: int):
        budgets = db.query(Budget, Category.name).join(
            Category, Budget.category_id == Category.category_id
        ).filter(Budget.user_id == user_id, Budget.period == period).all()

        progress_list = []
        today = date.today()

        for budget, category_name in budgets:
            spent_amount = db.query(func.sum(Transaction.amount)).filter(
                Transaction.user_id == user_id,
                Transaction.category_id == budget.category_id,
                Transaction.transaction_type == TransactionType.expense,
                Transaction.date >= budget.start_date,
                Transaction.date <= budget.end_date
            ).scalar()

            spent = spent_amount if spent_amount is not None else Decimal(0)
            remaining = budget.amount_limit - spent
            warning = spent >= (budget.amount_limit * Decimal('0.8'))

            safe_to_spend_per_day = Decimal(0)
            if remaining > 0 and today <= budget.end_date:
                days_remaining = (budget.end_date - today).days + 1
                if days_remaining > 0:
                    safe_to_spend_per_day = remaining / Decimal(days_remaining)

            progress_list.append({
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
            })

        return progress_list

    def update(self, db: Session, budget_id: int, budget_in: dict, user_id: int):
        budget_obj = crud_budget.get_by_id_and_user(db, budget_id=budget_id, user_id=user_id)
        if not budget_obj:
            raise ValueError("Không tìm thấy ngân sách")

        if "amount_limit" in budget_in:
            budget_obj.amount_limit = budget_in["amount_limit"]
        if "is_rollover" in budget_in and hasattr(budget_obj, 'is_rollover'):
            budget_obj.is_rollover = budget_in["is_rollover"]

        db.commit()
        return True

    def delete(self, db: Session, budget_id: int, user_id: int):
        budget_obj = crud_budget.get_by_id_and_user(db, budget_id=budget_id, user_id=user_id)
        if not budget_obj:
            raise ValueError("Không tìm thấy ngân sách")
        crud_budget.remove(db, id=budget_id)
        return True

    def get_recommendation(self, db: Session, category_id: int, user_id: int):
        today = date.today()
        first_day = date(today.year, today.month, 1)

        m3 = first_day.month - 3
        y3 = first_day.year
        if m3 <= 0:
            m3 += 12
            y3 -= 1

        start_date = date(y3, m3, 1)
        total_spent = db.query(func.sum(Transaction.amount)).filter(
            Transaction.user_id == user_id,
            Transaction.category_id == category_id,
            Transaction.transaction_type == TransactionType.expense,
            Transaction.date >= start_date,
            Transaction.date < first_day
        ).scalar()
        
        spent = total_spent if total_spent is not None else Decimal(0)
        avg = spent / Decimal(3)
        rec = (avg * Decimal('1.05')) // 1000 * 1000

        if rec == 0:
            msg = "Bạn chưa có dữ liệu chi tiêu cho danh mục này trong 3 tháng qua. Hãy thử bắt đầu với một con số nhỏ nhé!"
        else:
            msg = f"Trung bình 3 tháng qua bạn tiêu {float(avg):,.0f}đ/tháng. Hệ thống đề xuất mức ngân sách an toàn là {float(rec):,.0f}đ."

        return {"category_id": category_id, "avg_spent_last_3_months": float(avg), "recommended_amount": float(rec), "message": msg}

    def get_trend(self, db: Session, category_id: int, months: int, user_id: int):
        trend_data = []
        today = date.today()

        for i in range(months - 1, -1, -1):
            m = today.month - i
            y = today.year
            while m <= 0:
                m += 12
                y -= 1

            start_dt = date(y, m, 1)
            last_day = calendar.monthrange(y, m)[1]
            end_dt = date(y, m, last_day)

            spent_amount = db.query(func.sum(Transaction.amount)).filter(
                Transaction.user_id == user_id,
                Transaction.category_id == category_id,
                Transaction.transaction_type == TransactionType.expense,
                Transaction.date >= start_dt,
                Transaction.date <= end_dt
            ).scalar()
            spent = spent_amount if spent_amount is not None else Decimal(0)

            hist_budget = db.query(Budget).filter(
                Budget.user_id == user_id,
                Budget.category_id == category_id,
                Budget.start_date <= end_dt,
                Budget.end_date >= start_dt
            ).first()

            limit = hist_budget.amount_limit if hist_budget else Decimal(0)
            trend_data.append({
                "month_label": f"Tháng {m}/{str(y)[-2:]}",
                "limit": float(limit),
                "spent": float(spent)
            })

        return trend_data

budget_service = BudgetService()
