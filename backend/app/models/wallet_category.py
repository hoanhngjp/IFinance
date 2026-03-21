from sqlalchemy import Column, Integer, String, Numeric, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from app.db.database import Base
from app.models.enums import WalletType, CategoryType


class Wallet(Base):
    __tablename__ = "wallets"

    wallet_id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
    type = Column(SQLEnum(WalletType), nullable=False)
    balance = Column(Numeric(15, 2), default=0)  # Derived column
    currency = Column(String(10), default="VND")

    user = relationship("User", back_populates="wallets")
    transactions = relationship("Transaction", back_populates="wallet")
    investments = relationship("Investment", back_populates="wallet")
    subscriptions = relationship("Subscription", back_populates="default_wallet")


class Category(Base):
    __tablename__ = "categories"

    category_id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=True)  # Null = System Default
    parent_id = Column(Integer, ForeignKey("categories.category_id", ondelete="CASCADE"), nullable=True)
    name = Column(String(100), nullable=False)
    type = Column(SQLEnum(CategoryType), nullable=False)
    icon = Column(String(255), nullable=True)

    user = relationship("User", back_populates="categories")
    transactions = relationship("Transaction", back_populates="category")
    subscriptions = relationship("Subscription", back_populates="category")
    budgets = relationship("Budget", back_populates="category")

    # Self-referential relationship (Đệ quy danh mục Cha - Con)
    subcategories = relationship("Category", backref="parent", remote_side=[category_id])