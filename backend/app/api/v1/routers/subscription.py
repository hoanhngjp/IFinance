from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date
from dateutil.relativedelta import relativedelta
from typing import List
from fastapi.encoders import jsonable_encoder

from app.db.database import get_db
from app.models.finance_modules import Subscription
from app.models.wallet_category import Wallet, Category
from app.models.transaction import Transaction
from app.models.user import User
from app.models.enums import TransactionType
from app.schemas.subscription import SubscriptionCreate, SubscriptionUpdate, SubscriptionResponse
from app.api.deps import get_current_user

router = APIRouter()


# 1. LẤY DANH SÁCH ĐĂNG KÝ
@router.get("/", response_model=dict)
def get_subscriptions(
        active: bool = Query(True, description="Chỉ lấy các gói đang kích hoạt"),
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    query = db.query(Subscription).filter(Subscription.user_id == current_user.user_id)

    if active is not None:
        query = query.filter(Subscription.is_active == active)

    subs = query.order_by(Subscription.next_due_date.asc()).all()

    return {
        "status": "success",
        "data": jsonable_encoder(subs)
    }


# 2. TẠO MỚI ĐĂNG KÝ
@router.post("/", response_model=dict, status_code=status.HTTP_201_CREATED)
def create_subscription(
        sub_in: SubscriptionCreate,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    # Ktra ví
    wallet = db.query(Wallet).filter(Wallet.wallet_id == sub_in.default_wallet_id,
                                     Wallet.user_id == current_user.user_id).first()
    if not wallet: raise HTTPException(status_code=404, detail="Không tìm thấy ví thanh toán")

    new_sub = Subscription(
        user_id=current_user.user_id,
        **sub_in.model_dump()
    )
    db.add(new_sub)
    db.commit()
    db.refresh(new_sub)

    return {
        "status": "success",
        "data": jsonable_encoder(new_sub)
    }


# 3. CẬP NHẬT GÓI ĐĂNG KÝ (Bao gồm Bật/Tắt is_active)
@router.put("/{sub_id}", response_model=dict)
def update_subscription(
        sub_id: int,
        sub_in: SubscriptionUpdate,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    sub = db.query(Subscription).filter(Subscription.subscription_id == sub_id,
                                        Subscription.user_id == current_user.user_id).first()
    if not sub: raise HTTPException(status_code=404, detail="Không tìm thấy gói đăng ký")

    update_data = sub_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(sub, key, value)

    db.commit()
    return {"status": "success", "message": "Đã cập nhật gói đăng ký"}


# 4. XÓA GÓI ĐĂNG KÝ (SOFT DELETE)
@router.delete("/{sub_id}", response_model=dict)
def delete_subscription(
        sub_id: int,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    sub = db.query(Subscription).filter(Subscription.subscription_id == sub_id,
                                        Subscription.user_id == current_user.user_id).first()
    if not sub: raise HTTPException(status_code=404, detail="Không tìm thấy gói đăng ký")

    # Chỉ tắt cờ is_active để giữ lại lịch sử Transaction
    sub.is_active = False
    sub.next_due_date = None
    db.commit()

    return {"status": "success", "message": "Đã hủy gói đăng ký"}


# 5. AI DETECT - PHÂN TÍCH LỊCH SỬ GIAO DỊCH TÌM SUBSCRIPTION
@router.get("/detect/ai", response_model=dict)
def detect_subscriptions(
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    three_months_ago = date.today() - relativedelta(months=3)

    # Gom nhóm các khoản chi phí giống hệt nhau về số tiền và danh mục
    potential_subs = db.query(
        Transaction.category_id,
        Transaction.amount,
        func.count(Transaction.transaction_id).label('frequency_count'),
        func.max(Transaction.date).label('last_payment_date')
    ).filter(
        Transaction.user_id == current_user.user_id,
        Transaction.transaction_type == TransactionType.expense,
        Transaction.date >= three_months_ago
    ).group_by(
        Transaction.category_id,
        Transaction.amount
    ).having(
        func.count(Transaction.transaction_id) >= 2  # Nếu lặp lại từ 2 lần trở lên -> Nghi ngờ là Sub
    ).all()

    suggestions = []
    for sub in potential_subs:
        # Kiểm tra xem khoản này đã được add vào bảng subscriptions chưa
        existing = db.query(Subscription).filter(
            Subscription.user_id == current_user.user_id,
            Subscription.amount == sub.amount,
            Subscription.category_id == sub.category_id,
            Subscription.is_active == True
        ).first()

        if not existing:
            cat = db.query(Category).filter(Category.category_id == sub.category_id).first()
            category_name = cat.name if cat else "Khác"

            # TRUY VẤN BỔ SUNG: Lấy ghi chú (note) của giao dịch gần nhất thuộc nhóm này
            latest_tx = db.query(Transaction).filter(
                Transaction.user_id == current_user.user_id,
                Transaction.category_id == sub.category_id,
                Transaction.amount == sub.amount
            ).order_by(Transaction.date.desc()).first()

            # Nếu có ghi chú, trích xuất ra để AI nhắc nhở người dùng
            note_snippet = f" (Ghi chú gần nhất: '{latest_tx.note}')" if latest_tx and latest_tx.note else ""

            suggestions.append({
                "category_id": sub.category_id,
                "category_name": category_name,
                "suggested_amount": float(sub.amount),
                "confidence_score": 0.85 if sub.frequency_count >= 3 else 0.6,
                "message": f"Bạn đã chi {float(sub.amount):,.0f}đ cho danh mục [{category_name}]{note_snippet} lặp lại {sub.frequency_count} lần gần đây. Đây có phải là khoản đóng định kỳ không?"
            })

    return {
        "status": "success",
        "data": suggestions
    }