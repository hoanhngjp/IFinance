import logging
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import Optional
from datetime import date

from app.db.database import get_db
from app.models.user import User
from app.schemas.transaction import TransactionCreate, TransactionResponse, TransactionTransfer, TransactionUpdate
from app.api.deps import get_current_user
from app.services.transaction_service import transaction_service

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/", response_model=dict)
def get_transactions(
        page: int = Query(1, ge=1),
        size: int = Query(20, ge=1),
        type: Optional[str] = Query(None),
        wallet_id: Optional[int] = Query(None),
        category_id: Optional[int] = Query(None),
        start_date: Optional[date] = Query(None),
        end_date: Optional[date] = Query(None),
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    try:
        transactions, total = transaction_service.get_paginated(
            db, user_id=current_user.user_id, page=page, size=size,
            tx_type=type, wallet_id=wallet_id, category_id=category_id,
            start_date=start_date, end_date=end_date
        )
        return {
            "status": "success",
            "data": {
                "items": [TransactionResponse.model_validate(tx) for tx in transactions],
                "total": total,
                "page": page,
                "size": size
            }
        }
    except ValueError as ve:
        raise HTTPException(status_code=404 if "Không tìm thấy" in str(ve) else 400, detail=str(ve))

@router.post("/", response_model=dict, status_code=status.HTTP_201_CREATED)
def create_transaction(
        tx_in: TransactionCreate,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    try:
        new_tx = transaction_service.create(db, tx_in, current_user.user_id)
        return {
            "status": "success",
            "message": "Ghi nhận giao dịch thành công",
            "data": TransactionResponse.model_validate(new_tx)
        }
    except ValueError as ve:
        raise HTTPException(status_code=404 if "Không tìm thấy" in str(ve) else 400, detail=str(ve))
    except Exception:
        logger.exception("Lỗi khi tạo giao dịch user_id=%s", current_user.user_id)
        raise HTTPException(status_code=500, detail="Lỗi server, vui lòng thử lại.")

@router.post("/bulk", response_model=dict, status_code=status.HTTP_201_CREATED)
def create_bulk_transactions(
        tx_list: list[TransactionCreate],
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    try:
        inserted_count = transaction_service.create_bulk(db, tx_list, current_user.user_id)
        return {
            "status": "success",
            "message": f"Đã nhập thành công {inserted_count} giao dịch hàng loạt",
            "data": {"count": inserted_count}
        }
    except ValueError as ve:
        raise HTTPException(status_code=404 if "Không tìm thấy" in str(ve) else 400, detail=str(ve))
    except Exception:
        logger.exception("Lỗi khi nhập bulk giao dịch user_id=%s", current_user.user_id)
        raise HTTPException(status_code=500, detail="Lỗi server, vui lòng thử lại.")

@router.put("/{transaction_id}", response_model=dict)
def update_transaction(
        transaction_id: int,
        tx_in: TransactionUpdate,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    try:
        tx = transaction_service.update(db, transaction_id, tx_in, current_user.user_id)
        return {
            "status": "success",
            "message": "Cập nhật giao dịch thành công",
            "data": TransactionResponse.model_validate(tx)
        }
    except ValueError as ve:
        raise HTTPException(status_code=404 if "Không tìm thấy" in str(ve) else 400, detail=str(ve))

@router.delete("/{transaction_id}", response_model=dict)
def delete_transaction(
        transaction_id: int,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    try:
        transaction_service.delete(db, transaction_id, current_user.user_id)
        return {
            "status": "success",
            "message": "Đã xóa giao dịch và hoàn lại tiền ví thành công"
        }
    except ValueError as ve:
        raise HTTPException(status_code=404 if "Không tìm thấy" in str(ve) else 400, detail=str(ve))
    except Exception:
        logger.exception("Lỗi khi xóa giao dịch id=%s", transaction_id)
        raise HTTPException(status_code=500, detail="Lỗi server, vui lòng thử lại.")

@router.post("/transfer", response_model=dict)
def transfer_money(
        transfer_in: TransactionTransfer,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    try:
        tx_out_id, tx_in_id = transaction_service.transfer(db, transfer_in, current_user.user_id)
        return {
            "status": "success",
            "message": "Chuyển tiền thành công",
            "data": {"transaction_ids": [tx_out_id, tx_in_id]}
        }
    except ValueError as ve:
        raise HTTPException(status_code=404 if "Không tìm thấy" in str(ve) else 400, detail=str(ve))