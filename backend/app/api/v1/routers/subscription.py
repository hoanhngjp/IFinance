from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from fastapi.encoders import jsonable_encoder

from app.db.database import get_db
from app.models.user import User
from app.schemas.subscription import SubscriptionCreate, SubscriptionUpdate
from app.api.deps import get_current_user
from app.services.subscription_service import subscription_service

router = APIRouter()

@router.get("/", response_model=dict)
def get_subscriptions(
        active: bool = Query(True, description="Chỉ lấy các gói đang kích hoạt"),
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    subs = subscription_service.get_all(db, current_user.user_id, active)
    return {
        "status": "success",
        "data": jsonable_encoder(subs)
    }

@router.post("/", response_model=dict, status_code=status.HTTP_201_CREATED)
def create_subscription(
        sub_in: SubscriptionCreate,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    try:
        new_sub = subscription_service.create(db, sub_in, current_user.user_id)
        return {
            "status": "success",
            "data": jsonable_encoder(new_sub)
        }
    except ValueError as ve:
        status_c = 404 if "Không tìm thấy" in str(ve) else 400
        raise HTTPException(status_code=status_c, detail=str(ve))

@router.put("/{sub_id}", response_model=dict)
def update_subscription(
        sub_id: int,
        sub_in: SubscriptionUpdate,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    try:
        subscription_service.update(db, sub_id, sub_in, current_user.user_id)
        return {"status": "success", "message": "Đã cập nhật gói đăng ký"}
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))

@router.delete("/{sub_id}", response_model=dict)
def delete_subscription(
        sub_id: int,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    try:
        subscription_service.delete(db, sub_id, current_user.user_id)
        return {"status": "success", "message": "Đã hủy gói đăng ký"}
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))

@router.get("/detect/ai", response_model=dict)
def detect_subscriptions(
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    suggestions = subscription_service.detect_ai(db, current_user.user_id)
    return {
        "status": "success",
        "data": suggestions
    }