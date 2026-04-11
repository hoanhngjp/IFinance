import pytest
from datetime import date
from decimal import Decimal
from app.models.user import User
from app.models.wallet_category import Category
from app.models.enums import WalletType, TransactionType
from app.schemas.wallet import WalletCreate
from app.schemas.transaction import TransactionCreate, TransactionTransfer, TransactionUpdate
from app.services.wallet_service import wallet_service
from app.services.transaction_service import transaction_service
from app.core.security import get_password_hash

# ===============================================
# TC-01: Khởi tạo ví tiền mặt và thẻ tín dụng
# ===============================================
def test_create_wallets(db_session, test_user):
    # Mở tài khoản tiền mặt (có số dư khởi tạo)
    wallet_in = WalletCreate(name="Ví tiền mặt", type=WalletType.cash, initial_balance=10000, currency="VND")
    new_wallet = wallet_service.create(db_session, wallet_in, test_user.user_id)
    assert new_wallet.balance == 10000
    assert new_wallet.type == WalletType.cash

    # Mở thẻ tín dụng (Bắt đầu với 0 đồng, có hạn mức)
    credit_in = WalletCreate(name="Thẻ VISA", type=WalletType.credit, initial_balance=0, credit_limit=50000, currency="VND")
    new_credit = wallet_service.create(db_session, credit_in, test_user.user_id)
    assert new_credit.balance == 0
    assert new_credit.type == WalletType.credit

# ===============================================
# TC-02: Chi tiêu bằng ví Tiền mặt (Kiểm tra Safe-guard)
# ===============================================
def test_spend_cash_wallet(db_session, test_user, test_category):
    w1 = wallet_service.create(db_session, WalletCreate(name="Cash", type=WalletType.cash, initial_balance=50000, currency="VND"), test_user.user_id)

    # HP: Chi tiêu hợp lệ (ít hơn số tiền đang có)
    tx_in = TransactionCreate(wallet_id=w1.wallet_id, category_id=test_category.category_id, amount=20000, transaction_type=TransactionType.expense, date=date.today())
    transaction_service.create(db_session, tx_in, test_user.user_id)
    assert w1.balance == 30000

    # UP: Xài lố số tiền mặt trong túi (vượt 30k) -> Chặn lại
    with pytest.raises(ValueError, match="Ví nguồn không đủ số dư để chi tiêu"):
        tx_in2 = TransactionCreate(wallet_id=w1.wallet_id, category_id=test_category.category_id, amount=40000, transaction_type=TransactionType.expense, date=date.today())
        transaction_service.create(db_session, tx_in2, test_user.user_id)

# ===============================================
# TC-03: Chi tiêu bằng ví Thẻ tín dụng (Âm tiền ròng tự do)
# ===============================================
def test_spend_credit_wallet(db_session, test_user, test_category):
    w2 = wallet_service.create(db_session, WalletCreate(name="Credit", type=WalletType.credit, initial_balance=0, credit_limit=50000, currency="VND"), test_user.user_id)

    # HP: Thẻ tín dụng cho phép tiêu đến "âm tài khoản"
    tx_in = TransactionCreate(wallet_id=w2.wallet_id, category_id=test_category.category_id, amount=80000, transaction_type=TransactionType.expense, date=date.today())
    transaction_service.create(db_session, tx_in, test_user.user_id)
    assert w2.balance == Decimal('-80000')

# ===============================================
# TC-04: Tính chất Atomic - Chuyển giao tiền bạc
# ===============================================
def test_transfer_wallets(db_session, test_user):
    w1 = wallet_service.create(db_session, WalletCreate(name="Bank1", type=WalletType.bank, initial_balance=100000, currency="VND"), test_user.user_id)
    w2 = wallet_service.create(db_session, WalletCreate(name="Bank2", type=WalletType.bank, initial_balance=0, currency="VND"), test_user.user_id)

    # HP: Chuyển 20k thành công
    t_in = TransactionTransfer(source_wallet_id=w1.wallet_id, dest_wallet_id=w2.wallet_id, amount=20000, date=date.today())
    transaction_service.transfer(db_session, t_in, test_user.user_id)
    
    assert w1.balance == 80000
    assert w2.balance == 20000

    # UP: Ngăn chặn chuyển số tiền ma (Vượt quá Bank 1)
    with pytest.raises(ValueError, match="Ví nguồn không đủ số dư"):
        t_in2 = TransactionTransfer(source_wallet_id=w1.wallet_id, dest_wallet_id=w2.wallet_id, amount=90000, date=date.today())
        transaction_service.transfer(db_session, t_in2, test_user.user_id)

# ===============================================
# TC-05: Sửa & Xoá giao dịch làm thay đổi Wallet Balance
# ===============================================
def test_update_and_delete_transaction(db_session, test_user, test_category):
    w1 = wallet_service.create(db_session, WalletCreate(name="Cash", type=WalletType.cash, initial_balance=50000, currency="VND"), test_user.user_id)
    
    # User tiêu 10.000 -> Còn 40.000
    tx_in = TransactionCreate(wallet_id=w1.wallet_id, category_id=test_category.category_id, amount=10000, transaction_type=TransactionType.expense, date=date.today())
    tx = transaction_service.create(db_session, tx_in, test_user.user_id)
    assert w1.balance == 40000

    # Sửa số tiền bill từ 10.000 thành 30.000 -> Số dư ví tiếp tục trừ thêm 20k
    tx_in_update = TransactionUpdate(amount=30000)
    transaction_service.update(db_session, tx.transaction_id, tx_in_update, test_user.user_id)
    assert w1.balance == 20000

    # Hệ thống hủy Bill hoàn toàn -> Số dư tự trả lại 30.000 về như cũ
    transaction_service.delete(db_session, tx.transaction_id, test_user.user_id)
    assert w1.balance == 50000

# ===============================================
# TC-06: Khớp lệnh Nhập liệu Hàng loạt (Bulk Insert)
# ===============================================
def test_bulk_insert_transactions(db_session, test_user, test_category):
    w1 = wallet_service.create(db_session, WalletCreate(name="Salary Bank", type=WalletType.bank, initial_balance=100000, currency="VND"), test_user.user_id)
    
    tx_list = [
        TransactionCreate(wallet_id=w1.wallet_id, category_id=test_category.category_id, amount=20000, transaction_type=TransactionType.expense, date=date.today(), note="Tx 1"),
        TransactionCreate(wallet_id=w1.wallet_id, category_id=test_category.category_id, amount=30000, transaction_type=TransactionType.expense, date=date.today(), note="Tx 2"),
        TransactionCreate(wallet_id=w1.wallet_id, category_id=test_category.category_id, amount=10000, transaction_type=TransactionType.income, date=date.today(), note="Tx 3")
    ]
    
    # Bơm 1 chuỗi 3 giao dịch
    inserted_count = transaction_service.create_bulk(db_session, tx_list, test_user.user_id)
    assert inserted_count == 3
    
    # Kiểm chứng số dư cuối cùng được cộng dồn đúng 100k - 20k - 30k + 10k = 60000
    assert w1.balance == 60000
    
    # Khi 1 dòng (Chi phí lớn) làm âm ví -> Được phép vượt rào mặc định ở chế độ Bulk
    tx_list_over = [
        TransactionCreate(wallet_id=w1.wallet_id, category_id=test_category.category_id, amount=70000, transaction_type=TransactionType.expense, date=date.today(), note="Nhập lố")
    ]
    inserted_over = transaction_service.create_bulk(db_session, tx_list_over, test_user.user_id)
    assert inserted_over == 1
    assert w1.balance == -10000  # Số dư có thể rớt xuống âm do Bulk Import được bypass an toàn
    
    # Nếu Test tường minh cờ bypass = False
    tx_list_block = [
        TransactionCreate(wallet_id=w1.wallet_id, category_id=test_category.category_id, amount=50000, transaction_type=TransactionType.expense, date=date.today(), note="Bị block")
    ]
    with pytest.raises(ValueError, match="không đủ tiền cho khoản chi"):
        transaction_service.create_bulk(db_session, tx_list_block, test_user.user_id, ignore_spend_limit=False)

# ===============================================
# TC-07: Tự động khởi tạo Ví, Danh mục và Khoản nợ từ Bulk Import
# ===============================================
def test_bulk_insert_auto_generation(db_session, test_user):
    from app.models.wallet_category import Category, Wallet
    from app.models.finance_modules import Debt, DebtRepayment
    
    tx_list = [
        # Giao dịch 1: Khởi tạo Ví "Ví Tiết Kiệm" và Danh mục "Lương thưởng"
        TransactionCreate(
            wallet_id=-1, new_wallet_name="Ví Tiết Kiệm",
            category_id=-1, new_category_name="Lương thưởng",
            amount=5000000, transaction_type=TransactionType.income, date=date.today(), note="Lương tháng mới"
        ),
        # Giao dịch 2: Sinh khoản Cho Vay (Nợ) mới do Danh mục "Cho vay"
        TransactionCreate(
            wallet_id=-1, new_wallet_name="Ví Tiết Kiệm", # Map lại ví đã sinh tạm ở Cache
            category_id=-2, new_category_name="Khác - Cho vay",
            amount=1000000, transaction_type=TransactionType.expense, date=date.today(), 
            note="Cho anh Sơn mượn", creditor_name="Sơn"
        )
    ]
    
    inserted_count = transaction_service.create_bulk(db_session, tx_list, test_user.user_id)
    assert inserted_count == 2
    
    # 1. Xác minh Wallet được tạo tự động
    new_wallet = db_session.query(Wallet).filter(Wallet.user_id == test_user.user_id, Wallet.name == "Ví Tiết Kiệm").first()
    assert new_wallet is not None
    assert new_wallet.balance == 4000000  # 5m - 1m
    
    # 2. Xác minh Category
    cat_salary = db_session.query(Category).filter(Category.name == "Lương thưởng").first()
    assert cat_salary is not None
    
    # 3. Xác minh Nợ (Debt)
    debt = db_session.query(Debt).filter(Debt.creditor_name == "Sơn").first()
    assert debt is not None
    assert debt.total_amount == 1000000
    assert debt.remaining_amount == 1000000
    
    # 4. Xác minh Gạch nợ
    tx_repay = [
        TransactionCreate(
            wallet_id=new_wallet.wallet_id,
            category_id=-3, new_category_name="Khác - Thu nợ",
            amount=500000, transaction_type=TransactionType.income, date=date.today(),
            note="Sơn trả mượn", creditor_name="Sơn"
        )
    ]
    transaction_service.create_bulk(db_session, tx_repay, test_user.user_id)
    
    db_session.refresh(debt)
    db_session.refresh(new_wallet)
    assert debt.remaining_amount == 500000
    assert new_wallet.balance == 4500000
