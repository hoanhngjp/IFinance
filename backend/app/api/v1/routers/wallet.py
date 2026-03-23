from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.db.database import get_db
from app.models.wallet_category import Wallet
from app.models.user import User
from app.schemas.wallet import WalletCreate, WalletUpdate, WalletResponse
from app.api.deps import get_current_user

router = APIRouter()


@router.post("/", response_model=dict, status_code=status.HTTP_201_CREATED)
def create_wallet(
        wallet_in: WalletCreate,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    new_wallet = Wallet(
        user_id=current_user.user_id,
        name=wallet_in.name,
        type=wallet_in.type,
        currency=wallet_in.currency,
        balance=0  # Ví mới tạo mặc định số dư = 0
    )
    db.add(new_wallet)
    db.commit()
    db.refresh(new_wallet)

    return {
        "status": "success",
        "message": "Tạo ví thành công",
        "data": WalletResponse.model_validate(new_wallet)
    }


@router.get("/", response_model=dict)
def get_wallets(
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    wallets = db.query(Wallet).filter(Wallet.user_id == current_user.user_id).all()
    return {
        "status": "success",
        "data": [WalletResponse.model_validate(w) for w in wallets]
    }


@router.delete("/{wallet_id}", response_model=dict)
def delete_wallet(
        wallet_id: int,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    wallet = db.query(Wallet).filter(Wallet.wallet_id == wallet_id, Wallet.user_id == current_user.user_id).first()
    if not wallet:
        raise HTTPException(status_code=404, detail="Không tìm thấy ví")

    db.delete(wallet)
    db.commit()
    return {"status": "success", "message": "Xóa ví thành công"}