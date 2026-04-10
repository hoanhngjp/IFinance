from sqlalchemy.orm import Session
from datetime import date
from app.crud.crud_transaction import transaction as crud_transaction
from app.crud.crud_wallet import wallet as crud_wallet
from app.crud.crud_category import category as crud_category
from app.models.transaction import Transaction
from app.schemas.transaction import TransactionCreate, TransactionUpdate, TransactionTransfer
from app.models.enums import TransactionType, WalletType

class TransactionService:
    def get_paginated(
        self, db: Session, user_id: int, page: int, size: int,
        tx_type: str = None, wallet_id: int = None, category_id: int = None,
        start_date: date = None, end_date: date = None
    ):
        if start_date and end_date and start_date > end_date:
            raise ValueError("Ngày bắt đầu không được lớn hơn ngày kết thúc")
            
        skip = (page - 1) * size
        transactions, total = crud_transaction.get_multi_filtered(
            db, user_id=user_id, skip=skip, limit=size,
            tx_type=tx_type, wallet_id=wallet_id, category_id=category_id,
            start_date=start_date, end_date=end_date
        )
        return transactions, total

    def create(self, db: Session, tx_in: TransactionCreate, user_id: int) -> Transaction:
        wallet = crud_wallet.get_by_user_id(db, user_id=user_id, wallet_id=tx_in.wallet_id)
        if not wallet:
            raise ValueError("Không tìm thấy ví tiền")

        category = crud_category.get_by_id_and_user(db, category_id=tx_in.category_id, user_id=user_id)
        if not category and getattr(tx_in, 'category_id', None) is not None:
            # Maybe it's a system category
            sys_cat = crud_category.get_parent_category(db, parent_id=tx_in.category_id, user_id=user_id)
            if not sys_cat:
                raise ValueError("Không tìm thấy danh mục")

        if tx_in.transaction_type == TransactionType.expense and wallet.type != WalletType.credit:
            if wallet.balance < tx_in.amount:
                raise ValueError("Ví nguồn không đủ số dư để chi tiêu")

        new_tx = Transaction(
            user_id=user_id,
            wallet_id=tx_in.wallet_id,
            category_id=tx_in.category_id,
            amount=tx_in.amount,
            date=tx_in.date,
            transaction_type=tx_in.transaction_type,
            note=tx_in.note,
            ocr_data=tx_in.ocr_data
        )
        db.add(new_tx)

        if tx_in.transaction_type == TransactionType.expense:
            wallet.balance -= tx_in.amount
        elif tx_in.transaction_type == TransactionType.income:
            wallet.balance += tx_in.amount

        db.commit()
        db.refresh(new_tx)
        return new_tx

    def update(self, db: Session, transaction_id: int, tx_in: TransactionUpdate, user_id: int) -> Transaction:
        tx = crud_transaction.get_by_id_and_user(db, transaction_id=transaction_id, user_id=user_id)
        if not tx:
            raise ValueError("Không tìm thấy giao dịch")

        wallet = crud_wallet.get_by_user_id(db, user_id=user_id, wallet_id=tx.wallet_id)
        
        # 1. Hoàn rủi ro số dư
        if tx.transaction_type == TransactionType.expense:
            wallet.balance += tx.amount
        elif tx.transaction_type == TransactionType.income:
            wallet.balance -= tx.amount

        # 2. Cập nhật record
        if tx_in.amount is not None:
             tx.amount = tx_in.amount
        if tx_in.category_id is not None:
             tx.category_id = tx_in.category_id
        if tx_in.note is not None:
             tx.note = tx_in.note
        if tx_in.date is not None:
             tx.date = tx_in.date

        # 3. Trừ/Cộng tiền dựa trên số tiền mới
        if tx.transaction_type == TransactionType.expense:
            wallet.balance -= tx.amount
        elif tx.transaction_type == TransactionType.income:
            wallet.balance += tx.amount

        if wallet.type != WalletType.credit and wallet.balance < 0:
            raise ValueError("Số dư ví không đủ để cập nhật giao dịch này (ví sẽ bị âm)")

        db.commit()
        db.refresh(tx)
        return tx

    def delete(self, db: Session, transaction_id: int, user_id: int):
        tx = crud_transaction.get_by_id_and_user(db, transaction_id=transaction_id, user_id=user_id)
        if not tx:
            raise ValueError("Không tìm thấy giao dịch")

        wallet = crud_wallet.get_by_user_id(db, user_id=user_id, wallet_id=tx.wallet_id)
        
        if wallet:
            if tx.transaction_type == TransactionType.expense:
                wallet.balance += tx.amount
            elif tx.transaction_type == TransactionType.income:
                wallet.balance -= tx.amount

            if wallet.type != WalletType.credit and wallet.balance < 0:
                raise ValueError("Không thể xóa khoản thu này vì số dư ví hiện tại không đủ để hoàn lại (ví sẽ bị âm)")

        crud_transaction.remove(db, id=tx.transaction_id)
        db.commit()
        return True

    def transfer(self, db: Session, transfer_in: TransactionTransfer, user_id: int):
        if transfer_in.source_wallet_id == transfer_in.dest_wallet_id:
            raise ValueError("Không thể chuyển tiền cho cùng một ví")

        source_wallet = crud_wallet.get_by_user_id(db, user_id=user_id, wallet_id=transfer_in.source_wallet_id)
        dest_wallet = crud_wallet.get_by_user_id(db, user_id=user_id, wallet_id=transfer_in.dest_wallet_id)

        if not source_wallet or not dest_wallet:
            raise ValueError("Không tìm thấy ví nguồn hoặc ví đích")

        if source_wallet.type != WalletType.credit and source_wallet.balance < transfer_in.amount:
            raise ValueError("Ví nguồn không đủ số dư để thực hiện chuyển tiền")

        source_wallet.balance -= transfer_in.amount
        dest_wallet.balance += transfer_in.amount

        # Note: Ideally, IDs 17 and 18 are static 'Transfer' categories.
        tx_out = Transaction(
             user_id=user_id,
             wallet_id=source_wallet.wallet_id,
             category_id=17,
             amount=transfer_in.amount,
             transaction_type=TransactionType.expense,
             note=f"{transfer_in.note} (Tới: {dest_wallet.name})",
             date=transfer_in.date
        )

        tx_in = Transaction(
             user_id=user_id,
             wallet_id=dest_wallet.wallet_id,
             category_id=18,
             amount=transfer_in.amount,
             transaction_type=TransactionType.income,
             note=f"{transfer_in.note} (Từ: {source_wallet.name})",
             date=transfer_in.date
        )

        db.add(tx_out)
        db.add(tx_in)
        db.commit()
        return tx_out.transaction_id, tx_in.transaction_id

transaction_service = TransactionService()
