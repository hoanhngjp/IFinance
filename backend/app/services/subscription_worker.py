from datetime import date
from decimal import Decimal
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
    db = SessionLocal()
    try:
        today = date.today()

        due_subs = db.query(Subscription).filter(
            Subscription.is_active == True,
            Subscription.next_due_date <= today
        ).all()

        if not due_subs:
            return

        for sub in due_subs:
            wallet = db.query(Wallet).filter(Wallet.wallet_id == sub.default_wallet_id).first()

            # Ép kiểu Decimal an toàn tuyệt đối
            sub_amount = Decimal(str(sub.amount))

            if wallet:
                current_balance = Decimal(str(wallet.balance or 0))
                wallet.balance = current_balance - sub_amount

            new_tx = Transaction(
                user_id=sub.user_id,
                wallet_id=sub.default_wallet_id,
                category_id=sub.category_id,
                amount=sub_amount,
                transaction_type=TransactionType.expense,
                date=today,  # Lấy ngày hôm nay làm ngày giao dịch thực tế
                note=f"Tự động thanh toán gói định kỳ: {sub.name}"
            )
            db.add(new_tx)

            # Lấy chuỗi Enum
            freq_val = sub.frequency.value if hasattr(sub.frequency, 'value') else sub.frequency

            # CƠ CHẾ CATCH-UP: Lặp cho đến khi next_due_date vượt qua ngày hôm nay
            # Phòng trường hợp server bảo trì/tắt trong nhiều chu kỳ
            while sub.next_due_date <= today:
                if freq_val == 'daily':
                    sub.next_due_date += relativedelta(days=1)
                elif freq_val == 'weekly':
                    sub.next_due_date += relativedelta(weeks=1)
                elif freq_val == 'monthly':
                    sub.next_due_date += relativedelta(months=1)
                elif freq_val == 'yearly':
                    sub.next_due_date += relativedelta(years=1)
                else:
                    break  # Break khẩn cấp nếu chu kỳ lỗi

        db.commit()
        print(f"🤖 [Auto-Worker] Đã xử lý trừ tiền thành công {len(due_subs)} gói đăng ký định kỳ!")

    except Exception as e:
        db.rollback()
        print(f"❌ [Auto-Worker] Lỗi khi xử lý subscriptions: {e}")
    finally:
        db.close()