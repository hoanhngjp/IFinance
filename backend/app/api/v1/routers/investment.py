from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from fastapi.encoders import jsonable_encoder

from app.db.database import get_db
from app.models.user import User
from app.schemas.investment import InvestmentCreate, InvestmentUpdateValue, InvestmentSell, InvestmentPassiveIncome
from app.api.deps import get_current_user
from app.services.investment_service import investment_service

router = APIRouter()

@router.get("/", response_model=dict)
def get_investments(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    investments = investment_service.get_all(db, current_user.user_id)
    return {"status": "success", "data": jsonable_encoder(investments)}

@router.get("/analytics", response_model=dict)
def get_investment_analytics(timeframe: str = "1Y", db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    analytics_data = investment_service.get_analytics(db, current_user.user_id)
    return {
        "status": "success",
        "data": analytics_data
    }

@router.get("/{inv_id}", response_model=dict)
def get_investment_detail(inv_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        detail_data = investment_service.get_detail(db, inv_id, current_user.user_id)
        return {
            "status": "success",
            "data": {
                "investment": jsonable_encoder(detail_data["investment"]),
                "transactions": jsonable_encoder(detail_data["transactions"]),
                "unrealized_pnl": detail_data["unrealized_pnl"]
            }
        }
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))

@router.post("/", response_model=dict, status_code=status.HTTP_201_CREATED)
def create_investment(inv_in: InvestmentCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        new_inv = investment_service.create_investment(db, inv_in, current_user.user_id)
        return {"status": "success", "data": jsonable_encoder(new_inv)}
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi hệ thống: {str(e)}")

@router.put("/{inv_id}/update", response_model=dict)
def update_investment_value(inv_id: int, val_in: InvestmentUpdateValue, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        updated_data = investment_service.update_value(db, inv_id, val_in, current_user.user_id)
        return {
            "status": "success",
            "data": updated_data
        }
    except ValueError as ve:
        status_c = 404 if "tìm thấy" in str(ve) else 400
        raise HTTPException(status_code=status_c, detail=str(ve))

@router.post("/{inv_id}/passive-income", response_model=dict)
def receive_passive_income(inv_id: int, inc_in: InvestmentPassiveIncome, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        result_data = investment_service.receive_passive_income(db, inv_id, inc_in, current_user.user_id)
        return {
            "status": "success",
            "message": "Đã ghi nhận dòng tiền thụ động",
            "data": result_data
        }
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi hệ thống: {str(e)}")

@router.post("/{inv_id}/transactions", response_model=dict)
def sell_investment(inv_id: int, sell_in: InvestmentSell, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        result_data = investment_service.sell(db, inv_id, sell_in, current_user.user_id)
        return {
            "status": "success",
            "message": "Đã bán tài sản thành công",
            "data": result_data
        }
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi hệ thống: {str(e)}")