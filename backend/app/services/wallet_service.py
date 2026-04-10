from decimal import Decimal
from sqlalchemy.orm import Session
from app.crud.crud_wallet import wallet as crud_wallet
from app.models.wallet_category import Wallet
from app.schemas.wallet import WalletCreate, WalletUpdate
from app.models.transaction import Transaction
from app.models.wallet_category import Category
from app.models.enums import TransactionType, WalletType

class WalletService:
    def get_summary(self, db: Session, user_id: int):
        wallets = crud_wallet.get_active_wallets_by_user(db, user_id=user_id)
        total_assets = sum((w.balance for w in wallets if w.balance > 0 and w.type != WalletType.credit), Decimal('0.0'))
        total_liabilities = sum((abs(w.balance) for w in wallets if w.balance < 0), Decimal('0.0'))
        net_worth = total_assets - total_liabilities
        return {
            "total_assets": float(total_assets),
            "total_liabilities": float(total_liabilities),
            "net_worth": float(net_worth)
        }

    def get_all(self, db: Session, user_id: int):
        return crud_wallet.get_active_wallets_by_user(db, user_id=user_id)

    def create(self, db: Session, wallet_in: WalletCreate, user_id: int):
        new_wallet = Wallet(
            user_id=user_id,
            name=wallet_in.name,
            type=wallet_in.type,
            currency=wallet_in.currency,
            balance=Decimal(str(wallet_in.initial_balance)),
            credit_limit=Decimal(str(wallet_in.credit_limit)),
            is_active=True
        )
        db.add(new_wallet)
        db.flush()

        if wallet_in.initial_balance > 0:
            sys_cat = db.query(Category).filter_by(
                user_id=None,
                name="Thu nhập khác"
            ).first()
            cat_id = sys_cat.category_id if sys_cat else 1
            
            initial_tx = Transaction(
                user_id=user_id,
                wallet_id=new_wallet.wallet_id,
                category_id=cat_id,
                transaction_type=TransactionType.income,
                amount=Decimal(str(wallet_in.initial_balance)),
                note="Khởi tạo số dư ban đầu"
            )
            db.add(initial_tx)

        db.commit()
        db.refresh(new_wallet)
        return new_wallet

    def update(self, db: Session, wallet_id: int, wallet_in: WalletUpdate, user_id: int):
        wallet = crud_wallet.get_by_user_id(db, user_id=user_id, wallet_id=wallet_id)
        if not wallet:
            raise ValueError("Không tìm thấy ví")

        # Update metadata using generic CRUD
        # Chú ý: Cấu trúc generic update chấp nhận model object (db_obj) và the schema (obj_in)
        updated_wallet = crud_wallet.update(db, db_obj=wallet, obj_in=wallet_in)
        return updated_wallet

    def delete(self, db: Session, wallet_id: int, user_id: int):
        wallet = crud_wallet.get_by_user_id(db, user_id=user_id, wallet_id=wallet_id)
        if not wallet:
            raise ValueError("Không tìm thấy ví")

        if wallet.balance < 0:
            raise ValueError("Không thể xóa ví đang có dư nợ. Vui lòng thanh toán hết nợ trước.")

        wallet.is_active = False
        db.commit()
        return wallet

wallet_service = WalletService()
