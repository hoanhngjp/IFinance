from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import Optional

from app.db.database import get_db
from app.models.user import User
from app.schemas.debt import DebtCreate, DebtResponse, DebtRepaymentCreate
from app.api.deps import get_current_user
from app.services.debt_service import debt_service

router = APIRouter()

@router.post("/", response_model=dict, status_code=status.HTTP_201_CREATED)
def create_debt(
        debt_in: DebtCreate,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    try:
        new_debt = debt_service.create_debt(db, debt_in, current_user.user_id)
        return {
            "status": "success",
            "message": "Tạo khoản nợ và ghi nhận dòng tiền thành công",
            "data": DebtResponse.model_validate(new_debt)
        }
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi hệ thống: {str(e)}")

@router.get("/", response_model=dict)
def get_debts(
        status: Optional[str] = Query(None, description="Lọc trạng thái nợ (ví dụ: active)"),
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    debts = debt_service.get_all(db, current_user.user_id, status)
    return {
        "status": "success",
        "data": [DebtResponse.model_validate(d) for d in debts]
    }

@router.post("/{debt_id}/repay", response_model=dict)
def repay_debt(
        debt_id: int,
        repay_in: DebtRepaymentCreate,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    try:
        debt_service.repay_debt(db, debt_id, repay_in, current_user.user_id)
        return {"status": "success", "message": "Ghi nhận trả nợ thành công"}
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi hệ thống: {str(e)}")

@router.get("/{debt_id}/repayments", response_model=dict)
def get_debt_repayments(
        debt_id: int,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    try:
        history = debt_service.get_repayments(db, debt_id, current_user.user_id)
        return {
            "status": "success",
            "data": history
        }
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))