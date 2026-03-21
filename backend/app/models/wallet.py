from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.database import Base

class Wallet(Base):
    __tablename__ = "wallets"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False) # VD: Tiền mặt, Vietcombank
    type = Column(String(20), nullable=False)  # VD: cash, bank, credit
    balance = Column(Float, default=0.0)       # Số dư hiện tại (Credit có thể âm)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationship để truy xuất ngược
    user = relationship("User", backref="wallets")