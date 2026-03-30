from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from decimal import Decimal

from app.db.database import get_db
from app.models.wallet_category import Wallet, Category
from app.models.transaction import Transaction
from app.models.user import User
from app.models.enums import WalletType, TransactionType
from app.schemas.wallet import WalletCreate, WalletUpdate, WalletResponse
from app.api.deps import get_current_user

router = APIRouter()

@router.get("/summary", response_model=dict)
def get_wallet_summary(
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """
    Lấy báo cáo tổng quan tài sản ròng (Net Worth).
    Phục vụ cho biểu đồ Dashboard.
    """
    # DÙNG filter_by THAY CHO filter
    wallets = db.query(Wallet).filter_by(
        user_id=current_user.user_id,
        is_active=True
    ).all()

    # Tài sản là các ví tiền mặt/ngân hàng có số dư > 0
    total_assets = sum((w.balance for w in wallets if w.balance > 0 and w.type != WalletType.credit), Decimal('0.0'))

    # Tiêu sản (Dư nợ) là các ví bị âm tiền hoặc dư nợ thẻ tín dụng
    total_liabilities = sum((abs(w.balance) for w in wallets if w.balance < 0), Decimal('0.0'))

    net_worth = total_assets - total_liabilities

    return {
        "status": "success",
        "data": {
            "total_assets": float(total_assets),
            "total_liabilities": float(total_liabilities),
            "net_worth": float(net_worth)
        }
    }


@router.get("/", response_model=dict)
def get_wallets(
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """Lấy danh sách các ví đang hoạt động của User"""
    wallets = db.query(Wallet).filter_by(
        user_id=current_user.user_id,
        is_active=True
    ).all()

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
    """Tạo ví mới và khởi tạo số dư ban đầu nếu có"""
    new_wallet = Wallet(
        user_id=current_user.user_id,
        name=wallet_in.name,
        type=wallet_in.type,
        currency=wallet_in.currency,
        balance=Decimal(str(wallet_in.initial_balance)),
        credit_limit=Decimal(str(wallet_in.credit_limit)),
        is_active=True
    )
    db.add(new_wallet)
    db.flush()  # Lưu xuống DB để lấy wallet_id nhưng chưa commit

    # Tạo Transaction ngầm nếu có số dư ban đầu
    if wallet_in.initial_balance > 0:
        # Dùng filter_by an toàn tuyệt đối với linter
        sys_cat = db.query(Category).filter_by(
            user_id=None,
            name="Thu nhập khác"
        ).first()

        cat_id = sys_cat.category_id if sys_cat else 1

        initial_tx = Transaction(
            user_id=current_user.user_id,
            wallet_id=new_wallet.wallet_id,
            category_id=cat_id,
            transaction_type=TransactionType.income,
            amount=Decimal(str(wallet_in.initial_balance)),
            note="Khởi tạo số dư ban đầu"
        )
        db.add(initial_tx)

    db.commit()
    db.refresh(new_wallet)

    return {
        "status": "success",
        "message": "Tạo ví thành công",
        "data": WalletResponse.model_validate(new_wallet)
    }

@router.put("/{wallet_id}", response_model=dict)
def update_wallet(
        wallet_id: int,
        wallet_in: WalletUpdate,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """Cập nhật metadata của ví (Không cập nhật balance)"""
    wallet = db.query(Wallet).filter_by(
        wallet_id=wallet_id,
        user_id=current_user.user_id,
        is_active=True
    ).first()

    if not wallet:
        raise HTTPException(status_code=404, detail="Không tìm thấy ví")

    if wallet_in.name is not None:
        wallet.name = wallet_in.name
    if wallet_in.type is not None:
        wallet.type = wallet_in.type
    if wallet_in.credit_limit is not None:
        wallet.credit_limit = Decimal(str(wallet_in.credit_limit))

    db.commit()
    db.refresh(wallet)

    return {
        "status": "success",
        "message": "Cập nhật ví thành công",
        "data": WalletResponse.model_validate(wallet)
    }

@router.delete("/{wallet_id}", response_model=dict)
def delete_wallet(
        wallet_id: int,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """Xóa mềm (Soft Delete) ví, ẩn đi nhưng vẫn giữ lịch sử giao dịch"""
    wallet = db.query(Wallet).filter_by(
        wallet_id=wallet_id,
        user_id=current_user.user_id,
        is_active=True
    ).first()

    if not wallet:
        raise HTTPException(status_code=404, detail="Không tìm thấy ví")

    # Kiểm tra xem ví có đang nợ tiền không (chặn xóa nếu balance < 0)
    if wallet.balance < 0:
        raise HTTPException(status_code=400, detail="Không thể xóa ví đang có dư nợ. Vui lòng thanh toán hết nợ trước.")

    wallet.is_active = False
    db.commit()

    return {
        "status": "success",
        "message": "Đã lưu trữ ví thành công"
    }