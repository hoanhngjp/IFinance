from sqlalchemy import Column, Integer, String, Numeric, Text, DateTime, ForeignKey, Enum as SQLEnum, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.database import Base
from app.models.enums import TransactionType


class Transaction(Base):
    __tablename__ = "transactions"

    transaction_id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    wallet_id = Column(Integer, ForeignKey("wallets.wallet_id"), nullable=False)
    category_id = Column(Integer, ForeignKey("categories.category_id"), nullable=False)

    transaction_type = Column(SQLEnum(TransactionType), nullable=False)
    amount = Column(Numeric(15, 2), nullable=False)  # Luôn dương
    date = Column(DateTime(timezone=True), nullable=False, default=func.now())
    note = Column(Text, nullable=True)
    images = Column(JSON, nullable=True)
    ocr_data = Column(JSON, nullable=True)

    user = relationship("User", back_populates="transactions")
    wallet = relationship("Wallet", back_populates="transactions")
    category = relationship("Category", back_populates="transactions")

    # Mối quan hệ 1-1 với bảng Debt_Repayment (Khai báo uselist=False)
    debt_repayment = relationship("DebtRepayment", back_populates="transaction", uselist=False,
                                  cascade="all, delete-orphan")