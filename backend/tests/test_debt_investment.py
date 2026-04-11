import pytest
from datetime import date
from decimal import Decimal

from app.models.enums import WalletType, DebtType, InvestmentType
from app.schemas.wallet import WalletCreate
from app.schemas.debt import DebtCreate, DebtRepaymentCreate
from app.schemas.investment import InvestmentCreate, InvestmentSell, InvestmentPassiveIncome

from app.services.wallet_service import wallet_service
from app.services.debt_service import debt_service
from app.services.investment_service import investment_service

# ===============================================
# TC-06: Tạo khoản Nợ (Receivable - Cho vay)
# ===============================================
def test_create_receivable_debt(db_session, test_user, test_category):
    # Khởi tạo ví tiền mặt có 100k
    w_cash = wallet_service.create(db_session, WalletCreate(name="Cash", type=WalletType.cash, initial_balance=100000, currency="VND"), test_user.user_id)

    # HP: Cho anh Tuấn vay 30k
    debt_in = DebtCreate(
        creditor_name="Anh Tuấn", 
        type=DebtType.receivable, 
        total_amount=30000, 
        wallet_id=w_cash.wallet_id, 
        category_id=test_category.category_id,
        due_date=date.today()
    )
    new_debt = debt_service.create_debt(db_session, debt_in, test_user.user_id)

    # Kì vọng: Ví tiền mặt bị giảm 30k (còn 70k)
    assert new_debt.remaining_amount == 30000
    assert w_cash.balance == 70000

    # UP: Thử cho vay 200k (ví không đủ tiền)
    with pytest.raises(ValueError, match="Ví không đủ số dư"):
        debt_in_fail = DebtCreate(
            creditor_name="Anh Bình", 
            type=DebtType.receivable, 
            total_amount=200000, 
            wallet_id=w_cash.wallet_id, 
            category_id=test_category.category_id
        )
        debt_service.create_debt(db_session, debt_in_fail, test_user.user_id)

# ===============================================
# TC-07: Trả Nợ / Thu Nợ (Repayment)
# ===============================================
def test_repay_debt(db_session, test_user, test_category):
    # Khởi tạo ví và khoản nợ (Vay của ngân hàng 50k - Payable)
    w_bank = wallet_service.create(db_session, WalletCreate(name="Bank", type=WalletType.bank, initial_balance=20000, currency="VND"), test_user.user_id)
    
    # Việc tạo Payable (đi vay) sẽ CỘNG tiền vào ví Bank. (Số dư mới ví Bank: 20k + 50k = 70k)
    debt_in = DebtCreate(
        creditor_name="Ngân hàng", 
        type=DebtType.payable, 
        total_amount=50000, 
        wallet_id=w_bank.wallet_id, 
        category_id=test_category.category_id
    )
    new_debt = debt_service.create_debt(db_session, debt_in, test_user.user_id)
    assert w_bank.balance == 70000
    assert new_debt.remaining_amount == 50000

    # HP: Trả ngân hàng 10k -> Trừ ví 10k, nợ giảm còn 40k
    repay_in = DebtRepaymentCreate(
        amount=10000,
        wallet_id=w_bank.wallet_id,
        category_id=test_category.category_id,
        date=date.today(),
        note="Trả góp đợt 1"
    )
    debt_service.repay_debt(db_session, new_debt.debt_id, repay_in, test_user.user_id)
    assert w_bank.balance == 60000
    assert new_debt.remaining_amount == 40000

    # UP: Trả 60k cho khoản nợ chỉ còn 40k -> Chặn
    with pytest.raises(ValueError, match="Số tiền trả không được lớn hơn số nợ còn lại"):
        repay_up = DebtRepaymentCreate(amount=60000, wallet_id=w_bank.wallet_id, category_id=test_category.category_id, date=date.today())
        debt_service.repay_debt(db_session, new_debt.debt_id, repay_up, test_user.user_id)

# ===============================================
# TC-08 & TC-09: Đầu tư (Mở, Passive Income, Bán Chốt lời)
# ===============================================
def test_investment_lifecycle(db_session, test_user):
    w_cash = wallet_service.create(db_session, WalletCreate(name="Cash", type=WalletType.cash, initial_balance=500000, currency="VND"), test_user.user_id)
    
    # 1. Mua Vàng SJC (TC-08)
    # Vốn = 100k, phí + thuế = 10k -> Phải trừ ví 110k (còn 390k)
    inv_in = InvestmentCreate(
        wallet_id=w_cash.wallet_id,
        name="Vàng SJC",
        type=InvestmentType.gold,
        quantity=Decimal('2.5'),
        principal_amount=100000,
        fee=5000,
        tax=5000
    )
    new_inv = investment_service.create_investment(db_session, inv_in, test_user.user_id)
    assert new_inv.principal_amount == 100000
    assert new_inv.quantity == Decimal('2.5')
    assert w_cash.balance == 390000

    # 2. Nhận cổ tức tiền mặt (TC-09)
    # Nhận 5k cổ tức -> Ví tăng 5k (lên 395k)
    inc_in = InvestmentPassiveIncome(amount=5000, wallet_id=w_cash.wallet_id)
    investment_service.receive_passive_income(db_session, new_inv.investment_id, inc_in, test_user.user_id)
    assert w_cash.balance == 395000

    # 3. Bán Chốt Lời / Lỗ (TC-09)
    # Bán giá 120k, phí = 5k. Lợi nhuận thực tế (Pnl = Selling Price - Principal - Tax - Fee - BuyTax - BuyFee). 
    # Nhưng trong logic thiết kế: PnL = selling_price - principal_amount - fee - tax. => 120k - 100k - 5k - 0 = +15k.
    # Tiền thực thu về ví: selling_price - fee - tax = 120k - 5k = 115k
    # => Ví mới: 395k + 115k = 510k.
    sell_in = InvestmentSell(
        selling_price=120000, 
        wallet_id=w_cash.wallet_id, 
        fee=5000, 
        tax=0, 
        date=date.today()
    )
    result = investment_service.sell(db_session, new_inv.investment_id, sell_in, test_user.user_id)
    
    assert result["profit"] == 15000
    assert w_cash.balance == 510000
    # Đã bán thì không được nhận thêm passive income nữa (Tài sản bị soft/hard delete nên báo không tìm thấy)
    with pytest.raises(ValueError, match="Không tìm thấy tài sản"):
        investment_service.receive_passive_income(db_session, new_inv.investment_id, inc_in, test_user.user_id)
