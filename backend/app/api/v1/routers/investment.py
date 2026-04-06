from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import date
from decimal import Decimal
import pandas as pd

from app.db.database import get_db
from app.models.finance_modules import Investment
from app.models.wallet_category import Wallet, Category
from app.models.transaction import Transaction
from app.models.user import User
from app.models.enums import TransactionType
from app.schemas.investment import (
    InvestmentCreate, InvestmentUpdateValue, InvestmentSell,
    InvestmentPassiveIncome
)
from app.api.deps import get_current_user
from fastapi.encoders import jsonable_encoder

router = APIRouter()


# 1. LẤY DANH SÁCH ĐẦU TƯ
@router.get("/", response_model=dict)
def get_investments(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    investments = db.query(Investment).filter(Investment.user_id == current_user.user_id).order_by(
        Investment.start_date.desc()).all()
    return {"status": "success", "data": jsonable_encoder(investments)}


# 2. DỮ LIỆU BIỂU ĐỒ PHÂN BỔ VÀ XU HƯỚNG
@router.get("/analytics", response_model=dict)
def get_investment_analytics(timeframe: str = "1Y", db: Session = Depends(get_db),
                             current_user: User = Depends(get_current_user)):
    investments = db.query(Investment).filter(Investment.user_id == current_user.user_id).all()

    if not investments:
        return {"status": "success", "data": {"allocation": [], "trend": []}}

    data = [
        {"type": inv.type.value if hasattr(inv.type, 'value') else inv.type, "current_value": float(inv.current_value)}
        for inv in investments]
    df = pd.DataFrame(data)

    allocation_df = df.groupby("type")["current_value"].sum().reset_index()
    total_value = allocation_df["current_value"].sum()
    allocation_df["percent"] = (allocation_df["current_value"] / total_value) * 100

    allocation_df["percent"] = allocation_df["percent"].round(2)
    allocation_data = allocation_df.to_dict("records")

    return {
        "status": "success",
        "data": {
            "allocation": allocation_data,
            "trend": []  # Placeholder cho Biến động PnL
        }
    }


# 3. XEM CHI TIẾT VÀ LỊCH SỬ VÒNG ĐỜI TÀI SẢN
@router.get("/{inv_id}", response_model=dict)
def get_investment_detail(inv_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    inv = db.query(Investment).filter(Investment.investment_id == inv_id,
                                      Investment.user_id == current_user.user_id).first()
    if not inv: raise HTTPException(status_code=404, detail="Không tìm thấy tài sản")

    # [FIX 3]: Truy vấn lịch sử giao dịch liên quan bằng cách tìm tên tài sản trong Note
    transactions = db.query(Transaction).filter(
        Transaction.user_id == current_user.user_id,
        Transaction.note.ilike(f"%{inv.name}%")
    ).order_by(Transaction.date.desc()).all()

    unrealized_pnl = float(inv.current_value) - float(inv.principal_amount)

    return {
        "status": "success",
        "data": {
            "investment": jsonable_encoder(inv),
            "transactions": jsonable_encoder(transactions),
            "unrealized_pnl": unrealized_pnl
        }
    }


# 4. MUA TÀI SẢN (Tạo mới)
@router.post("/", response_model=dict, status_code=status.HTTP_201_CREATED)
def create_investment(inv_in: InvestmentCreate, db: Session = Depends(get_db),
                      current_user: User = Depends(get_current_user)):
    wallet = db.query(Wallet).filter(Wallet.wallet_id == inv_in.wallet_id,
                                     Wallet.user_id == current_user.user_id).first()

    # [FIX 4]: Ép kiểu Decimal an toàn
    fee = Decimal(str(getattr(inv_in, 'fee', 0)))
    tax = Decimal(str(getattr(inv_in, 'tax', 0)))
    principal = Decimal(str(inv_in.principal_amount))
    total_cost = principal + fee + tax

    current_balance = Decimal(str(wallet.balance or 0)) if wallet else 0

    if not wallet or current_balance < total_cost:
        raise HTTPException(status_code=400, detail="Ví không tồn tại hoặc không đủ số dư để chịu vốn và phí")

    # Tìm ID danh mục "Đầu tư tài sản"
    cat_invest = db.query(Category).filter(Category.name == "Đầu tư tài sản").first()
    cat_id = cat_invest.category_id if cat_invest else 28

    try:
        wallet.balance = current_balance - total_cost

        # [FIX 1]: Sử dụng đúng TransactionType.investment_in
        new_tx = Transaction(
            user_id=current_user.user_id,
            wallet_id=inv_in.wallet_id,
            category_id=cat_id,
            amount=total_cost,
            transaction_type=TransactionType.investment_in,
            date=getattr(inv_in, 'start_date', date.today()),
            note=f"Mua tài sản: {inv_in.name} (Vốn: {inv_in.principal_amount}, Phí/Thuế: {fee + tax})"
        )
        db.add(new_tx)

        inv_data = inv_in.model_dump(exclude={'fee', 'tax'} if hasattr(inv_in, 'fee') else None)
        new_inv = Investment(
            user_id=current_user.user_id,
            current_value=inv_in.principal_amount,
            **inv_data
        )
        db.add(new_inv)
        db.commit()
        db.refresh(new_inv)

        return {"status": "success", "data": jsonable_encoder(new_inv)}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi hệ thống: {str(e)}")


# 5. CẬP NHẬT GIÁ TRỊ THỊ TRƯỜNG (Unrealized PnL)
@router.put("/{inv_id}/update", response_model=dict)
def update_investment_value(inv_id: int, val_in: InvestmentUpdateValue, db: Session = Depends(get_db),
                            current_user: User = Depends(get_current_user)):
    inv = db.query(Investment).filter(Investment.investment_id == inv_id,
                                      Investment.user_id == current_user.user_id).first()
    if not inv: raise HTTPException(status_code=404, detail="Không tìm thấy tài sản")

    new_value = Decimal(str(val_in.current_value))
    if new_value < 0: raise HTTPException(status_code=400, detail="Giá trị thị trường không được âm")

    inv.current_value = new_value
    db.commit()

    profit = float(inv.current_value) - float(inv.principal_amount)
    roi = (profit / float(inv.principal_amount)) * 100 if inv.principal_amount > 0 else 0

    return {
        "status": "success",
        "data": {"current_value": float(inv.current_value), "profit": profit, "profit_percent": round(float(roi), 2)}
    }


# 6. NHẬN DÒNG TIỀN THỤ ĐỘNG (Cổ tức / Lãi suất)
@router.post("/{inv_id}/passive-income", response_model=dict)
def receive_passive_income(inv_id: int, inc_in: InvestmentPassiveIncome, db: Session = Depends(get_db),
                           current_user: User = Depends(get_current_user)):
    inv = db.query(Investment).filter(Investment.investment_id == inv_id,
                                      Investment.user_id == current_user.user_id).first()
    if not inv: raise HTTPException(status_code=404, detail="Không tìm thấy tài sản")

    wallet = db.query(Wallet).filter(Wallet.wallet_id == inc_in.wallet_id,
                                     Wallet.user_id == current_user.user_id).first()
    if not wallet: raise HTTPException(status_code=404, detail="Không tìm thấy ví nhận tiền")

    try:
        inc_amount = Decimal(str(inc_in.amount))
        wallet.balance = Decimal(str(wallet.balance or 0)) + inc_amount

        if hasattr(inv, 'total_passive_income'):
            inv.total_passive_income = Decimal(str(inv.total_passive_income or 0)) + inc_amount

        cat_profit = db.query(Category).filter(Category.name == "Lợi nhuận đầu tư").first()
        cat_id = cat_profit.category_id if cat_profit else 29

        # [FIX 1]: Sử dụng đúng TransactionType.investment_return
        new_tx = Transaction(
            user_id=current_user.user_id,
            wallet_id=inc_in.wallet_id,
            category_id=cat_id,
            amount=inc_amount,
            transaction_type=TransactionType.investment_return,
            date=getattr(inc_in, 'date', date.today()),
            note=inc_in.description or f"Nhận lãi/cổ tức từ: {inv.name}"
        )
        db.add(new_tx)
        db.commit()

        return {
            "status": "success",
            "message": "Đã ghi nhận dòng tiền thụ động",
            "data": {
                "transaction_id": new_tx.transaction_id,
                "total_passive": float(getattr(inv, 'total_passive_income', inc_amount))
            }
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi hệ thống: {str(e)}")


# 7. BÁN / CHỐT LỜI (Tạo Transaction & Thanh lý)
@router.post("/{inv_id}/transactions", response_model=dict)
def sell_investment(inv_id: int, sell_in: InvestmentSell, db: Session = Depends(get_db),
                    current_user: User = Depends(get_current_user)):
    inv = db.query(Investment).filter(Investment.investment_id == inv_id,
                                      Investment.user_id == current_user.user_id).first()
    if not inv: raise HTTPException(status_code=404, detail="Không tìm thấy tài sản")

    wallet = db.query(Wallet).filter(Wallet.wallet_id == sell_in.wallet_id,
                                     Wallet.user_id == current_user.user_id).first()
    if not wallet: raise HTTPException(status_code=404, detail="Không tìm thấy ví nhận tiền")

    try:
        fee = Decimal(str(getattr(sell_in, 'fee', 0)))
        tax = Decimal(str(getattr(sell_in, 'tax', 0)))
        selling_price = Decimal(str(sell_in.selling_price))

        net_receive = selling_price - fee - tax
        wallet.balance = Decimal(str(wallet.balance or 0)) + net_receive

        cat_profit = db.query(Category).filter(Category.name == "Lợi nhuận đầu tư").first()
        cat_id = cat_profit.category_id if cat_profit else 29

        # [FIX 1]: Sử dụng đúng TransactionType.investment_return
        new_tx = Transaction(
            user_id=current_user.user_id,
            wallet_id=sell_in.wallet_id,
            category_id=cat_id,
            amount=net_receive,
            transaction_type=TransactionType.investment_return,
            date=getattr(sell_in, 'date', date.today()),
            note=getattr(sell_in, 'note',
                         f"Bán tài sản: {inv.name} (Bán: {sell_in.selling_price}, Phí/Thuế: {fee + tax})")
        )
        db.add(new_tx)

        profit = float(net_receive) - float(inv.principal_amount)
        roi = (profit / float(inv.principal_amount)) * 100 if inv.principal_amount > 0 else 0

        db.flush()
        tx_id = new_tx.transaction_id

        # Thanh lý (Xóa tài sản khỏi danh mục Hold)
        db.delete(inv)
        db.commit()

        return {
            "status": "success",
            "message": "Đã bán tài sản thành công",
            "data": {
                "profit": profit,
                "roi": round(float(roi), 2),
                "transaction_id": tx_id
            }
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi hệ thống: {str(e)}")