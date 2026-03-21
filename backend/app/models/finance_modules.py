from sqlalchemy import Column, Integer, String, Numeric, Date, Boolean, ForeignKey, Enum as SQLEnum, Float, DateTime
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.database import Base
from app.models.enums import DebtType, InvestmentType, FrequencyType, BudgetPeriod


class Debt(Base):
    __tablename__ = "debts"

    debt_id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    creditor_name = Column(String(150), nullable=False)
    total_amount = Column(Numeric(15, 2), nullable=False)
    remaining_amount = Column(Numeric(15, 2), default=0)  # Derived
    type = Column(SQLEnum(DebtType), nullable=False)
    interest_rate = Column(Float, nullable=True)
    due_date = Column(Date, nullable=True)
    is_installment = Column(Boolean, default=False)

    user = relationship("User", back_populates="debts")
    repayments = relationship("DebtRepayment", back_populates="debt", cascade="all, delete-orphan")


class DebtRepayment(Base):
    __tablename__ = "debt_repayments"

    repayment_id = Column(Integer, primary_key=True, autoincrement=True)
    debt_id = Column(Integer, ForeignKey("debts.debt_id", ondelete="CASCADE"), nullable=False)

    # unique=True tạo quan hệ 1-1 với bảng transactions
    transaction_id = Column(Integer, ForeignKey("transactions.transaction_id"), nullable=False, unique=True)

    amount = Column(Numeric(15, 2), nullable=False)
    date = Column(DateTime(timezone=True), nullable=False, default=func.now())

    debt = relationship("Debt", back_populates="repayments")
    transaction = relationship("Transaction", back_populates="debt_repayment")


class Investment(Base):
    __tablename__ = "investments"

    investment_id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    wallet_id = Column(Integer, ForeignKey("wallets.wallet_id"), nullable=False)
    name = Column(String(150), nullable=False)
    type = Column(SQLEnum(InvestmentType), nullable=False)
    principal_amount = Column(Numeric(15, 2), nullable=False)
    current_value = Column(Numeric(15, 2), nullable=True)
    start_date = Column(Date, nullable=True)

    user = relationship("User", back_populates="investments")
    wallet = relationship("Wallet", back_populates="investments")


class Subscription(Base):
    __tablename__ = "subscriptions"

    subscription_id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    default_wallet_id = Column(Integer, ForeignKey("wallets.wallet_id"), nullable=False)
    category_id = Column(Integer, ForeignKey("categories.category_id"), nullable=False)
    name = Column(String(150), nullable=False)
    amount = Column(Numeric(15, 2), nullable=False)
    frequency = Column(SQLEnum(FrequencyType), nullable=False)
    next_due_date = Column(Date, nullable=True)

    user = relationship("User", back_populates="subscriptions")
    default_wallet = relationship("Wallet", back_populates="subscriptions")
    category = relationship("Category", back_populates="subscriptions")


class Budget(Base):
    __tablename__ = "budgets"

    budget_id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    category_id = Column(Integer, ForeignKey("categories.category_id"), nullable=False)
    amount_limit = Column(Numeric(15, 2), nullable=False)
    period = Column(SQLEnum(BudgetPeriod), nullable=False)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)

    user = relationship("User", back_populates="budgets")
    category = relationship("Category", back_populates="budgets")