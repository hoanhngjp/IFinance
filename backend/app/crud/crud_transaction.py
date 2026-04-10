from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List, Optional
from datetime import date
from app.crud.base import CRUDBase
from app.models.transaction import Transaction
from app.schemas.transaction import TransactionCreate, TransactionUpdate

class CRUDTransaction(CRUDBase[Transaction, TransactionCreate, TransactionUpdate]):
    def get_multi_filtered(
        self, 
        db: Session, 
        *, 
        user_id: int, 
        skip: int = 0, 
        limit: int = 20,
        tx_type: Optional[str] = None,
        wallet_id: Optional[int] = None,
        category_id: Optional[int] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ):
        query = db.query(Transaction).filter_by(user_id=user_id)
        
        if tx_type:
            query = query.filter(Transaction.transaction_type == tx_type)
        if wallet_id:
            query = query.filter(Transaction.wallet_id == wallet_id)
        if category_id:
            query = query.filter(Transaction.category_id == category_id)
        if start_date:
            query = query.filter(Transaction.date >= start_date)
        if end_date:
            query = query.filter(Transaction.date <= end_date)
            
        total = query.count()
        transactions = query.order_by(desc(Transaction.date), desc(Transaction.transaction_id)).offset(skip).limit(limit).all()
        return transactions, total

    def get_by_id_and_user(self, db: Session, *, transaction_id: int, user_id: int) -> Optional[Transaction]:
        return db.query(Transaction).filter_by(
            transaction_id=transaction_id, 
            user_id=user_id
        ).first()

transaction = CRUDTransaction(Transaction)
