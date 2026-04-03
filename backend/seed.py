import os
import sys
import calendar
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

# Đảm bảo python hiểu thư mục hiện tại để import app module
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.db.database import SessionLocal
from app.core.security import get_password_hash
from app.models.user import User
from app.models.wallet_category import Wallet, Category
from app.models.transaction import Transaction
from app.models.finance_modules import Budget, Subscription, Investment, Debt
from app.models.enums import (
    TransactionType, InvestmentType, FrequencyType,
    BudgetPeriod, DebtType, WalletType, CategoryType
)


def seed_data():
    db = SessionLocal()
    try:
        print("🌱 Đang khởi tạo dữ liệu mẫu (Seed Data)...")

        # ==========================================
        # 1. TẠO USER MẶC ĐỊNH
        # ==========================================
        test_email = "test@ifinance.com"
        user = db.query(User).filter(User.email == test_email).first()
        if not user:
            user = User(
                username="testuser",
                email=test_email,
                password_hash=get_password_hash("123456"),
                full_name="Người dùng Test",
                is_active=True
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            print("✅ Đã tạo User test: test@ifinance.com | Pass: 123456")
        else:
            print("⚡ User test đã tồn tại. Bỏ qua bước tạo User.")

        # ==========================================
        # 2. TẠO VÍ TIỀN (BAO GỒM VÍ TÍN DỤNG)
        # ==========================================
        wallet_cash = db.query(Wallet).filter(Wallet.user_id == user.user_id, Wallet.name == "Tiền mặt").first()
        if not wallet_cash:
            # Ví Tiền mặt
            wallet_cash = Wallet(
                user_id=user.user_id, name="Tiền mặt", type=WalletType.cash,
                balance=Decimal("5000000"), currency="VND", is_active=True, credit_limit=Decimal("0")
            )
            # Ví Ngân hàng
            wallet_bank = Wallet(
                user_id=user.user_id, name="Thẻ Vietcombank", type=WalletType.bank,
                balance=Decimal("150000000"), currency="VND", is_active=True, credit_limit=Decimal("0")
            )
            # Ví Tín dụng (Có dư nợ ban đầu là âm 2 triệu)
            wallet_credit = Wallet(
                user_id=user.user_id, name="Thẻ Tín Dụng VIB", type=WalletType.credit,
                balance=Decimal("-2000000"), currency="VND", is_active=True, credit_limit=Decimal("50000000")
            )

            db.add_all([wallet_cash, wallet_bank, wallet_credit])
            db.commit()
            print("✅ Đã tạo 3 Ví: Tiền mặt, Thẻ Vietcombank, Thẻ Tín Dụng VIB")

        # Lấy lại ví sau khi commit
        wallet_cash = db.query(Wallet).filter(Wallet.name == "Tiền mặt").first()
        wallet_bank = db.query(Wallet).filter(Wallet.name == "Thẻ Vietcombank").first()
        wallet_credit = db.query(Wallet).filter(Wallet.name == "Thẻ Tín Dụng VIB").first()

        # ==========================================
        # 3. TẠO DANH MỤC (CATEGORIES)
        # ==========================================
        cat_exist = db.query(Category).filter(Category.name == "Lương").first()
        if not cat_exist:
            raw_categories = [
                (1, None, "Lương", CategoryType.income, "💰"),
                (2, None, "Thưởng", CategoryType.income, "🎁"),
                (3, None, "Ăn uống", CategoryType.expense, "🍜"),
                (4, None, "Di chuyển", CategoryType.expense, "🚗"),
                (5, None, "Hóa đơn & Tiện ích", CategoryType.expense, "🧾"),
                (6, None, "Sức khỏe", CategoryType.expense, "🏥"),
                (7, None, "Mua sắm", CategoryType.expense, "🛒"),
                (8, 3, "Ăn sáng", CategoryType.expense, "🍞"),
                (9, 3, "Cà phê & Nước", CategoryType.expense, "☕"),
                (10, 4, "Đổ xăng", CategoryType.expense, "⛽"),
                (11, 4, "Gửi xe", CategoryType.expense, "🅿️"),
                (12, 5, "Tiền điện", CategoryType.expense, "⚡"),
                (13, 5, "Tiền nước", CategoryType.expense, "💧"),
                (14, 5, "Internet", CategoryType.expense, "🌐"),
                (15, 6, "Khám bệnh", CategoryType.expense, "🩺"),
                (16, 7, "Quần áo", CategoryType.expense, "👕"),
                (17, None, "Chuyển tiền đi", CategoryType.expense, "📤"),
                (18, None, "Nhận tiền đến", CategoryType.income, "📥"),
                (19, None, "Đi vay", CategoryType.income, "🏦"),
                (20, None, "Thu nợ gốc", CategoryType.income, "🤝"),
                (21, None, "Lãi cho vay", CategoryType.income, "📈"),
                (22, None, "Cho vay", CategoryType.expense, "💸"),
                (23, None, "Trả nợ gốc", CategoryType.expense, "💳"),
                (24, None, "Lãi vay phải trả", CategoryType.expense, "📉"),
                (25, None, "Dịch vụ định kỳ", CategoryType.expense, "🔄"),
                (26, 25, "Giải trí số", CategoryType.expense, "🎬"),
                (27, 25, "Phần mềm & App", CategoryType.expense, "💻"),
                (28, None, "Đầu tư tài sản", CategoryType.expense, "📊"),
                (29, None, "Lợi nhuận đầu tư", CategoryType.income, "🚀"),
                (30, 29, "Cổ tức & Lãi tiết kiệm", CategoryType.income, "💎"),
                (31, None, "Giáo dục", CategoryType.expense, "📚"),
                (32, None, "Giải trí", CategoryType.expense, "🎮"),
                (33, 32, "Xem phim", CategoryType.expense, "🍿"),
                (34, None, "Gia đình", CategoryType.expense, "👨‍👩‍👧‍👦"),
                (35, None, "Làm đẹp & Cá nhân", CategoryType.expense, "✂️"),
                (36, None, "Quà tặng & Cưới hỏi", CategoryType.expense, "🧧"),
                (37, None, "Khác", CategoryType.expense, "📦"),
                (38, None, "Thu nhập khác", CategoryType.income, "🪄"),
            ]

            cat_map = {}
            for cid, pid, name, ctype, icon in raw_categories:
                if pid is None:
                    cat = Category(user_id=None, name=name, type=ctype, icon=icon)
                    db.add(cat)
                    cat_map[cid] = cat
            db.commit()

            for cid, pid, name, ctype, icon in raw_categories:
                if pid is not None:
                    parent_cat = cat_map[pid]
                    cat = Category(user_id=None, parent_id=parent_cat.category_id, name=name, type=ctype, icon=icon)
                    db.add(cat)
                    cat_map[cid] = cat
            db.commit()
            print("✅ Đã tạo 38 Danh mục Hệ thống")

        cat_food = db.query(Category).filter(Category.name == "Ăn uống").first()
        cat_bill = db.query(Category).filter(Category.name == "Hóa đơn & Tiện ích").first()
        cat_salary = db.query(Category).filter(Category.name == "Lương").first()

        # ==========================================
        # 4. TẠO GIAO DỊCH (TRANSACTIONS) CÓ TIMEZONE
        # ==========================================
        tx_exist = db.query(Transaction).filter(Transaction.user_id == user.user_id).first()
        if not tx_exist and cat_food and cat_bill and cat_salary:
            now_utc = datetime.now(timezone.utc)
            transactions = [
                Transaction(user_id=user.user_id, wallet_id=wallet_bank.wallet_id, category_id=cat_salary.category_id,
                            amount=Decimal("20000000"), transaction_type=TransactionType.income,
                            date=now_utc - timedelta(days=5), note="Lương tháng này"),
                Transaction(user_id=user.user_id, wallet_id=wallet_cash.wallet_id, category_id=cat_food.category_id,
                            amount=Decimal("50000"), transaction_type=TransactionType.expense,
                            date=now_utc - timedelta(days=1), note="Ăn phở sáng"),
                Transaction(user_id=user.user_id, wallet_id=wallet_credit.wallet_id, category_id=cat_bill.category_id,
                            amount=Decimal("800000"), transaction_type=TransactionType.expense, date=now_utc,
                            note="Quẹt thẻ tín dụng đóng tiền điện")
            ]
            db.add_all(transactions)
            db.commit()
            print("✅ Đã tạo Giao dịch thu/chi mẫu")

        # ==========================================
        # 5. TẠO NGÂN SÁCH (BUDGET)
        # ==========================================
        budget_exist = db.query(Budget).filter(Budget.user_id == user.user_id).first()
        if not budget_exist and cat_food:
            today_date = date.today()
            start_d = date(today_date.year, today_date.month, 1)
            last_day = calendar.monthrange(today_date.year, today_date.month)[1]
            end_d = date(today_date.year, today_date.month, last_day)

            budget = Budget(
                user_id=user.user_id, category_id=cat_food.category_id,
                amount_limit=Decimal("5000000"), period=BudgetPeriod.monthly, is_rollover=True,
                start_date=start_d, end_date=end_d
            )
            db.add(budget)
            db.commit()
            print("✅ Đã tạo Ngân sách: Ăn uống (5.000.000đ/tháng)")

        # ==========================================
        # 6. TẠO ĐĂNG KÝ ĐỊNH KỲ (SUBSCRIPTION)
        # ==========================================
        sub_exist = db.query(Subscription).filter(Subscription.user_id == user.user_id).first()
        if not sub_exist and cat_bill:
            sub = Subscription(
                user_id=user.user_id, default_wallet_id=wallet_bank.wallet_id, category_id=cat_bill.category_id,
                name="Netflix Premium", amount=Decimal("260000"), frequency=FrequencyType.monthly,
                next_due_date=date.today() + timedelta(days=10), is_active=True
            )
            db.add(sub)
            db.commit()
            print("✅ Đã tạo Gói định kỳ: Netflix (260.000đ/tháng)")

        # ==========================================
        # 7. TẠO DANH MỤC ĐẦU TƯ (INVESTMENT)
        # ==========================================
        inv_exist = db.query(Investment).filter(Investment.user_id == user.user_id).first()
        if not inv_exist:
            inv1 = Investment(user_id=user.user_id, wallet_id=wallet_bank.wallet_id, name="Vàng SJC",
                              type=InvestmentType.gold, principal_amount=Decimal("85000000"),
                              current_value=Decimal("87000000"), total_passive_income=0,
                              start_date=date.today() - timedelta(days=30))
            inv2 = Investment(user_id=user.user_id, wallet_id=wallet_bank.wallet_id, name="Cổ phiếu FPT",
                              type=InvestmentType.stock, principal_amount=Decimal("20000000"),
                              current_value=Decimal("22000000"), total_passive_income=Decimal("500000"),
                              start_date=date.today() - timedelta(days=60))
            db.add_all([inv1, inv2])
            db.commit()
            print("✅ Đã tạo Danh mục đầu tư mẫu (Vàng, Cổ phiếu)")

        # ==========================================
        # 8. TẠO KHOẢN NỢ (DEBT)
        # ==========================================
        debt_exist = db.query(Debt).filter(Debt.user_id == user.user_id).first()
        if not debt_exist:
            debt = Debt(user_id=user.user_id, creditor_name="Nam (Bạn đại học)", total_amount=Decimal("2000000"),
                        remaining_amount=Decimal("2000000"), type=DebtType.receivable,
                        due_date=date.today() + timedelta(days=15))
            db.add(debt)
            db.commit()
            print("✅ Đã tạo Khoản nợ mẫu: Cho Nam vay 2 triệu")

        print("🎉 TẤT CẢ DỮ LIỆU MẪU ĐÃ ĐƯỢC KHỞI TẠO THÀNH CÔNG!")

    except Exception as e:
        print(f"❌ Có lỗi xảy ra: {str(e)}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    seed_data()