from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import date
from decimal import Decimal

from app.db.database import get_db
from app.models.finance_modules import Investment
from app.models.wallet_category import Wallet
from app.models.transaction import Transaction
from app.models.user import User
from app.models.enums import TransactionType
from app.schemas.investment import InvestmentCreate, InvestmentUpdateValue, InvestmentSell, InvestmentResponse
from app.api.deps import get_current_user
from fastapi.encoders import jsonable_encoder

router = APIRouter()

# 1. LẤY DANH SÁCH ĐẦU TƯ
@router.get("/", response_model=dict)
def get_investments(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    investments = db.query(Investment).filter(Investment.user_id == current_user.user_id).all()
    return {"status": "success", "data": jsonable_encoder(investments)}

# 2. MUA TÀI SẢN (Tạo mới)
@router.post("/", response_model=dict, status_code=status.HTTP_201_CREATED)
def create_investment(inv_in: InvestmentCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    wallet = db.query(Wallet).filter(Wallet.wallet_id == inv_in.wallet_id, Wallet.user_id == current_user.user_id).first()
    if not wallet or wallet.balance < inv_in.principal_amount:
        raise HTTPException(status_code=400, detail="Ví không tồn tại hoặc không đủ số dư")

    try:
        # Trừ tiền ví
        wallet.balance -= inv_in.principal_amount

        # Tạo Transaction Chi phí (Category 28: Đầu tư tài sản)
        new_tx = Transaction(
            user_id=current_user.user_id,
            wallet_id=inv_in.wallet_id,
            category_id=28,
            amount=inv_in.principal_amount,
            transaction_type=TransactionType.expense,
            date=inv_in.start_date or date.today(),
            note=f"Mua tài sản đầu tư: {inv_in.name}"
        )
        db.add(new_tx)

        # Ghi nhận danh mục Đầu tư (Mặc định current_value = principal_amount lúc mới mua)
        new_inv = Investment(
            user_id=current_user.user_id,
            current_value=inv_in.principal_amount,
            **inv_in.model_dump()
        )
        db.add(new_inv)
        db.commit()
        db.refresh(new_inv)

        return {"status": "success", "data": jsonable_encoder(new_inv)}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi hệ thống: {str(e)}")

# 3. CẬP NHẬT GIÁ TRỊ THỊ TRƯỜNG (Unrealized PnL)
@router.put("/{inv_id}/update", response_model=dict)
def update_investment_value(inv_id: int, val_in: InvestmentUpdateValue, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    inv = db.query(Investment).filter(Investment.investment_id == inv_id, Investment.user_id == current_user.user_id).first()
    if not inv: raise HTTPException(status_code=404, detail="Không tìm thấy tài sản")

    inv.current_value = val_in.current_value
    db.commit()

    profit = inv.current_value - inv.principal_amount
    roi = (profit / inv.principal_amount) * 100 if inv.principal_amount > 0 else 0

    return {
        "status": "success",
        "data": {"current_value": inv.current_value, "profit": profit, "roi": round(float(roi), 2)}
    }

# 4. BÁN / CHỐT LỜI (Thanh lý tài sản)
@router.post("/{inv_id}/sell", response_model=dict)
def sell_investment(inv_id: int, sell_in: InvestmentSell, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    inv = db.query(Investment).filter(Investment.investment_id == inv_id, Investment.user_id == current_user.user_id).first()
    if not inv: raise HTTPException(status_code=404, detail="Không tìm thấy tài sản")

    wallet = db.query(Wallet).filter(Wallet.wallet_id == sell_in.wallet_id, Wallet.user_id == current_user.user_id).first()
    if not wallet: raise HTTPException(status_code=404, detail="Không tìm thấy ví nhận tiền")

    try:
        # Cộng tiền vào ví
        wallet.balance += sell_in.selling_price

        # Tạo Transaction Thu nhập (Category 29: Lợi nhuận đầu tư)
        new_tx = Transaction(
            user_id=current_user.user_id,
            wallet_id=sell_in.wallet_id,
            category_id=29,
            amount=sell_in.selling_price,
            transaction_type=TransactionType.income,
            date=sell_in.date,
            note=sell_in.note or f"Bán tài sản: {inv.name}"
        )
        db.add(new_tx)

        profit = sell_in.selling_price - inv.principal_amount
        roi = (profit / inv.principal_amount) * 100 if inv.principal_amount > 0 else 0

        # Xóa tài sản khỏi danh mục Hold
        db.delete(inv)
        db.commit()

        return {
            "status": "success",
            "message": "Đã bán tài sản thành công",
            "data": {"profit": profit, "roi": round(float(roi), 2)}
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi hệ thống: {str(e)}")