import enum

class WalletType(str, enum.Enum):
    cash = "cash"
    bank = "bank"
    credit = "credit"
    e_wallet = "e_wallet"
    asset = "asset"

class CategoryType(str, enum.Enum):
    income = "income"
    expense = "expense"

class TransactionType(str, enum.Enum):
    income = "income"
    expense = "expense"
    transfer = "transfer"
    debt_loan = "debt_loan"
    debt_repayment = "debt_repayment"
    investment_in = "investment_in"
    investment_return = "investment_return"

class DebtType(str, enum.Enum):
    receivable = "receivable" # Phải thu (Cho vay)
    payable = "payable"       # Phải trả (Đi vay)

class InvestmentType(str, enum.Enum):
    stock = "stock"
    gold = "gold"
    crypto = "crypto"
    savings_deposit = "savings_deposit"
    real_estate = "real_estate"

class FrequencyType(str, enum.Enum):
    daily = "daily"
    weekly = "weekly"
    monthly = "monthly"
    yearly = "yearly"

class BudgetPeriod(str, enum.Enum):
    weekly = "weekly"
    monthly = "monthly"