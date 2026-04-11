from sqlalchemy.orm import Session
from datetime import date
from app.crud.crud_transaction import transaction as crud_transaction
from app.crud.crud_wallet import wallet as crud_wallet
from app.crud.crud_category import category as crud_category
from app.models.transaction import Transaction
from app.schemas.transaction import TransactionCreate, TransactionUpdate, TransactionTransfer
from app.models.enums import TransactionType, WalletType, DebtType
from app.models.finance_modules import Debt, DebtRepayment

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

    def create_bulk(self, db: Session, tx_list: list[TransactionCreate], user_id: int, ignore_spend_limit: bool = True):
        new_txs = []
        wallet_cache = {}
        category_cache = {}

        for tx_in in tx_list:
            # Check Wallet Dynamic Creation
            is_dynamic_wallet = (tx_in.wallet_id < 0) and getattr(tx_in, 'new_wallet_name', None)
            
            if is_dynamic_wallet:
                w_key = f"new_{tx_in.new_wallet_name.strip().lower()}"
                if w_key not in wallet_cache:
                    from app.models.wallet_category import Wallet
                    new_wallet = Wallet(
                        user_id=user_id,
                        name=tx_in.new_wallet_name.strip(),
                        type=WalletType.bank, # Default ngầm định là Bank cho gọn
                        currency="VND",
                        balance=0 # Có thể âm tùy ý nhờ Bulk logic
                    )
                    db.add(new_wallet)
                    db.flush()
                    wallet_cache[w_key] = new_wallet
                
                wallet = wallet_cache[w_key]
                resolved_wallet_id = wallet.wallet_id
            else:
                if tx_in.wallet_id not in wallet_cache:
                    wallet = crud_wallet.get_by_user_id(db, user_id=user_id, wallet_id=tx_in.wallet_id)
                    if not wallet:
                        raise ValueError(f"Không tìm thấy ví tiền ID {tx_in.wallet_id}")
                    wallet_cache[tx_in.wallet_id] = wallet
                
                wallet = wallet_cache[tx_in.wallet_id]
                resolved_wallet_id = wallet.wallet_id

            # Check category Dynamic Creation
            is_dynamic_cat = (tx_in.category_id < 0) and getattr(tx_in, 'new_category_name', None)

            if is_dynamic_cat:
                cat_key = f"new_{tx_in.new_category_name.strip().lower()}"
                if cat_key not in category_cache:
                    from app.models.wallet_category import Category
                    new_cat = Category(
                        user_id=user_id,
                        name=tx_in.new_category_name.strip(),
                        type=tx_in.transaction_type.value if hasattr(tx_in.transaction_type, 'value') else tx_in.transaction_type,
                        icon="✨",
                        parent_id=None
                    )
                    db.add(new_cat)
                    db.flush()
                    category_cache[cat_key] = new_cat
                
                category = category_cache[cat_key]
                resolved_cat_id = category.category_id

            else:
                if tx_in.category_id not in category_cache:
                    category = crud_category.get_by_id_and_user(db, category_id=tx_in.category_id, user_id=user_id)
                    if not category and getattr(tx_in, 'category_id', None) is not None:
                        sys_cat = crud_category.get_parent_category(db, parent_id=tx_in.category_id, user_id=user_id)
                        if not sys_cat:
                            raise ValueError(f"Không tìm thấy danh mục ID {tx_in.category_id}")
                        category = sys_cat
                    category_cache[tx_in.category_id] = category
                
                category = category_cache[tx_in.category_id]
                resolved_cat_id = category.category_id

            # Check safe spend limit
            if not ignore_spend_limit:
                if tx_in.transaction_type == TransactionType.expense and wallet.type != WalletType.credit:
                    if wallet.balance < tx_in.amount:
                        raise ValueError(f"Ví '{wallet.name}' không đủ tiền cho khoản chi {tx_in.amount}")

            new_tx = Transaction(
                user_id=user_id,
                wallet_id=resolved_wallet_id,
                category_id=resolved_cat_id,
                amount=tx_in.amount,
                date=tx_in.date,
                transaction_type=tx_in.transaction_type,
                note=tx_in.note,
                ocr_data=tx_in.ocr_data
            )
            db.add(new_tx)
            new_txs.append(new_tx)

            # Update cached wallet balance in memory
            if tx_in.transaction_type == TransactionType.expense:
                wallet.balance -= tx_in.amount
            elif tx_in.transaction_type == TransactionType.income:
                wallet.balance += tx_in.amount

            # --- TÍCH HỢP QUẢN LÝ NỢ (DEBT) ---
            creditor = getattr(tx_in, 'creditor_name', None)
            if creditor:
                cat_name = category.name.lower()
                is_lend = "cho vay" in cat_name
                is_borrow = "đi vay" in cat_name
                is_collect = "thu nợ" in cat_name
                is_repay = "trả nợ" in cat_name

                if is_lend or is_borrow:
                    debt_type = DebtType.receivable if is_lend else DebtType.payable
                    new_debt = Debt(
                        user_id=user_id,
                        creditor_name=creditor.strip(),
                        type=debt_type,
                        total_amount=tx_in.amount,
                        remaining_amount=tx_in.amount,
                        interest_rate=0,
                        due_date=None,
                        is_installment=False
                    )
                    db.add(new_debt)
                
                elif is_collect or is_repay:
                    # Gạch nợ tự động bằng cách tìm hợp đồng nợ cũ theo Tên (Fuzzy match)
                    target_debt = db.query(Debt).filter(
                        Debt.user_id == user_id, 
                        Debt.creditor_name.ilike(f"%{creditor.strip()}%"),
                        Debt.remaining_amount > 0
                    ).first()

                    if target_debt:
                        db.flush() # Flush để new_tx được SQLAlchemy gán ID (transaction_id)
                        target_debt.remaining_amount -= tx_in.amount
                        if target_debt.remaining_amount < 0:
                            target_debt.remaining_amount = 0
                            
                        repayment = DebtRepayment(
                            debt_id=target_debt.debt_id,
                            transaction_id=new_tx.transaction_id,
                            amount=tx_in.amount,
                            date=tx_in.date
                        )
                        db.add(repayment)

        db.commit()
        return len(new_txs)

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
