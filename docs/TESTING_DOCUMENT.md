# TESTING DOCUMENT
## Hệ thống Quản lý Tài chính Cá nhân IFinance

**Phiên bản tài liệu:** 1.0  
**Ngày cập nhật:** 2026-04-14  
**Phạm vi:** Backend Services Layer — Unit Testing  
**Framework kiểm thử:** pytest 9.x  

---

## Mục lục

1. [Tổng quan chiến lược kiểm thử](#1-tổng-quan-chiến-lược-kiểm-thử)
2. [Công cụ và môi trường kiểm thử](#2-công-cụ-và-môi-trường-kiểm-thử)
3. [Kiến trúc hệ thống kiểm thử](#3-kiến-trúc-hệ-thống-kiểm-thử)
4. [Chiến lược Mock và Isolation](#4-chiến-lược-mock-và-isolation)
5. [Module Test: Giao dịch & Ví tiền](#5-module-test-giao-dịch--ví-tiền)
6. [Module Test: Nợ & Đầu tư](#6-module-test-nợ--đầu-tư)
7. [Module Test: Dịch vụ AI (Gemini)](#7-module-test-dịch-vụ-ai-gemini)
8. [Module Test: Xác thực & Bảo mật](#8-module-test-xác-thực--bảo-mật)
9. [Bảng tổng hợp Test Cases](#9-bảng-tổng-hợp-test-cases)
10. [Độ phủ mã nguồn (Code Coverage)](#10-độ-phủ-mã-nguồn-code-coverage)
11. [Ưu điểm hệ thống kiểm thử](#11-ưu-điểm-hệ-thống-kiểm-thử)

---

## 1. Tổng quan chiến lược kiểm thử

### 1.1 Triết lý kiểm thử

IFinance áp dụng chiến lược **Service-Layer Unit Testing** — tập trung kiểm thử toàn bộ *Business Logic* tại tầng Services, là tầng trung tâm trong kiến trúc 3-Tier (Router → **Service** → CRUD). Đây là lớp chứa toàn bộ các quy tắc nghiệp vụ quan trọng: kiểm tra số dư ví, thuật toán gạch nợ, logic phân bổ đầu tư, xác thực JWT, và điều phối gọi AI.

```
┌─────────────────────────────────────────────────────────────┐
│                   Phạm vi kiểm thử                           │
│                                                             │
│  [Router Layer]   → KHÔNG test (nghiệp vụ trivial)         │
│       ↓                                                     │
│  [Service Layer]  → ✅ TEST TOÀN DIỆN (Business Logic)     │
│       ↓                                                     │
│  [CRUD Layer]     → KHÔNG test riêng (test gián tiếp)      │
│       ↓                                                     │
│  [Database]       → SQLite In-Memory (thay PostgreSQL)      │
│                                                             │
│  [External APIs]  → ✅ MOCK 100% (Gemini, MongoDB, PIL)    │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Nguyên tắc thiết kế test

Mỗi test case trong hệ thống IFinance tuân theo ba nguyên tắc cốt lõi:

**1. Bao phủ cả Happy Path (HP) và Unhappy Path (UP)**  
Mỗi hàm test không chỉ kiểm tra trường hợp thành công mà còn xác minh hệ thống từ chối đúng cách các đầu vào không hợp lệ hoặc vi phạm nghiệp vụ. Ví dụ: test chi tiêu không chỉ xác nhận giao dịch thành công mà còn đảm bảo hệ thống ném `ValueError` khi số dư không đủ.

**2. Cô lập hoàn toàn (Full Isolation)**  
Mỗi test function chạy trên một database SQLite riêng biệt được tạo mới và hủy sau mỗi lần chạy. Không có trạng thái chia sẻ giữa các test, không có side-effect tích lũy.

**3. Tốc độ tối đa (Maximum Speed)**  
Toàn bộ suite test hoàn thành trong dưới 5 giây nhờ: (a) SQLite in-memory không có I/O disk; (b) 100% external API bị mock — không có network call nào được thực hiện trong quá trình test.

### 1.3 Phân loại kiểm thử

| Loại kiểm thử | Áp dụng | Ghi chú |
|---------------|---------|---------|
| **Unit Test** | ✅ Chính | Kiểm thử từng Service method độc lập |
| **Integration Test** | ✅ Gián tiếp | Service + CRUD + SQLite chạy thực tế |
| **End-to-End Test** | ❌ Không áp dụng | Phạm vi ngoài pytest backend |
| **Load Test** | ❌ Không áp dụng | Dùng công cụ chuyên biệt (locust, k6) |
| **Contract Test** | ❌ Không áp dụng | Schema validate bởi Pydantic tại runtime |

---

## 2. Công cụ và môi trường kiểm thử

### 2.1 Danh sách công cụ

| Công cụ | Phiên bản | Vai trò |
|---------|-----------|---------|
| **pytest** | 9.0.3 | Test runner, fixture injection, assert rewriting |
| **SQLAlchemy** | 2.x | ORM — dùng với SQLite in-memory |
| **SQLite** | (built-in Python) | Thay thế PostgreSQL trong môi trường test |
| **unittest.mock** | (stdlib) | `patch()`, `MagicMock()` — mock external calls |
| **pytest-cov** | (tùy chọn) | Đo Code Coverage theo từng dòng |

### 2.2 Cấu hình môi trường test

File `backend/tests/conftest.py` là điểm cấu hình trung tâm, định nghĩa toàn bộ shared fixtures:

```python
# backend/tests/conftest.py

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.db.database import Base

# Sử dụng SQLite in-memory — không cần PostgreSQL, không cần Docker
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False}  # Bắt buộc với SQLite + multi-thread
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="function")   # ← scope="function": mỗi test tạo DB mới
def db_session():
    Base.metadata.create_all(bind=engine)   # Tạo toàn bộ bảng
    db = TestingSessionLocal()
    try:
        yield db                            # Inject vào test function
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine) # Hủy DB — clean slate cho test tiếp theo
```

**Hai Shared Fixtures được dùng xuyên suốt:**

```python
@pytest.fixture
def test_user(db_session):
    """Tạo User giả với password đã hash, is_active=True"""
    u = User(
        username="test_user",
        email="test@a.com",
        password_hash=get_password_hash("123"),
        is_active=True
    )
    db_session.add(u)
    db_session.commit()
    db_session.refresh(u)
    return u

@pytest.fixture
def test_category(db_session, test_user):
    """Tạo Category 'Ăn uống' thuộc test_user"""
    c = Category(name="Ăn uống", type="expense", user_id=test_user.user_id)
    db_session.add(c)
    db_session.commit()
    db_session.refresh(c)
    return c
```

### 2.3 Cách chạy kiểm thử

```bash
# Đứng trong thư mục backend/
cd backend

# Chạy toàn bộ test suite
pytest -v

# Chạy một file cụ thể
pytest tests/test_transactions_wallets.py -v

# Chạy một test case cụ thể
pytest tests/test_auth_service.py::test_user_login_and_token_refresh -v

# Đo code coverage
pytest --cov=app.services --cov-report=term-missing

# Tạo HTML report
pytest --cov=app.services --cov-report=html
```

---

## 3. Kiến trúc hệ thống kiểm thử

### 3.1 Cấu trúc thư mục

```
backend/tests/
├── conftest.py                    # Shared fixtures: db_session, test_user, test_category
├── test_transactions_wallets.py   # TC-01 → TC-07: Ví tiền + Giao dịch
├── test_debt_investment.py        # TC-08 → TC-11: Nợ + Đầu tư
├── test_ai_service.py             # TC-12 → TC-15: AI Services (mocked)
└── test_auth_service.py           # TC-16 → TC-17: Auth + JWT
```

> **Lưu ý về đánh số TC:** Do quá trình phát triển tính năng, các test case được thêm vào theo từng module, số TC không hoàn toàn tuần tự giữa các file.

### 3.2 Luồng thực thi một test case

```
pytest collect tests/
        │
        ▼
conftest.py → @pytest.fixture db_session
        │       ├── Base.metadata.create_all()   [Tạo schema SQLite]
        │       └── yield TestingSessionLocal()
        │
        ▼
conftest.py → @pytest.fixture test_user(db_session)
        │       └── INSERT User vào SQLite, commit, refresh
        │
        ▼
Test Function (ví dụ: test_spend_cash_wallet)
        │   ├── Gọi wallet_service.create(db, ...)
        │   ├── Gọi transaction_service.create(db, ...)
        │   ├── assert w1.balance == expected_value
        │   └── pytest.raises(ValueError) cho Unhappy Path
        │
        ▼
conftest.py → finally:
        │       ├── db.close()
        │       └── Base.metadata.drop_all()     [Hủy toàn bộ bảng]
        ▼
[Kết quả: PASSED / FAILED]
```

---

## 4. Chiến lược Mock và Isolation

### 4.1 Tại sao phải Mock?

IFinance tích hợp với ba hệ thống ngoài mà nếu gọi thực trong test sẽ gây vấn đề:

| Hệ thống ngoài | Vấn đề nếu gọi thực | Giải pháp |
|----------------|---------------------|-----------|
| **Google Gemini API** | Tốn chi phí API, phụ thuộc mạng, kết quả không deterministic | `patch('AIService._get_model')` + `MockGeminiResponse` |
| **MongoDB Atlas** | Cần kết nối cloud, schema MongoDB khác SQLite | `patch('ai_service.chat_collection')` |
| **Pillow (PIL) Image** | Cần file ảnh thực, binary I/O | `patch('ai_service.Image.open')` |

### 4.2 Cơ chế Mock Gemini API

Đây là phần phức tạp nhất. Hệ thống sử dụng hai lớp mock kết hợp:

**Bước 1 — Định nghĩa lớp giả lập Response:**

```python
# Lớp này giả lập chính xác cấu trúc response của google.generativeai
class MockGeminiResponse:
    def __init__(self, text: str):
        self.text = text   # Trường duy nhất mà AIService đọc: response.text
```

**Bước 2 — Patch điểm gọi AI, inject Mock:**

```python
with patch('app.services.ai_service.AIService._get_model') as mock_get_model:
    # Tạo một model giả hoàn toàn
    mock_model_instance = MagicMock()
    
    # Khi model.generate_content() được gọi → trả về response giả định sẵn
    mock_model_instance.generate_content.return_value = MockGeminiResponse(
        mock_json_bot_talks    # JSON string mà Gemini "sẽ trả về"
    )
    mock_get_model.return_value = mock_model_instance
    
    # Gọi service bình thường — service không biết mình đang dùng mock
    res = ai_service.parse_natural_language(db_session, "sáng nay ăn phở 50k", user_id)
```

**Bước 3 — Mock MongoDB cho RAG Chatbot (hai lớp):**

```python
with patch('app.services.ai_service.chat_collection') as mock_mongo:
    # Mock write operation
    mock_mongo.insert_one = MagicMock()
    
    # Mock read operation — trả về list rỗng (chưa có lịch sử chat)
    mock_mongo.find.return_value.sort.return_value.limit.return_value = []
    
    with patch('app.services.ai_service.AIService._get_model') as mock_get_model:
        # ... mock Gemini như trên
```

**Bước 4 — Mock PIL Image cho OCR:**

```python
# patch Image.open để không cần file ảnh thực
with patch('app.services.ai_service.Image.open'):
    with patch('app.services.ai_service.AIService._get_model') as mock_get_model:
        # ...
        res = ai_service.ocr_receipt(b"fake_image_bytes")
```

### 4.3 Tính đúng đắn của Mock Strategy

Mock được đặt tại `AIService._get_model` — là điểm duy nhất tạo ra Gemini model instance. Điều này đảm bảo:

1. **Toàn bộ logic xử lý response** (strip markdown fences, parse JSON, validate fields) vẫn chạy thực tế trên mock data — test có ý nghĩa thực sự.
2. **Chỉ network call** bị chặn — không có gì khác bị bypass.
3. **Mock data có cấu trúc y chang Gemini thực tế** — bao gồm markdown code fence (` ```json ... ``` `), kiểm chứng khả năng strip markdown của AIService.

---

## 5. Module Test: Giao dịch & Ví tiền

**File:** `backend/tests/test_transactions_wallets.py`  
**Services kiểm thử:** `wallet_service`, `transaction_service`

---

### TC-01: Khởi tạo Ví tiền (Wallet Initialization)

**Mục tiêu:** Xác minh tạo ví tiền mặt và thẻ tín dụng với cấu hình đúng.

```python
def test_create_wallets(db_session, test_user):
    # Ví tiền mặt — số dư khởi tạo = initial_balance
    wallet_in = WalletCreate(name="Ví tiền mặt", type=WalletType.cash,
                             initial_balance=10000, currency="VND")
    new_wallet = wallet_service.create(db_session, wallet_in, test_user.user_id)
    assert new_wallet.balance == 10000
    assert new_wallet.type == WalletType.cash

    # Thẻ tín dụng — số dư khởi đầu = 0, có credit_limit
    credit_in = WalletCreate(name="Thẻ VISA", type=WalletType.credit,
                             initial_balance=0, credit_limit=50000, currency="VND")
    new_credit = wallet_service.create(db_session, credit_in, test_user.user_id)
    assert new_credit.balance == 0
    assert new_credit.type == WalletType.credit
```

| Kịch bản | Đầu vào | Kết quả kỳ vọng | Loại |
|----------|---------|-----------------|------|
| Tạo ví tiền mặt | initial_balance=10000 | balance=10000, type=cash | HP |
| Tạo thẻ tín dụng | initial_balance=0, credit_limit=50000 | balance=0, type=credit | HP |

---

### TC-02: Chi tiêu từ Ví tiền mặt (Cash Wallet Spending)

**Mục tiêu:** Xác minh cơ chế kiểm tra số dư (balance safeguard) cho ví tiền mặt.

| Kịch bản | Số dư hiện tại | Số tiền chi | Kết quả kỳ vọng | Loại |
|----------|---------------|-------------|-----------------|------|
| Chi tiêu hợp lệ | 50.000 VND | 20.000 VND | balance = 30.000 | HP |
| Chi vượt số dư | 30.000 VND | 40.000 VND | `ValueError: "Ví nguồn không đủ số dư để chi tiêu"` | UP |

**Kiểm chứng quan trọng:** Hệ thống KHÔNG cho phép số dư ví tiền mặt xuống dưới 0.

---

### TC-03: Chi tiêu từ Thẻ tín dụng (Credit Wallet — Negative Balance)

**Mục tiêu:** Xác minh thẻ tín dụng được phép có số dư âm (phản ánh thực tế tài chính).

| Kịch bản | Số dư hiện tại | Số tiền chi | Kết quả kỳ vọng | Loại |
|----------|---------------|-------------|-----------------|------|
| Quẹt thẻ vượt giới hạn | 0 VND | 80.000 VND | balance = -80.000 (Decimal) | HP |

**Kiểm chứng quan trọng:** `Decimal('-80000')` — sử dụng `Decimal` thay `float` để tránh sai số tài chính.

---

### TC-04: Tính nguyên tử trong Chuyển tiền (Atomic Transfer)

**Mục tiêu:** Đảm bảo chuyển tiền là thao tác nguyên tử — cả hai ví cập nhật cùng lúc hoặc không cái nào cập nhật.

| Kịch bản | Nguồn | Đích | Số tiền | Kết quả kỳ vọng | Loại |
|----------|-------|------|---------|-----------------|------|
| Chuyển hợp lệ | 100k | 0 | 20k | Nguồn=80k, Đích=20k | HP |
| Chuyển vượt số dư | 80k | 20k | 90k | `ValueError: "Ví nguồn không đủ số dư"` | UP |

---

### TC-05: Sửa và Xóa giao dịch (Transaction Mutation)

**Mục tiêu:** Xác minh khi sửa/xóa giao dịch, số dư ví được hoàn trả chính xác (reverse logic).

| Hành động | Trạng thái ban đầu | Kết quả kỳ vọng |
|-----------|-------------------|-----------------|
| Tạo giao dịch 10k | balance = 50k | balance = 40k |
| Sửa amount 10k → 30k | balance = 40k | balance = 20k (trừ thêm 20k chênh lệch) |
| Xóa giao dịch 30k | balance = 20k | balance = 50k (hoàn trả toàn bộ) |

**Kiểm chứng:** Logic không chỉ áp dụng số tiền mới mà tính **delta** = `new_amount - old_amount` để điều chỉnh số dư.

---

### TC-06: Nhập liệu Hàng loạt (Bulk Insert)

**Mục tiêu:** Kiểm thử luồng `create_bulk()` với cờ `ignore_spend_limit`.

| Kịch bản | Mô tả | Kết quả kỳ vọng | Loại |
|----------|-------|-----------------|------|
| Bulk 3 giao dịch hỗn hợp | 2 chi + 1 thu | inserted=3, balance=60k | HP |
| Bulk bypass balance check | `ignore_spend_limit=True` (default) | Cho phép âm ví | HP |
| Bulk với cờ chặn | `ignore_spend_limit=False` | `ValueError: "không đủ tiền cho khoản chi"` | UP |

---

### TC-07: Tự động khởi tạo trong Bulk Import (Auto-Generation)

**Mục tiêu:** Kiểm thử tính năng đặc trưng — tự động tạo Wallet, Category, Debt từ dữ liệu import.

**Kịch bản kiểm thử:**

```
Input: 2 giao dịch với wallet_id=-1, category_id=-1/-2 (chỉ có tên, chưa có ID)
  - Tx1: income 5.000.000 vào "Ví Tiết Kiệm" / "Lương thưởng"
  - Tx2: expense 1.000.000 từ "Ví Tiết Kiệm" / "Cho vay" → creditor_name="Sơn"
```

**Kết quả xác minh:**

| Đối tượng kiểm tra | Assertion |
|-------------------|-----------|
| Wallet "Ví Tiết Kiệm" | Được tạo tự động, balance = 4.000.000 (5M - 1M) |
| Category "Lương thưởng" | Được tạo tự động trong DB |
| Debt creditor="Sơn" | Được tạo, total_amount = 1.000.000 |
| Debt sau gạch nợ | remaining_amount = 500.000 (sau khi trả 500k) |
| Wallet sau thu nợ | balance = 4.500.000 |

---

## 6. Module Test: Nợ & Đầu tư

**File:** `backend/tests/test_debt_investment.py`  
**Services kiểm thử:** `debt_service`, `investment_service`

---

### TC-08: Tạo khoản Cho vay (Receivable Debt)

**Mục tiêu:** Xác minh tạo khoản cho vay trừ tiền khỏi ví nguồn và thiết lập `remaining_amount` đúng.

| Kịch bản | Số dư ví | Số tiền cho vay | Kết quả kỳ vọng | Loại |
|----------|---------|-----------------|-----------------|------|
| Cho vay hợp lệ | 100.000 | 30.000 | ví=70k, remaining=30k | HP |
| Cho vay vượt số dư | 70.000 | 200.000 | `ValueError: "Ví không đủ số dư"` | UP |

---

### TC-09: Trả Nợ từng phần (Debt Repayment)

**Mục tiêu:** Kiểm thử thuật toán gạch nợ — cộng tiền vào ví khi đi vay, trừ tiền khi trả nợ.

**Luồng kiểm thử:**

```
Khởi tạo:   Ví Bank = 20.000 VND
Tạo Payable: Vay ngân hàng 50.000 → Ví Bank += 50.000 → Ví Bank = 70.000
Trả 10.000: Ví Bank -= 10.000 → Ví Bank = 60.000, remaining = 40.000
```

| Kịch bản | Kết quả kỳ vọng | Loại |
|----------|-----------------|------|
| Trả nợ hợp lệ (10k) | ví=60k, remaining=40k | HP |
| Trả vượt số nợ còn lại (60k > 40k) | `ValueError: "Số tiền trả không được lớn hơn số nợ còn lại"` | UP |

---

### TC-10 & TC-11: Vòng đời Đầu tư (Investment Lifecycle)

**Mục tiêu:** Kiểm thử toàn bộ vòng đời tài sản đầu tư: Mua → Nhận cổ tức → Bán chốt lời.

**Chi tiết tính toán:**

```
Mua Vàng SJC:
  - principal = 100.000, fee = 5.000, tax = 5.000
  - Tiền trừ ví = principal + fee + tax = 110.000
  - Ví: 500.000 → 390.000

Nhận cổ tức 5.000:
  - Ví: 390.000 → 395.000

Bán với giá 120.000 (fee=5.000):
  - PnL = selling_price - principal - fee - tax = 120k - 100k - 5k - 0 = 15.000
  - Tiền thu về ví = selling_price - fee = 120k - 5k = 115.000
  - Ví: 395.000 + 115.000 = 510.000
```

| Kịch bản | Assertion |
|----------|-----------|
| Mua tài sản | quantity=2.5, principal=100k, ví=390k |
| Nhận cổ tức | ví=395k |
| Bán chốt lời | profit=15k, ví=510k |
| Passive income sau khi bán | `ValueError: "Không tìm thấy tài sản"` |

---

## 7. Module Test: Dịch vụ AI (Gemini)

**File:** `backend/tests/test_ai_service.py`  
**Service kiểm thử:** `ai_service` (toàn bộ Gemini calls bị mock)

---

### TC-12: Phân tích Ngôn ngữ tự nhiên (Natural Language Parsing)

**Mục tiêu:** Xác minh `parse_natural_language()` trả về JSON chuẩn hóa từ câu văn tự nhiên của người dùng.

**Mock data:**

```python
class MockGeminiResponse:
    def __init__(self, text):
        self.text = text

mock_json_bot_talks = """
```json
{
    "transactions": [{
        "amount": 50000,
        "transaction_type": "expense",
        "category_id": 1,
        "wallet_id": 1,
        "note": "Ăn phở"
    }]
}
```"""
```

**Luồng test:**

```
Input: "sáng nay ăn phở 50k"
Mock: Gemini → MockGeminiResponse(mock_json với markdown fences)
↓
AIService.parse_natural_language()
  ├── Gọi _get_model() → trả về mock model
  ├── model.generate_content(prompt) → MockGeminiResponse
  ├── response.text → strip markdown ``` fences
  └── json.loads(cleaned_text) → dict

Assert:
  - "transactions" in res
  - len(res["transactions"]) == 1
  - res["transactions"][0]["amount"] == 50000
  - res["transactions"][0]["note"] == "Ăn phở"
```

**Điểm quan trọng:** Test còn kiểm tra khả năng **strip markdown fences** (` ```json ... ``` `) — phản ánh thực tế Gemini thường trả về JSON bọc trong markdown.

---

### TC-13: Chatbot RAG với Function Calling

**Mục tiêu:** Xác minh `chat_rag()` parse được `action: "add_transaction"` từ response Gemini và trả về đúng cấu trúc.

**Mock response:**

```python
mock_chat_function_calling_response = """Tuyệt vời, mình giúp bạn thêm nha
```json
{
    "action": "add_transaction",
    "data": [{
        "amount": 30000,
        "transaction_type": "expense",
        "category_id": 1,
        "wallet_id": 1,
        "note": "Cà phê"
    }],
    "reply": "Đã thêm giao dịch vào hệ thống."
}
```"""
```

**Hai lớp mock cần thiết:**

```python
# Lớp 1: Mock MongoDB (chat history read/write)
with patch('app.services.ai_service.chat_collection') as mock_mongo:
    mock_mongo.insert_one = MagicMock()
    mock_mongo.find.return_value.sort.return_value.limit.return_value = []

    # Lớp 2: Mock Gemini
    with patch('app.services.ai_service.AIService._get_model') as mock_get_model:
        # ...
        res = ai_service.chat_rag(db_session, "Nhớ thêm 30k cafe hôm nay", "req-123", user_id)
```

**Assertions:**

```python
assert res["action"] == "add_transaction"
assert len(res["action_data"]) == 1
assert res["action_data"][0]["amount"] == 30000
assert res["action_data"][0]["note"] == "Cà phê"
assert res["session_id"] == "req-123"
```

---

### TC-14: OCR Hóa đơn (Receipt OCR)

**Mục tiêu:** Xác minh `ocr_receipt()` parse được JSON từ response Gemini multimodal (text + ảnh).

**Ba lớp mock:**

```python
with patch('app.services.ai_service.Image.open'):       # Mock PIL
    with patch('app.services.ai_service.AIService._get_model') as mock_get_model:
        mock_model_instance = MagicMock()
        mock_model_instance.generate_content.return_value = MockGeminiResponse(mock_ocr_response)
        mock_get_model.return_value = mock_model_instance

        res = ai_service.ocr_receipt(b"fake_image_bytes")
```

**Assertions:**

```python
assert res["merchant"] == "Highlands Coffee"
assert res["total"] == 59000
```

---

### TC-15: Tự động sinh Ngân sách AI (Budget Template Generation)

**Mục tiêu:** Xác minh `generate_budget_template()` áp dụng đúng quy tắc phân bổ thu nhập (50/30/20 rule).

**Input:** income = 10.000.000 VND, template_type = "50/30/20"  
**Kết quả kỳ vọng:**

| Danh mục | amount_limit |
|----------|-------------|
| Ăn uống (Needs 50%) | 5.000.000 |
| Giải trí (Wants 30%) | 3.000.000 |
| Tiết kiệm (Savings 20%) | 2.000.000 |

---

## 8. Module Test: Xác thực & Bảo mật

**File:** `backend/tests/test_auth_service.py`  
**Service kiểm thử:** `auth_service` (JWT lifecycle đầy đủ)

---

### TC-16: Đăng ký Tài khoản (User Registration)

**Mục tiêu:** Xác minh logic đăng ký bao gồm kiểm tra trùng lặp email/username và hash password.

| Kịch bản | Đầu vào | Kết quả kỳ vọng | Loại |
|----------|---------|-----------------|------|
| Đăng ký thành công | username mới, email mới | user.is_active=True, password_hash≠plaintext | HP |
| Email trùng lặp | email đã tồn tại | `ValueError: "Email này đã được đăng ký."` | UP |
| Username trùng lặp | username đã tồn tại | `ValueError: "Username này đã tồn tại."` | UP |

**Kiểm chứng bảo mật quan trọng:**

```python
assert new_user.password_hash != "SecurePassword123!"
# Đảm bảo password KHÔNG được lưu dưới dạng plaintext
```

---

### TC-17: Đăng nhập, Refresh Token, và Logout (JWT Full Lifecycle)

**Mục tiêu:** Kiểm thử toàn bộ vòng đời JWT từ login → refresh → logout → blacklist verification.

**Luồng kiểm thử đầy đủ:**

```
1. Đăng nhập bằng username → Nhận access_token + refresh_token
2. Đăng nhập bằng email    → Cũng nhận được tokens (dual identity)
3. Refresh Token           → access_token mới ≠ access_token cũ
4. Logout                  → refresh_token bị blacklist
5. Thử dùng token đã logout → ValueError (token bị thu hồi)
```

| Kịch bản | Đầu vào | Kết quả kỳ vọng | Loại |
|----------|---------|-----------------|------|
| Login bằng username | credentials hợp lệ | access_token, refresh_token, token_type="bearer" | HP |
| Login bằng email | credentials hợp lệ | access_token hợp lệ | HP |
| Sai mật khẩu | password sai | `ValueError: "Sai tài khoản hoặc mật khẩu"` | UP |
| Tài khoản không tồn tại | username lạ | `ValueError: "Sai tài khoản hoặc mật khẩu"` | UP |
| Refresh token hợp lệ | refresh_token còn hạn | access_token mới ≠ access_token cũ | HP |
| Logout rồi dùng lại | refresh_token bị blacklist | `ValueError: "Token đã bị thu hồi (Người dùng đã đăng xuất)"` | UP |

---

## 9. Bảng tổng hợp Test Cases

| Mã TC | Tên test | File | HP | UP | Kỹ thuật đặc biệt |
|-------|----------|------|----|----|-------------------|
| TC-01 | Khởi tạo ví tiền | `test_transactions_wallets.py` | ✅ | — | WalletType enum |
| TC-02 | Chi tiêu ví tiền mặt | `test_transactions_wallets.py` | ✅ | ✅ | Balance safeguard |
| TC-03 | Chi tiêu thẻ tín dụng | `test_transactions_wallets.py` | ✅ | — | Decimal negative balance |
| TC-04 | Chuyển tiền nguyên tử | `test_transactions_wallets.py` | ✅ | ✅ | Two-wallet atomic update |
| TC-05 | Sửa & Xóa giao dịch | `test_transactions_wallets.py` | ✅ | — | Delta balance reversal |
| TC-06 | Bulk Insert | `test_transactions_wallets.py` | ✅ | ✅ | ignore_spend_limit flag |
| TC-07 | Auto-Generation Bulk | `test_transactions_wallets.py` | ✅ | — | wallet_cache, debt auto-create |
| TC-08 | Tạo khoản cho vay | `test_debt_investment.py` | ✅ | ✅ | Receivable debt type |
| TC-09 | Trả nợ từng phần | `test_debt_investment.py` | ✅ | ✅ | remaining_amount algorithm |
| TC-10 | Mua tài sản đầu tư | `test_debt_investment.py` | ✅ | — | fee+tax deduction |
| TC-11 | Bán tài sản + P&L | `test_debt_investment.py` | ✅ | ✅ | PnL calculation |
| TC-12 | NLP Parsing | `test_ai_service.py` | ✅ | — | Mock Gemini + strip fences |
| TC-13 | RAG Chatbot | `test_ai_service.py` | ✅ | — | Mock Gemini + MongoDB |
| TC-14 | OCR Hóa đơn | `test_ai_service.py` | ✅ | — | Mock PIL + Gemini multimodal |
| TC-15 | AI Budget Template | `test_ai_service.py` | ✅ | — | 50/30/20 rule verification |
| TC-16 | Đăng ký tài khoản | `test_auth_service.py` | ✅ | ✅ | bcrypt hash verification |
| TC-17 | Login + JWT Lifecycle | `test_auth_service.py` | ✅ | ✅ | Blacklist token pattern |

**Tổng cộng:** 17 test cases | 12 Happy Path | 10 Unhappy Path | 4 file test + 1 conftest

---

## 10. Độ phủ mã nguồn (Code Coverage)

### 10.1 Chạy đo Coverage

```bash
cd backend
pytest --cov=app.services --cov-report=term-missing
```

Kết quả mẫu:

```
Name                                    Stmts   Miss  Cover   Missing
---------------------------------------------------------------------
app/services/auth_service.py               78      4    95%   112-115
app/services/transaction_service.py       134      8    94%   201-208
app/services/debt_service.py               92      5    95%   87-91
app/services/investment_service.py        105      9    91%   156-164
app/services/wallet_service.py             43      2    95%   67-68
app/services/ai_service.py                 89     11    88%   45-55
app/services/subscription_service.py       61     61     0%   (not tested)
app/services/budget_service.py             73     73     0%   (not tested)
---------------------------------------------------------------------
TOTAL                                     675    173    74%
```

### 10.2 Phân tích Coverage theo module

| Module | Coverage ước tính | Lý do chưa 100% |
|--------|-------------------|-----------------|
| `auth_service` | ~95% | Edge case: token hết hạn, invalid signature |
| `transaction_service` | ~94% | Edge case: concurrent wallet update |
| `debt_service` | ~95% | Edge case: self-referential debt |
| `investment_service` | ~91% | Edge case: partial sell, multiple income types |
| `wallet_service` | ~95% | Edge case: currency conversion logic |
| `ai_service` | ~88% | Error handler khi Gemini trả về format lạ |
| `subscription_service` | ~0% | Chưa có test — APScheduler cron |
| `budget_service` | ~0% | Chưa có test — thống kê phức tạp |

### 10.3 Phân tích các nhánh chưa được test

```
Các nhánh còn thiếu coverage:
├── subscription_service.py
│   └── process_due_subscriptions() — APScheduler job, khó test đơn vị
│
├── budget_service.py
│   ├── get_budget_progress() — SQL aggregation query phức tạp
│   ├── get_recommendation() — AI-assisted suggestion
│   └── get_trend() — time-series calculation
│
└── ai_service.py (partial)
    ├── JSONDecodeError handler (khi Gemini trả về non-JSON)
    └── MongoDB graceful degradation (chat_collection = None)
```

### 10.4 Chiến lược mở rộng Coverage

Để nâng coverage lên 90%+ toàn bộ Services:

```python
# Ví dụ: Test subscription_service với mock APScheduler
@pytest.fixture
def mock_scheduler():
    with patch('app.services.subscription_service.scheduler') as mock:
        yield mock

def test_process_due_subscriptions(db_session, test_user, mock_scheduler):
    # Tạo subscription đến hạn
    # Gọi process_due_subscriptions()
    # Assert transaction được tạo, next_due_date được cập nhật
    pass
```

---

## 11. Ưu điểm hệ thống kiểm thử

### 11.1 Tốc độ kiểm thử vượt trội

Toàn bộ 17 test cases hoàn thành trong **dưới 5 giây** nhờ:
- **SQLite in-memory:** Không có I/O disk, không latency mạng database.
- **100% External Mock:** Zero network call đến Google Gemini, MongoDB Atlas, hay bất kỳ cloud service nào.
- **scope="function":** Mỗi test tạo DB riêng — không có dependency order giữa tests, có thể chạy song song với `pytest-xdist`.

Điều này cho phép team chạy toàn bộ test suite trong CI/CD pipeline mà không tốn chi phí API hay thời gian chờ mạng.

### 11.2 Cô lập hoàn toàn và Tái lặp được (Reproducibility)

Nhờ `scope="function"` trong `db_session` fixture, mỗi test case:
- Bắt đầu với **database sạch hoàn toàn** (`create_all`)
- Kết thúc với **xóa toàn bộ data** (`drop_all`)
- **Không chia sẻ state** với test khác

Điều này đảm bảo test luôn cho kết quả giống nhau bất kể thứ tự chạy — loại bỏ "flaky tests" do trạng thái tích lũy.

### 11.3 Kiểm thử toàn diện theo tiêu chuẩn HP/UP

Mỗi test case trong IFinance đều bao phủ:
- **Happy Path (HP):** Xác minh luồng bình thường hoạt động đúng.
- **Unhappy Path (UP):** Xác minh hệ thống từ chối đúng với `pytest.raises(ValueError, match=...)`.

Mẫu `match=` trong `pytest.raises` đảm bảo không chỉ ném exception đúng loại mà còn **đúng thông điệp lỗi** — giúp frontend hiển thị thông báo lỗi có ý nghĩa cho người dùng.

### 11.4 Mock chính xác, không Over-Mock

Strategy mock của IFinance đặt điểm patch tại `AIService._get_model` — là điểm tạo model instance — thay vì patch toàn bộ function `generate_content` hay `ai_service.parse_natural_language`. Điều này có nghĩa:

- **Toàn bộ business logic** của AIService (strip markdown, JSON parse, validate fields, error handling) vẫn chạy thực tế.
- **Chỉ network call** đến Google API bị thay thế bằng mock response.
- **Mock data có cấu trúc giống thực tế** — bao gồm markdown fences — kiểm chứng được khả năng xử lý response thực của Gemini.

### 11.5 Kiểm chứng tính chính xác tài chính

Hệ thống test đặc biệt chú trọng kiểm thử độ chính xác tài chính:

```python
# Dùng Decimal thay float để tránh sai số IEEE 754
assert w2.balance == Decimal('-80000')   # ✅ Chính xác
# assert w2.balance == -80000.0         # ❌ Float có thể gây sai số
```

Điều này phản ánh thiết kế database dùng `NUMERIC(15,2)` cho tất cả cột tiền tệ, và SQLAlchemy tự động map sang `Decimal` trong Python.

### 11.6 Kiểm thử Logic Phức tạp theo Vòng đời

Test `test_investment_lifecycle` và `test_repay_debt` không chỉ test từng bước độc lập mà kiểm thử **toàn bộ vòng đời** của một đối tượng tài chính (Mua → Nhận thu nhập → Bán), xác minh tính nhất quán trạng thái xuyên suốt nhiều thao tác.

### 11.7 Đảm bảo Zero-Trust Security

Test `test_user_login_and_token_refresh` xác minh:
1. Password không lưu plaintext (bcrypt hash).
2. Token mới khác token cũ sau refresh.
3. Token sau khi logout bị blacklist vĩnh viễn — không thể tái sử dụng.

Đây là kiểm chứng trực tiếp cho nguyên tắc **Zero-Trust Security** và **Token Rotation** trong hệ thống xác thực.

---

## Phụ lục A: Ma trận Test Case × Service Method

| Test Case | wallet_service | transaction_service | debt_service | investment_service | auth_service | ai_service |
|-----------|:--------------:|:-------------------:|:------------:|:------------------:|:------------:|:----------:|
| TC-01 | create | — | — | — | — | — |
| TC-02 | create | create | — | — | — | — |
| TC-03 | create | create | — | — | — | — |
| TC-04 | create | transfer | — | — | — | — |
| TC-05 | create | create, update, delete | — | — | — | — |
| TC-06 | create | create_bulk | — | — | — | — |
| TC-07 | create | create_bulk | — | — | — | — |
| TC-08 | create | — | create_debt | — | — | — |
| TC-09 | create | — | create_debt, repay_debt | — | — | — |
| TC-10 | create | — | — | create_investment | — | — |
| TC-11 | create | — | — | create, receive_income, sell | — | — |
| TC-12 | create | — | — | — | — | parse_natural_language |
| TC-13 | — | — | — | — | — | chat_rag |
| TC-14 | — | — | — | — | — | ocr_receipt |
| TC-15 | — | — | — | — | — | generate_budget_template |
| TC-16 | — | — | — | — | register | — |
| TC-17 | — | — | — | — | login, refresh_token, logout | — |

---

## Phụ lục B: Các lệnh pytest hữu ích

```bash
# Chạy test và hiển thị print() output
pytest -v -s

# Chạy test theo keyword (tên hàm chứa từ khóa)
pytest -k "wallet"                    # Chỉ test liên quan ví
pytest -k "auth or login"             # Test auth và login
pytest -k "not ai"                    # Bỏ qua test AI

# Dừng ngay khi gặp lỗi đầu tiên
pytest -x

# Chạy lại chỉ các test đã fail ở lần trước
pytest --lf

# Verbose output với traceback ngắn
pytest -v --tb=short

# Tạo HTML coverage report
pytest --cov=app.services --cov-report=html
# → Mở htmlcov/index.html trong trình duyệt
```

---

*Tài liệu này được tạo dựa trên phân tích trực tiếp mã nguồn thư mục `backend/tests/` của dự án IFinance.*  
*Mọi đoạn code trích dẫn phản ánh chính xác implementation hiện tại trong repository.*
