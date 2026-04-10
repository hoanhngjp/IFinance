from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.user import User
from app.models.enums import BudgetPeriod
from app.schemas.budget import BudgetCreate
from app.api.deps import get_current_user
from app.services.budget_service import budget_service

router = APIRouter()

@router.post("/", response_model=dict, status_code=status.HTTP_201_CREATED)
def create_budget(
        budget_in: BudgetCreate,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    try:
        budget, created = budget_service.create_or_update(db, budget_in, current_user.user_id)
        return {
            "status": "success",
            "message": "Tạo ngân sách thành công" if created else "Đã cập nhật ngân sách hiện tại",
            "data": {"budget_id": budget.budget_id}
        }
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))

@router.get("/progress", response_model=dict)
def get_budget_progress(
        period: BudgetPeriod = Query(BudgetPeriod.monthly, description="Kỳ ngân sách (vd: monthly)"),
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    progress_list = budget_service.get_progress(db, period, current_user.user_id)
    return {
        "status": "success",
        "data": progress_list
    }

@router.put("/{budget_id}", response_model=dict)
def update_budget(
        budget_id: int,
        budget_in: dict,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    try:
        budget_service.update(db, budget_id, budget_in, current_user.user_id)
        return {"status": "success", "message": "Cập nhật ngân sách thành công"}
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))

@router.delete("/{budget_id}", response_model=dict)
def delete_budget(
        budget_id: int,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    try:
        budget_service.delete(db, budget_id, current_user.user_id)
        return {"status": "success", "message": "Xóa ngân sách thành công"}
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))

@router.get("/recommendation", response_model=dict)
def get_budget_recommendation(
        category_id: int = Query(...),
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    data = budget_service.get_recommendation(db, category_id, current_user.user_id)
    return {
        "status": "success",
        "data": data
    }

@router.get("/trend", response_model=dict)
def get_budget_trend(
        category_id: int = Query(...),
        months: int = Query(6, ge=3, le=12),
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    trend_data = budget_service.get_trend(db, category_id, months, current_user.user_id)
    return {
        "status": "success",
        "data": trend_data
    }