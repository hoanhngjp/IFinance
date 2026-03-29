from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import date
from decimal import Decimal
import pandas as pd

from app.db.database import get_db
from app.models.finance_modules import Investment
from app.models.wallet_category import Wallet
from app.models.transaction import Transaction
from app.models.user import User
from app.models.enums import TransactionType
# Lưu ý: Bạn cần cập nhật lại file schemas để bổ sung các trường fee, tax, amount, description...
from app.schemas.investment import (
    InvestmentCreate, InvestmentUpdateValue, InvestmentSell,
    InvestmentPassiveIncome  # Schema mới cần tạo
)
from app.api.deps import get_current_user
from fastapi.encoders import jsonable_encoder

router = APIRouter()


# 1. LẤY DANH SÁCH ĐẦU TƯ
@router.get("/", response_model=dict)
def get_investments(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    investments = db.query(Investment).filter(Investment.user_id == current_user.user_id).all()
    return {"status": "success", "data": jsonable_encoder(investments)}


# 2. DỮ LIỆU BIỂU ĐỒ PHÂN BỔ VÀ XU HƯỚNG (Analytics)
# Route này phải đặt trước /{inv_id} để tránh bị override
@router.get("/analytics", response_model=dict)
def get_investment_analytics(timeframe: str = "1Y", db: Session = Depends(get_db),
                             current_user: User = Depends(get_current_user)):
    investments = db.query(Investment).filter(Investment.user_id == current_user.user_id).all()

    if not investments:
        return {"status": "success", "data": {"allocation": [], "trend": []}}

    # Dùng Pandas để tính toán tỷ trọng phân bổ (Pie Chart)
    data = [{"type": inv.type, "current_value": float(inv.current_value)} for inv in investments]
    df = pd.DataFrame(data)

    allocation_df = df.groupby("type")["current_value"].sum().reset_index()
    total_value = allocation_df["current_value"].sum()
    allocation_df["percent"] = (allocation_df["current_value"] / total_value) * 100

    # Làm tròn 2 chữ số thập phân
    allocation_df["percent"] = allocation_df["percent"].round(2)
    allocation_data = allocation_df.to_dict("records")

    # Trend có thể query thêm từ bảng PnL history hoặc logs (Tạm thời trả mảng rỗng hoặc mock data)
    trend_data = []

    return {
        "status": "success",
        "data": {
            "allocation": allocation_data,
            "trend": trend_data
        }
    }


# 3. XEM CHI TIẾT VÀ LỊCH SỬ VÒNG ĐỜI TÀI SẢN
@router.get("/{inv_id}", response_model=dict)
def get_investment_detail(inv_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    inv = db.query(Investment).filter(Investment.investment_id == inv_id,
                                      Investment.user_id == current_user.user_id).first()
    if not inv: raise HTTPException(status_code=404, detail="Không tìm thấy tài sản")

    # Tùy thuộc vào thiết kế DB, bạn có thể query thêm các transaction liên quan đến investment_id này
    # Ví dụ: transactions = db.query(Transaction).filter(Transaction.investment_id == inv_id).all()
    transactions = []

    unrealized_pnl = float(inv.current_value) - float(inv.principal_amount)

    return {
        "status": "success",
        "data": {
            "investment": jsonable_encoder(inv),
            "transactions": transactions,
            "unrealized_pnl": unrealized_pnl
        }
    }


# 4. MUA TÀI SẢN (Tạo mới)
@router.post("/", response_model=dict, status_code=status.HTTP_201_CREATED)
def create_investment(inv_in: InvestmentCreate, db: Session = Depends(get_db),
                      current_user: User = Depends(get_current_user)):
    wallet = db.query(Wallet).filter(Wallet.wallet_id == inv_in.wallet_id,
                                     Wallet.user_id == current_user.user_id).first()

    # Tổng chi phí = Vốn gốc + Phí + Thuế (nếu có)
    fee = getattr(inv_in, 'fee', 0)
    tax = getattr(inv_in, 'tax', 0)
    total_cost = inv_in.principal_amount + fee + tax

    if not wallet or wallet.balance < total_cost:
        raise HTTPException(status_code=400, detail="Ví không tồn tại hoặc không đủ số dư để chịu vốn và phí")

    try:
        wallet.balance -= total_cost

        # Tạo Transaction Chi phí mua tài sản
        new_tx = Transaction(
            user_id=current_user.user_id,
            wallet_id=inv_in.wallet_id,
            category_id=28,  # Giả định category Đầu tư
            amount=total_cost,
            transaction_type=TransactionType.expense,
            date=getattr(inv_in, 'start_date', date.today()),
            note=f"Mua tài sản: {inv_in.name} (Vốn: {inv_in.principal_amount}, Phí/Thuế: {fee + tax})"
        )
        db.add(new_tx)

        # Trích xuất dữ liệu schema để tạo model (loại bỏ fee/tax nếu bảng Investment không lưu)
        inv_data = inv_in.model_dump(exclude={'fee', 'tax'} if hasattr(inv_in, 'fee') else None)

        new_inv = Investment(
            user_id=current_user.user_id,
            current_value=inv_in.principal_amount,  # current value ban đầu thường bằng vốn lõi
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
    if val_in.current_value < 0: raise HTTPException(status_code=400, detail="Giá trị thị trường không được âm")

    inv.current_value = val_in.current_value
    db.commit()

    profit = float(inv.current_value) - float(inv.principal_amount)
    roi = (profit / float(inv.principal_amount)) * 100 if inv.principal_amount > 0 else 0

    return {
        "status": "success",
        "data": {"current_value": inv.current_value, "profit": profit, "profit_percent": round(float(roi), 2)}
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
        wallet.balance += inc_in.amount

        # Cập nhật tổng passive income của tài sản (Cần thêm cột total_passive_income vào model Investment)
        if hasattr(inv, 'total_passive_income'):
            inv.total_passive_income = float(inv.total_passive_income or 0) + float(inc_in.amount)

        new_tx = Transaction(
            user_id=current_user.user_id,
            wallet_id=inc_in.wallet_id,
            category_id=29,  # Giả định category Lợi nhuận
            amount=inc_in.amount,
            transaction_type=TransactionType.income,
            date=getattr(inc_in, 'date', date.today()),
            note=inc_in.description or f"Nhận lãi/cổ tức từ: {inv.name}"
        )
        db.add(new_tx)
        db.commit()
        db.refresh(new_tx)

        return {
            "status": "success",
            "message": "Đã ghi nhận dòng tiền thụ động",
            "data": {
                "transaction_id": new_tx.transaction_id,
                "total_passive": getattr(inv, 'total_passive_income', inc_in.amount)
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
        fee = getattr(sell_in, 'fee', 0)
        tax = getattr(sell_in, 'tax', 0)

        # Thực nhận về ví = Giá bán - Phí - Thuế
        net_receive = sell_in.selling_price - fee - tax
        wallet.balance += net_receive

        new_tx = Transaction(
            user_id=current_user.user_id,
            wallet_id=sell_in.wallet_id,
            category_id=29,  # Thu nhập đầu tư
            amount=net_receive,
            transaction_type=TransactionType.income,
            date=getattr(sell_in, 'date', date.today()),
            note=getattr(sell_in, 'note',
                         f"Bán tài sản: {inv.name} (Bán: {sell_in.selling_price}, Phí/Thuế: {fee + tax})")
        )
        db.add(new_tx)

        # Lợi nhuận = Thực nhận - Vốn gốc
        profit = float(net_receive) - float(inv.principal_amount)
        roi = (profit / float(inv.principal_amount)) * 100 if inv.principal_amount > 0 else 0

        # Lưu lại transaction id để return
        db.flush()
        tx_id = new_tx.transaction_id

        # Tùy logic của bạn: Xóa tài sản, hoặc đổi status sang 'sold' để giữ lịch sử
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