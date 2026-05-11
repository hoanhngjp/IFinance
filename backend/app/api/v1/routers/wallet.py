import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.db.database import get_db
from app.models.user import User
from app.schemas.wallet import WalletCreate, WalletUpdate, WalletResponse
from app.api.deps import get_current_user
from app.services.wallet_service import wallet_service

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/summary", response_model=dict)
def get_wallet_summary(
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    try:
        summary_data = wallet_service.get_summary(db, current_user.user_id)
        return {
            "status": "success",
            "data": summary_data
        }
    except Exception:
        logger.exception("Lỗi server wallet")
        raise HTTPException(status_code=500, detail="Lỗi server, vui lòng thử lại.")

@router.get("/", response_model=dict)
def get_wallets(
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    wallets = wallet_service.get_all(db, current_user.user_id)
    return {
        "status": "success",
        "data": [WalletResponse.model_validate(w) for w in wallets]
    }

@router.post("/", response_model=dict, status_code=status.HTTP_201_CREATED)
def create_wallet(
        wallet_in: WalletCreate,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    try:
        new_wallet = wallet_service.create(db, wallet_in, current_user.user_id)
        return {
            "status": "success",
            "message": "Tạo ví thành công",
            "data": WalletResponse.model_validate(new_wallet)
        }
    except Exception:
        logger.exception("Lỗi server wallet")
        raise HTTPException(status_code=500, detail="Lỗi server, vui lòng thử lại.")

@router.put("/{wallet_id}", response_model=dict)
def update_wallet(
        wallet_id: int,
        wallet_in: WalletUpdate,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    try:
        updated_wallet = wallet_service.update(db, wallet_id, wallet_in, current_user.user_id)
        return {
            "status": "success",
            "message": "Cập nhật ví thành công",
            "data": WalletResponse.model_validate(updated_wallet)
        }
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception:
        logger.exception("Lỗi server wallet")
        raise HTTPException(status_code=500, detail="Lỗi server, vui lòng thử lại.")

@router.delete("/{wallet_id}", response_model=dict)
def delete_wallet(
        wallet_id: int,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    try:
        wallet_service.delete(db, wallet_id, current_user.user_id)
        return {
            "status": "success",
            "message": "Đã lưu trữ ví thành công"
        }
    except ValueError as ve:
        status_c = 404 if "Không tìm thấy" in str(ve) else 400
        raise HTTPException(status_code=status_c, detail=str(ve))
    except Exception:
        logger.exception("Lỗi server wallet")
        raise HTTPException(status_code=500, detail="Lỗi server, vui lòng thử lại.")