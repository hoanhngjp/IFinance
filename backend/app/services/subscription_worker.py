from datetime import date
from dateutil.relativedelta import relativedelta
from app.db.database import SessionLocal
from app.models.finance_modules import Subscription
from app.models.wallet_category import Wallet
from app.models.transaction import Transaction
from app.models.enums import TransactionType


def process_due_subscriptions():
    """
    Hàm này sẽ được APScheduler gọi chạy tự động ngầm.
    Nó quét các gói đăng ký tới hạn, tạo giao dịch trừ tiền và đẩy hạn sang chu kỳ tiếp theo.
    """
    db = SessionLocal()  # Mở một kết nối DB độc lập (không dính tới request của user)
    try:
        today = date.today()

        # 1. Tìm tất cả các gói đang Active và có Ngày hạn <= Hôm nay
        due_subs = db.query(Subscription).filter(
            Subscription.is_active == True,
            Subscription.next_due_date <= today
        ).all()

        if not due_subs:
            return  # Không có gói nào đến hạn thì kết thúc

        for sub in due_subs:
            # 2. Trừ tiền vào Ví mặc định
            wallet = db.query(Wallet).filter(Wallet.wallet_id == sub.default_wallet_id).first()
            if wallet:
                wallet.balance -= sub.amount

            # 3. Tạo một Giao dịch (Transaction) để ghi nhận chi phí
            new_tx = Transaction(
                user_id=sub.user_id,
                wallet_id=sub.default_wallet_id,
                category_id=sub.category_id,
                amount=sub.amount,
                transaction_type=TransactionType.expense,
                date=today,
                note=f"Tự động thanh toán gói định kỳ: {sub.name}"
            )
            db.add(new_tx)

            # 4. Tính toán ngày tới hạn tiếp theo (next_due_date)
            # Lưu ý: sub.frequency là Enum, ta lấy value để so sánh
            freq_val = sub.frequency.value if hasattr(sub.frequency, 'value') else sub.frequency

            if freq_val == 'monthly':
                sub.next_due_date += relativedelta(months=1)
            elif freq_val == 'yearly':
                sub.next_due_date += relativedelta(years=1)

        # 5. Lưu toàn bộ thay đổi vào Database
        db.commit()
        print(f"🤖 [Auto-Worker] Đã xử lý trừ tiền thành công {len(due_subs)} gói đăng ký định kỳ!")

    except Exception as e:
        db.rollback()
        print(f"❌ [Auto-Worker] Lỗi khi xử lý subscriptions: {e}")
    finally:
        db.close()  # Luôn nhớ đóng kết nối DB để không bị tràn RAM