# TỔNG QUAN HỆ THỐNG IFINANCE
## Tài liệu Phân tích Kiến trúc & Kỹ thuật (Dành cho Báo cáo Đồ án)

---

## 1. MỤC TIÊU HỆ THỐNG

**IFinance** là nền tảng quản lý tài chính cá nhân thông minh, được xây dựng nhằm giải quyết bài toán **phân tán dữ liệu tài chính** — một người dùng thường có nhiều ví (tiền mặt, ngân hàng, ví điện tử), nhiều khoản chi tiêu định kỳ, nhiều danh mục đầu tư và nợ vay, nhưng thiếu một công cụ tổng hợp duy nhất đủ thông minh để tự động hóa việc ghi chép và phân tích.

**Ba mục tiêu cốt lõi:**

| # | Mục tiêu | Hiện thực hóa |
|---|----------|--------------|
| 1 | **Tự động hóa nhập liệu** | AI Gemini Flash phân tích ngôn ngữ tự nhiên, OCR hóa đơn, Smart Bulk Import từ CSV/Excel |
| 2 | **Tổng hợp toàn diện** | Đa ví, đa danh mục, quản lý đầu tư (cổ phiếu, crypto, vàng), sổ nợ, ngân sách |
| 3 | **Tư vấn chủ động** | Chatbot RAG dùng lịch sử tài chính thực của người dùng; cảnh báo ngân sách; tự động trừ gói định kỳ |

---

## 2. CÁC MODULE CHÍNH

Hệ thống được tổ chức thành **9 module nghiệp vụ** độc lập:

```
┌──────────────────────────────────────────────────────────────────┐
│                        IFinance Modules                          │
├──────────────┬───────────────────────────────────────────────────┤
│  Auth         │  Đăng ký / Đăng nhập / Google OAuth2             │
│  Wallets      │  Đa ví (tiền mặt, ngân hàng, thẻ tín dụng,      │
│               │  ví điện tử, tài sản)                            │
│  Transactions │  Thu / Chi / Chuyển khoản nội bộ / Bulk Import   │
│  Categories   │  Danh mục phân cấp (cha – con), mặc định + tùy chỉnh │
│  Budgets      │  Ngân sách theo kỳ, rollover, cảnh báo vượt hạn mức │
│  Debts        │  Sổ nợ (cho vay / vay mượn), trả góp, lãi suất  │
│  Investments  │  Danh mục đầu tư, ROI, thu nhập thụ động,        │
│               │  giá thời gian thực                              │
│  Subscriptions│  Chi tiêu định kỳ, APScheduler tự động trừ hàng ngày │
│  AI Services  │  NLP parsing, OCR, RAG Chatbot,                  │
│               │  Function Calling, Smart Bulk Import             │
└──────────────┴───────────────────────────────────────────────────┘
```

---

## 3. KIẾN TRÚC HỆ THỐNG

### 3.1 Tổng quan kiến trúc tổng thể

IFinance áp dụng kiến trúc **Client–Server** phân tách hoàn toàn, triển khai trên 3 nền tảng cloud độc lập:

```
┌─────────────────────────────────────────────────────────────┐
│                    PRODUCTION ARCHITECTURE                   │
│                                                             │
│   [User Browser]                                            │
│        │                                                    │
│        ▼                                                    │
│   ┌─────────────────┐      HTTPS/REST      ┌─────────────┐ │
│   │  Frontend        │ ─────────────────▶  │   Backend   │ │
│   │  React 19 + Vite │                     │  FastAPI    │ │
│   │  Vercel (CDN)    │ ◀─────────────────  │  Render.com │ │
│   └─────────────────┘    JSON Responses    └──────┬──────┘ │
│                                                   │        │
│                                          ┌────────┴──────┐ │
│                                          │   Databases   │ │
│                                          │ PostgreSQL    │ │
│                                          │ (Supabase)    │ │
│                                          │ MongoDB Atlas │ │
│                                          └───────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Kiến trúc Backend — Mô hình 3-Tier

Backend tuân theo mô hình **3-Tier (Router – Service – CRUD)** — phân tách rõ ràng ba lớp trách nhiệm:

```
HTTP Request
     │
     ▼
┌────────────────────────────────────────────────────┐
│  LAYER 1: ROUTERS  (app/api/v1/routers/)            │
│  • Tiếp nhận HTTP request, validate input (Pydantic)│
│  • Xử lý xác thực JWT (Depends(get_current_user))  │
│  • Không chứa business logic                        │
└────────────────────┬───────────────────────────────┘
                     │ Gọi hàm service
                     ▼
┌────────────────────────────────────────────────────┐
│  LAYER 2: SERVICES  (app/services/)                 │
│  • Xử lý toàn bộ Business Logic cốt lõi            │
│  • Kiểm tra số dư, validate quyền truy cập          │
│  • Gọi AI API (Gemini), tính toán phức tạp          │
│  • Gọi CRUD để truy vấn/ghi Database               │
└────────────────────┬───────────────────────────────┘
                     │ Gọi hàm CRUD
                     ▼
┌────────────────────────────────────────────────────┐
│  LAYER 3: CRUD  (app/crud/)                         │
│  • Trực tiếp tương tác SQLAlchemy ORM               │
│  • CRUDBase generic: get, get_multi, create,        │
│    update, remove — tái sử dụng toàn module         │
│  • Không chứa business logic                        │
└────────────────────┬───────────────────────────────┘
                     │ SQLAlchemy query
                     ▼
             PostgreSQL Database
```

**Lý do lựa chọn mô hình này:**

- **Dễ kiểm thử độc lập (Unit Test)**: Services được test bằng SQLite in-memory, CRUD mock hoàn toàn, không phụ thuộc infrastructure thật.
- **Dễ mở rộng**: Thêm tính năng mới chỉ cần tạo router/service/crud mới, không ảnh hưởng module khác.
- **Tái sử dụng**: `CRUDBase` generic class cung cấp sẵn 5 phương thức cơ bản cho tất cả entity.

### 3.3 Kiến trúc Frontend — Component-Based với Context API

```
frontend/src/
├── api/            # axiosClient: JWT auto-attach, 401 auto-refresh, toast errors
├── contexts/       # UserContext (auth state) + TutorialContext (onboarding)
├── pages/          # 13 màn hình chức năng (lazy-loaded per route)
├── components/     # Reusable UI: Sidebar, BottomNav, CurrencyInput, ImportModal
├── tutorial/       # react-joyride step definitions (desktop + mobile)
└── utils/          # formatCurrency, formatDate, waitForElement, analytics
```

**Điểm nổi bật kiến trúc Frontend:**

- **Axios Interceptors toàn cục**: Mọi request tự động đính kèm JWT token. Khi nhận 401, interceptor tự động gọi `/auth/refresh-token`, cập nhật token mới và retry request gốc — người dùng không bao giờ bị ngắt session đột ngột.
- **React Context API**: `UserContext` giữ trạng thái người dùng toàn cục; `TutorialContext` điều phối tour hướng dẫn với `React.lazy` để không tải thư viện `react-joyride` cho user đã xem.
- **Responsive Architecture**: Desktop dùng `Sidebar.jsx`; Mobile dùng `BottomNav.jsx`. Tutorial tự động chuyển bộ steps khi resize cửa sổ.

---

## 4. LƯỢC ĐỒ CƠ SỞ DỮ LIỆU

### 4.1 Sơ đồ quan hệ thực thể (ERD — tóm tắt)

```
users (1) ──────── (N) wallets
users (1) ──────── (N) categories  [user_id nullable = system defaults]
users (1) ──────── (N) transactions
users (1) ──────── (N) debts
users (1) ──────── (N) investments
users (1) ──────── (N) subscriptions
users (1) ──────── (N) budgets

categories (1) ─── (N) categories        [self-referential: parent_id]
transactions (1) ── (1) debt_repayments  [1-to-1 unique FK]
debts (1) ─────── (N) debt_repayments
wallets (1) ──────── (N) transactions
wallets (1) ──────── (N) investments
wallets (1) ──────── (N) subscriptions
categories (1) ──── (N) transactions
categories (1) ──── (N) budgets
categories (1) ──── (N) subscriptions
```

### 4.2 Các bảng chính

| Bảng | Số cột chính | Đặc điểm nổi bật |
|------|-------------|-----------------|
| `users` | 8 | `has_seen_tutorial`, cascade delete toàn bộ dữ liệu con |
| `wallets` | 8 | `type` ENUM 5 loại, `credit_limit` cho thẻ tín dụng |
| `categories` | 6 | Self-referential FK `parent_id` (danh mục phân cấp) |
| `transactions` | 10 | `transaction_type` ENUM 7 loại, `images`/`ocr_data` lưu JSON |
| `debts` | 9 | `is_installment`, `remaining_amount` tự cập nhật |
| `debt_repayments` | 5 | FK `transaction_id` UNIQUE (1-to-1 với giao dịch) |
| `investments` | 11 | `current_value` nullable, `total_passive_income` tích lũy |
| `subscriptions` | 10 | `frequency` ENUM 4 kỳ hạn, `next_due_date` cho APScheduler |
| `budgets` | 9 | `is_rollover`, `period` ENUM (weekly/monthly) |
| `token_blacklist` | 3 | JWT logout blacklist, indexed `token` column |

### 4.3 Chi tiết schema từng bảng

#### Bảng `users`
| Cột | Kiểu dữ liệu | Ràng buộc |
|-----|-------------|----------|
| `user_id` | INT | PK, auto-increment |
| `username` | VARCHAR(50) | UNIQUE, NOT NULL, indexed |
| `email` | VARCHAR(100) | UNIQUE, NOT NULL, indexed |
| `password_hash` | VARCHAR(255) | NOT NULL |
| `full_name` | VARCHAR(100) | nullable |
| `is_active` | BOOLEAN | default = true |
| `has_seen_tutorial` | BOOLEAN | default = false |
| `created_at` | TIMESTAMP | server default = NOW() |

#### Bảng `wallets`
| Cột | Kiểu dữ liệu | Ràng buộc |
|-----|-------------|----------|
| `wallet_id` | INT | PK, auto-increment |
| `user_id` | INT | FK → users, cascade delete |
| `name` | VARCHAR(100) | NOT NULL |
| `type` | ENUM | cash / bank / credit / e_wallet / asset |
| `balance` | DECIMAL(15,2) | default = 0 |
| `currency` | VARCHAR(10) | default = "VND" |
| `is_active` | BOOLEAN | default = true |
| `credit_limit` | DECIMAL(15,2) | default = 0 |

#### Bảng `categories`
| Cột | Kiểu dữ liệu | Ràng buộc |
|-----|-------------|----------|
| `category_id` | INT | PK, auto-increment |
| `user_id` | INT | FK → users, nullable (system defaults) |
| `parent_id` | INT | FK → categories (self-referential), nullable |
| `name` | VARCHAR(100) | NOT NULL |
| `type` | ENUM | income / expense |
| `icon` | VARCHAR(255) | nullable |

#### Bảng `transactions`
| Cột | Kiểu dữ liệu | Ràng buộc |
|-----|-------------|----------|
| `transaction_id` | INT | PK, auto-increment |
| `user_id` | INT | FK → users, cascade delete |
| `wallet_id` | INT | FK → wallets |
| `category_id` | INT | FK → categories |
| `transaction_type` | ENUM | income / expense / transfer / debt_loan / debt_repayment / investment_in / investment_return |
| `amount` | DECIMAL(15,2) | NOT NULL, always positive |
| `date` | TIMESTAMP | NOT NULL |
| `note` | TEXT | nullable |
| `images` | JSON | nullable (receipt photos) |
| `ocr_data` | JSON | nullable (extracted receipt data) |

#### Bảng `debts`
| Cột | Kiểu dữ liệu | Ràng buộc |
|-----|-------------|----------|
| `debt_id` | INT | PK, auto-increment |
| `user_id` | INT | FK → users, cascade delete |
| `creditor_name` | VARCHAR(150) | NOT NULL |
| `total_amount` | DECIMAL(15,2) | NOT NULL |
| `remaining_amount` | DECIMAL(15,2) | tự cập nhật sau mỗi lần trả |
| `type` | ENUM | receivable / payable |
| `interest_rate` | FLOAT | nullable |
| `due_date` | DATE | nullable |
| `is_installment` | BOOLEAN | default = false |

#### Bảng `investments`
| Cột | Kiểu dữ liệu | Ràng buộc |
|-----|-------------|----------|
| `investment_id` | INT | PK, auto-increment |
| `user_id` | INT | FK → users, cascade delete |
| `wallet_id` | INT | FK → wallets |
| `name` | VARCHAR(150) | NOT NULL |
| `type` | ENUM | stock / gold / crypto / savings_deposit / real_estate |
| `quantity` | DECIMAL(20,8) | hỗ trợ crypto thập phân |
| `principal_amount` | DECIMAL(15,2) | vốn đầu tư ban đầu |
| `current_value` | DECIMAL(15,2) | nullable, cập nhật theo giá thị trường |
| `total_passive_income` | DECIMAL(15,2) | default = 0 |
| `start_date` | DATE | nullable |

#### Bảng `subscriptions`
| Cột | Kiểu dữ liệu | Ràng buộc |
|-----|-------------|----------|
| `subscription_id` | INT | PK, auto-increment |
| `user_id` | INT | FK → users, cascade delete |
| `default_wallet_id` | INT | FK → wallets |
| `category_id` | INT | FK → categories |
| `name` | VARCHAR(150) | NOT NULL |
| `amount` | DECIMAL(15,2) | NOT NULL |
| `frequency` | ENUM | daily / weekly / monthly / yearly |
| `next_due_date` | DATE | nullable, do APScheduler cập nhật |
| `is_active` | BOOLEAN | default = true |

#### Bảng `budgets`
| Cột | Kiểu dữ liệu | Ràng buộc |
|-----|-------------|----------|
| `budget_id` | INT | PK, auto-increment |
| `user_id` | INT | FK → users, cascade delete |
| `category_id` | INT | FK → categories |
| `amount_limit` | DECIMAL(15,2) | NOT NULL |
| `period` | ENUM | weekly / monthly |
| `is_rollover` | BOOLEAN | default = false |
| `start_date` | DATE | nullable |
| `end_date` | DATE | nullable |

**Hai cơ sở dữ liệu song song:**

- **PostgreSQL** (Supabase/Neon): Toàn bộ dữ liệu quan hệ tài chính — transactional ACID.
- **MongoDB Atlas**: Lịch sử hội thoại chatbot AI (RAG context) — schema-free, tốc độ đọc/ghi cao.

---

## 5. LUỒNG DỮ LIỆU CHÍNH

### 5.1 Luồng xác thực (Authentication Flow)

```
[User] → POST /auth/register
         → Bcrypt hash password
         → INSERT users
         → Return 201 Created

[User] → POST /auth/login
         → Verify password hash (Bcrypt)
         → Create JWT access token (60 phút) + refresh token (7 ngày)
         → Return { access_token, refresh_token }

[User] → Request với Bearer token
         → deps.get_current_user() decode JWT
         → SELECT user WHERE user_id = token.sub
         → Inject current_user vào route handler

[User] → POST /auth/logout
         → INSERT token_blacklist (invalidate token)

[User] → POST /auth/refresh
         → Verify refresh token, check NOT IN blacklist
         → Issue new access token

[User] → POST /auth/google
         → Verify Google ID token (Google API)
         → Upsert user (INSERT or SELECT existing)
         → Return JWT pair
```

### 5.2 Luồng giao dịch (Transaction Flow)

```
[User] → POST /transactions
         │
         ▼ Router: validate Pydantic schema
         │
         ▼ Service: transaction_service.create_transaction()
              ├── Kiểm tra wallet thuộc về user
              ├── Kiểm tra balance >= amount (nếu expense)
              ├── UPDATE wallet.balance (+/-)
              ├── INSERT transaction record
              └── Nếu type = debt_repayment:
                      UPDATE debt.remaining_amount
                      INSERT debt_repayment record
         │
         ▼ CRUD: flush to PostgreSQL
         │
         ▼ Return TransactionResponse
```

### 5.3 Luồng AI Smart Input (NLP Parsing)

```
[User] → POST /ai/parse
         { "text": "Sáng nay đổ xăng 50k bằng tiền mặt" }
         │
         ▼ Service: ai_service.parse_natural_language()
              ├── Query wallets & categories của user từ DB
              ├── Build prompt với context (danh sách ví,
              │   danh mục, ngày hôm nay)
              ├── Call Gemini Flash 2.5 API
              ├── Parse JSON response
              └── Return List[TransactionCreate] (preview)
         │
         ▼ Frontend hiển thị preview
         │
         ▼ User xác nhận → POST /transactions (lưu thật)
```

### 5.4 Luồng Chatbot RAG (Retrieval-Augmented Generation)

```
[User] → POST /ai/chat
         { "message": "Tháng này tôi chi bao nhiêu?" }
         │
         ▼ Service: ai_service.chat()
              ├── Load lịch sử hội thoại từ MongoDB (session_id)
              ├── Query giao dịch gần nhất từ PostgreSQL
              ├── Build context prompt:
              │     - Lịch sử chat (MongoDB)
              │     - Dữ liệu tài chính thực của user (PostgreSQL)
              ├── Call Gemini Flash với Function Calling enabled
              │     ├── AI tự gọi tool "create_transaction"
              │     │   nếu user muốn ghi nhận giao dịch
              │     └── AI trả lời với số liệu thực tế
              ├── Save message + response vào MongoDB
              └── Return AI response
```

### 5.5 Luồng Smart Bulk Import

```
[User] → Upload file CSV / Excel
         │
         ▼ Frontend: Papa Parse / SheetJS đọc file
         │
         ▼ Fuzzy Matching: tự động ghép cột
         │   (VD: "Ngày" → date, "Số tiền" → amount)
         │
         ▼ Preview mapping, user xác nhận
         │
         ▼ POST /transactions/bulk
              ├── Phát hiện danh mục lạ ("Trà Camm")
              │   → Auto-create category mới
              ├── Phát hiện ví mới ("BIDV")
              │   → Auto-create wallet mới
              ├── Phát hiện "Vay anh Sơn"
              │   → Auto-create debt contract
              │   → Auto-create debt repayment khi gặp GD hoàn trả
              └── Bulk INSERT transactions
```

### 5.6 Luồng Subscription Worker (Tự động hóa định kỳ)

```
[APScheduler] → Mỗi ngày lúc 00:01
                → process_due_subscriptions()
                     │
                     ▼
                SELECT subscriptions
                WHERE next_due_date <= TODAY
                AND is_active = true
                     │
                For each subscription:
                ├── INSERT transaction (expense type)
                ├── UPDATE wallet.balance (trừ tiền)
                └── UPDATE next_due_date (+= frequency)
```

---

## 6. CÁC CHỨC NĂNG CHÍNH & USE CASE

### 6.1 Bảng chức năng tổng hợp

| STT | Mã | Chức năng | Mô tả |
|-----|----|-----------|-------|
| 1 | F01 | Đăng ký / Đăng nhập | Username/email + password, Google OAuth2, JWT token pair |
| 2 | F02 | Quản lý Ví tiền | Tạo/sửa/xóa ví; 5 loại ví; theo dõi số dư thời gian thực |
| 3 | F03 | Ghi nhận Giao dịch | Thu / Chi / Chuyển khoản nội bộ, đính kèm ảnh hóa đơn |
| 4 | F04 | Smart Input AI | Nhập giao dịch bằng câu lệnh tự nhiên tiếng Việt |
| 5 | F05 | OCR Hóa đơn | Chụp / upload ảnh biên lai → AI Gemini trích xuất dữ liệu |
| 6 | F06 | Smart Bulk Import | Upload CSV/Excel → Fuzzy mapping → Auto-create ví/danh mục/nợ → Bulk insert |
| 7 | F07 | Quản lý Danh mục | Danh mục phân cấp cha–con, hệ thống mặc định + tùy chỉnh |
| 8 | F08 | Ngân sách thông minh | Đặt hạn mức, theo dõi tiến độ, rollover, gợi ý 50-30-20 |
| 9 | F09 | Sổ Nợ | Cho vay / vay mượn, trả góp, theo dõi dư nợ còn lại |
| 10 | F10 | Quản lý Đầu tư | Cổ phiếu, crypto, vàng, BĐS; giá thời gian thực (vnstock, CoinGecko) |
| 11 | F11 | Chi tiêu Định kỳ | Đăng ký gói, APScheduler tự động trừ tiền hàng ngày |
| 12 | F12 | Chatbot AI (RAG) | Trả lời câu hỏi tài chính từ dữ liệu thực; Function Calling tự ghi GD |
| 13 | F13 | Dashboard & Thống kê | Biểu đồ thu/chi theo thời gian, phân bổ danh mục, tổng tài sản ròng |
| 14 | F14 | Tutorial tương tác | Tour hướng dẫn react-joyride khi đăng ký lần đầu, responsive Desktop/Mobile |
| 15 | F15 | Bảo mật đa lớp | JWT + Token Blacklist + Bcrypt + Rate Limiting (slowapi) |

### 6.2 Use Case chi tiết

#### UC-01: Nhập giao dịch bằng AI (Smart Input)
- **Actor**: Người dùng đã đăng nhập
- **Tiền điều kiện**: Đã có ít nhất 1 ví và 1 danh mục
- **Luồng chính**:
  1. User gõ câu lệnh tự nhiên: "Hôm nay ăn sáng 30k, cafe 25k, đổ xăng 50k tiền mặt"
  2. Hệ thống gọi Gemini Flash với context danh sách ví + danh mục của user
  3. AI trả về mảng JSON gồm 3 giao dịch đã phân tích
  4. Frontend hiển thị preview để user xác nhận hoặc chỉnh sửa
  5. User confirm → Hệ thống lưu đồng loạt vào DB, cập nhật số dư ví
- **Điểm đặc biệt**: Xử lý đa giao dịch trong một câu duy nhất

#### UC-02: Smart Bulk Import
- **Actor**: Người dùng muốn import dữ liệu lịch sử
- **Tiền điều kiện**: Có file CSV/Excel với dữ liệu giao dịch cũ
- **Luồng chính**:
  1. User upload file → Frontend đọc và hiển thị preview cột
  2. Fuzzy Matching tự động ghép cột (dùng Levenshtein distance)
  3. Hệ thống phát hiện danh mục/ví chưa tồn tại → Đề xuất auto-create
  4. Phát hiện pattern "Vay [tên]" → Tự tạo debt contract
  5. User xác nhận → Bulk INSERT toàn bộ, auto-create các entity thiếu
- **Điểm đặc biệt**: Auto Debt Tracking — gạch nợ tự động trong vòng lặp import

#### UC-03: Chatbot RAG tư vấn tài chính
- **Actor**: Người dùng
- **Luồng chính**:
  1. User hỏi: "Tháng này tôi chi nhiều nhất vào đâu?"
  2. AI load lịch sử chat từ MongoDB + query giao dịch thực từ PostgreSQL
  3. Build prompt với ngữ cảnh tài chính thực của user
  4. Gemini Flash trả lời với số liệu chính xác
  5. Nếu user nói "ghi nhận luôn cho tôi", AI tự gọi Function Calling để INSERT transaction
- **Điểm đặc biệt**: RAG dùng dữ liệu tài chính *thực* của người dùng, không phải dữ liệu chung

#### UC-04: Tự động trừ gói định kỳ
- **Actor**: Hệ thống (APScheduler background worker)
- **Tiền điều kiện**: User đã đăng ký subscription với `next_due_date`
- **Luồng chính**:
  1. Mỗi ngày 00:01, `process_due_subscriptions()` được kích hoạt
  2. Query tất cả subscriptions có `next_due_date <= TODAY`
  3. Với mỗi subscription: tạo giao dịch expense + trừ số dư ví + cập nhật `next_due_date`
  4. Catch-up mechanism: xử lý nhiều kỳ bị bỏ lỡ nếu server bị downtime
- **Điểm đặc biệt**: Hoàn toàn tự động, không cần user thao tác

---

## 7. CÔNG NGHỆ SỬ DỤNG

### 7.1 Tech Stack chi tiết

| Lớp | Công nghệ | Phiên bản | Vai trò |
|-----|-----------|----------|---------|
| **Frontend Framework** | React | 19.2.4 | UI Component Library |
| **Build Tool** | Vite | — | Dev server, HMR, production bundling |
| **CSS Framework** | Tailwind CSS | 4.2.2 | Utility-first responsive styling |
| **HTTP Client** | Axios | — | REST API calls với interceptors |
| **Charting** | Recharts | — | Biểu đồ thu/chi, phân bổ danh mục |
| **Tour/Onboarding** | react-joyride | v3 | Interactive tutorial overlay (lazy-loaded) |
| **Icons** | Lucide Icons | — | Bộ icon SVG nhất quán |
| **Toast Notification** | React Hot Toast | — | Thông báo realtime |
| **Backend Framework** | FastAPI | 0.135.1 | REST API, async, OpenAPI docs tự động |
| **ORM** | SQLAlchemy | — | Database abstraction layer |
| **Migration** | Alembic | — | Schema version control với lịch sử |
| **Validation** | Pydantic v2 | — | Request/Response type safety |
| **Job Scheduler** | APScheduler | — | Background subscription worker |
| **Rate Limiting** | slowapi | — | Request throttling trên AI endpoints |
| **Testing** | pytest | — | Unit test framework |
| **AI Model** | Google Gemini Flash 2.5 | — | NLP, OCR, RAG, Function Calling |
| **Primary DB** | PostgreSQL | — | Dữ liệu quan hệ ACID (Supabase/Neon) |
| **Chat History DB** | MongoDB Atlas | — | Lịch sử hội thoại AI (schema-free) |
| **Authentication** | JWT HS256 + Bcrypt | — | Stateless auth + password hashing |
| **Social Auth** | Google OAuth2 | — | Social login |
| **Stock Data** | vnstock API | — | Giá cổ phiếu Việt Nam thời gian thực |
| **Crypto Data** | CoinGecko API | — | Giá tiền điện tử thời gian thực |
| **Containerization** | Docker + Docker Compose | — | Môi trường phát triển nhất quán |
| **Hosting FE** | Vercel | — | CDN + CI/CD auto-deploy |
| **Hosting BE** | Render.com | — | Cloud server + auto-deploy |

### 7.2 Lý do lựa chọn công nghệ

| Công nghệ | Lý do lựa chọn |
|-----------|---------------|
| **FastAPI** | Async native, tự sinh OpenAPI docs, type safety qua Pydantic — tối ưu cho API-first |
| **React 19 + Vite** | SPA thuần, không cần SSR — Vite cho DX tốt hơn và build nhanh hơn |
| **PostgreSQL** | JSON columns, self-referential FK (category hierarchy), DECIMAL precision cho tài chính |
| **MongoDB** | Chat history không có schema cố định, cần đọc nhanh theo session_id — NoSQL tối ưu |
| **Gemini Flash 2.5** | Chi phí thấp, độ trễ thấp, hỗ trợ Function Calling — cân bằng hiệu năng và chi phí |
| **APScheduler** | Nhúng trực tiếp vào FastAPI process, không cần infrastructure riêng (Celery/Redis) |
| **react-joyride v3** | Lazy-loaded, responsive, controlled mode — phù hợp onboarding không can thiệp UX |

---

## 8. KIẾN TRÚC BẢO MẬT

```
┌─────────────────────────────────────────────────────────────┐
│                      SECURITY LAYERS                         │
│                                                             │
│  Lớp 1 — TRANSPORT                                          │
│    HTTPS toàn bộ (Vercel + Render enforce SSL/TLS)          │
│                                                             │
│  Lớp 2 — AUTHENTICATION                                     │
│    • JWT Access Token (hết hạn 60 phút)                     │
│    • JWT Refresh Token (hết hạn 7 ngày)                     │
│    • Token Blacklist: logout invalidation (PostgreSQL)       │
│    • Bcrypt password hashing (salt rounds mặc định = 12)    │
│    • Google OAuth2 ID Token verification                     │
│                                                             │
│  Lớp 3 — AUTHORIZATION                                      │
│    • Mọi protected endpoint dùng Depends(get_current_user)  │
│    • User chỉ truy cập được dữ liệu của chính mình          │
│    • WHERE user_id = current_user.user_id trên mọi query    │
│                                                             │
│  Lớp 4 — RATE LIMITING                                      │
│    • slowapi throttling trên AI endpoints                    │
│    • HTTP 429 Too Many Requests khi vượt giới hạn           │
│                                                             │
│  Lớp 5 — CORS POLICY                                        │
│    • Whitelist: localhost:5173 + *.vercel.app               │
│    • allow_credentials: true                                │
└─────────────────────────────────────────────────────────────┘
```

---

## 9. HỆ THỐNG KIỂM THỬ (UNIT TESTING)

IFinance sử dụng **pytest** với chiến lược test tầng Service — lớp chứa toàn bộ business logic.

### 9.1 Bảng test modules

| File Test | Nội dung kiểm thử |
|-----------|------------------|
| `test_transactions_wallets.py` | Tạo giao dịch, cập nhật số dư ví, chuyển khoản nội bộ, kiểm tra số dư âm |
| `test_debt_investment.py` | Tạo nợ, trả góp, tính dư nợ còn lại, giao dịch đầu tư, ROI |
| `test_ai_service.py` | Mock Gemini API, test NLP parsing, OCR extraction, Budget Planning |
| `test_auth_service.py` | Đăng ký/login, blacklist token, Zero-Trust kiểm tra token bị thu hồi |

### 9.2 Nguyên tắc kiểm thử

- **Database**: `sqlite:///:memory:` — biệt lập hoàn toàn, không tác động production
- **AI API**: Mock 100% — test siêu nhanh (< 5 giây), không phát sinh chi phí Gemini API
- **Coverage target**: Toàn bộ Service layer (business logic path)
- **Isolation**: Mỗi test case tạo DB mới, không phụ thuộc lẫn nhau

### 9.3 Lệnh chạy test

```bash
# Di chuyển vào thư mục backend
cd backend

# Chạy toàn bộ test suite
pytest -v

# Kiểm tra độ phủ mã nguồn (Code Coverage)
pytest --cov=app.services --cov-report=term-missing
```

---

## 10. CẤU TRÚC DỰ ÁN ĐẦY ĐỦ

```
IFinance/
├── backend/                          # Source code Backend (FastAPI)
│   ├── alembic/                      # Migration Database (lịch sử schema changes)
│   ├── app/
│   │   ├── api/v1/routers/           # [Lớp 1] Routers — 10 modules
│   │   │   ├── auth.py               # Đăng ký, đăng nhập, Google OAuth, refresh, logout
│   │   │   ├── wallet.py             # CRUD ví tiền, tổng tài sản ròng
│   │   │   ├── category.py           # CRUD danh mục phân cấp
│   │   │   ├── transaction.py        # CRUD giao dịch, chuyển khoản, bulk import
│   │   │   ├── debt.py               # CRUD nợ, trả góp
│   │   │   ├── budget.py             # CRUD ngân sách, tiến độ
│   │   │   ├── investment.py         # CRUD đầu tư, cập nhật giá, thu nhập thụ động
│   │   │   ├── subscription.py       # CRUD gói định kỳ
│   │   │   ├── ai.py                 # Smart Input, OCR, Chatbot RAG, Bulk Import
│   │   │   └── user.py               # Profile, đổi mật khẩu, preferences
│   │   ├── services/                 # [Lớp 2] Services — Business Logic
│   │   │   ├── auth_service.py
│   │   │   ├── transaction_service.py
│   │   │   ├── debt_service.py
│   │   │   ├── budget_service.py
│   │   │   ├── investment_service.py
│   │   │   ├── subscription_service.py
│   │   │   ├── subscription_worker.py  # APScheduler background job
│   │   │   ├── ai_service.py           # Gemini integration (NLP/OCR/RAG)
│   │   │   ├── stock_service.py        # vnstock API integration
│   │   │   └── user_service.py
│   │   ├── crud/                     # [Lớp 3] CRUD — Database access
│   │   │   ├── base.py               # CRUDBase generic class
│   │   │   ├── crud_user.py
│   │   │   ├── crud_wallet.py
│   │   │   ├── crud_category.py
│   │   │   ├── crud_transaction.py
│   │   │   ├── crud_debt.py
│   │   │   ├── crud_budget.py
│   │   │   ├── crud_investment.py
│   │   │   └── crud_subscription.py
│   │   ├── models/                   # SQLAlchemy Models (Database schema)
│   │   │   ├── enums.py
│   │   │   ├── user.py
│   │   │   ├── wallet_category.py
│   │   │   ├── transaction.py
│   │   │   └── finance_modules.py
│   │   ├── schemas/                  # Pydantic Models (Request/Response validation)
│   │   ├── db/                       # Database connections
│   │   │   ├── database.py           # PostgreSQL session factory
│   │   │   └── mongodb.py            # MongoDB connection
│   │   ├── core/
│   │   │   └── security.py           # JWT, Bcrypt
│   │   ├── api/deps.py               # FastAPI dependencies (get_current_user)
│   │   └── main.py                   # FastAPI app entry point
│   ├── tests/                        # pytest test suite
│   ├── requirements.txt
│   └── Dockerfile
│
└── frontend/                         # Source code Frontend (ReactJS)
    ├── src/
    │   ├── api/
    │   │   └── axiosClient.js        # Axios instance, interceptors, auto-refresh
    │   ├── contexts/
    │   │   ├── UserContext.jsx        # Global user state, fetchUser, preferences
    │   │   └── TutorialContext.jsx    # Joyride tour, device-responsive steps
    │   ├── pages/                    # 13 màn hình chức năng
    │   │   ├── Auth/                 # Login, Register
    │   │   ├── Dashboard/            # Tổng quan tài chính, biểu đồ
    │   │   ├── Transactions/         # Danh sách + thêm giao dịch
    │   │   ├── Wallets/              # Quản lý ví
    │   │   ├── Categories/           # Quản lý danh mục
    │   │   ├── Budgets/              # Ngân sách
    │   │   ├── Debts/                # Sổ nợ
    │   │   ├── Investments/          # Danh mục đầu tư
    │   │   ├── Subscriptions/        # Chi tiêu định kỳ
    │   │   ├── AIChat/               # Chatbot AI
    │   │   └── Profile/              # Hồ sơ người dùng
    │   ├── components/               # Reusable UI components
    │   │   ├── Sidebar.jsx           # Desktop navigation
    │   │   ├── BottomNav.jsx         # Mobile navigation
    │   │   ├── CurrencyInput.jsx     # VND formatted input
    │   │   └── ImportModal.jsx       # Bulk import dialog
    │   ├── tutorial/
    │   │   └── tutorialSteps.js      # Joyride steps (desktop + mobile)
    │   ├── utils/                    # Helper functions
    │   ├── App.jsx                   # Routing (React Router)
    │   └── main.jsx                  # Entry point
    ├── package.json
    ├── tailwind.config.js
    └── vite.config.js
```

---

## 11. SƠ ĐỒ LUỒNG DỮ LIỆU TỔNG QUAN

```
                    ┌──────────────────────┐
                    │    React Frontend      │
                    │  (Vercel CDN)          │
                    │                       │
                    │  Axios Interceptors:  │
                    │  • Auto JWT attach    │
                    │  • 401 → auto-refresh │
                    │  • Global error toast │
                    └──────────┬────────────┘
                               │ HTTPS / REST API
                               │ Bearer Token
                    ┌──────────▼────────────┐
                    │    FastAPI Backend     │
                    │    (Render.com)        │
                    │                       │
                    │  [10 Routers]         │
                    │        │              │
                    │  [Services Layer] ◄───┼── Google Gemini Flash 2.5
                    │    Business Logic  │  │   (NLP / OCR / RAG /
                    │                   │  │    Function Calling)
                    │  [CRUD Layer]     │  │
                    │    DB Queries     │  │
                    │                       │
                    │  [APScheduler]        │
                    │  00:01 daily cron     │
                    └──────────┬────────────┘
                               │
                 ┌─────────────┴─────────────┐
                 │                           │
        ┌────────▼─────────┐    ┌────────────▼──────┐
        │   PostgreSQL      │    │   MongoDB Atlas    │
        │  (Supabase/Neon)  │    │  Chat History      │
        │  10 tables, ACID  │    │  RAG Context       │
        │  Quan hệ tài chính│    │  Schema-free       │
        └──────────────────┘    └───────────────────┘
                 │
        ┌────────┴────────────────────────┐
        │     External APIs               │
        │  vnstock → Giá cổ phiếu VN      │
        │  CoinGecko → Giá tiền điện tử   │
        │  Google OAuth2 → Social login   │
        └─────────────────────────────────┘
```

---

## 12. ĐIỂM MẠNH CỦA HỆ THỐNG

### 12.1 Điểm mạnh kỹ thuật

| Điểm mạnh | Chi tiết kỹ thuật |
|-----------|------------------|
| **Kiến trúc phân tầng 3-Tier** | Router–Service–CRUD không coupling; mỗi lớp test độc lập |
| **AI tích hợp đa chiều** | Gemini Flash với Function Calling — AI không chỉ trả lời mà tự thực thi hành động |
| **Dual Database design** | PostgreSQL (ACID transactions) + MongoDB (RAG context) — đúng công cụ đúng bài toán |
| **Background Worker** | APScheduler embedded trong FastAPI — tự động hóa không cần Celery/Redis |
| **Auto Token Refresh** | Axios interceptor xử lý 401 trong suốt, không gián đoạn trải nghiệm user |
| **Generic CRUD base** | CRUDBase tái sử dụng 5 phương thức cơ bản cho 9 entity — giảm boilerplate 80% |
| **Rate Limiting** | slowapi bảo vệ AI endpoints khỏi lạm dụng và cost inflation |
| **Lazy-loaded Tutorial** | react-joyride chỉ load khi user lần đầu đăng nhập — không ảnh hưởng bundle size |

### 12.2 Điểm mạnh nghiệp vụ

| Điểm mạnh | Giá trị mang lại |
|-----------|-----------------|
| **Smart Bulk Import** | Import hàng trăm giao dịch lịch sử trong 1 thao tác; tự tạo entity thiếu |
| **Auto Debt Tracking** | Nhận diện "Vay anh Sơn" → tự lập hợp đồng → tự gạch nợ khi trả |
| **Đa loại tài sản** | Chứng khoán VN, crypto, vàng, BĐS — danh mục đầu tư đầy đủ |
| **RAG Chatbot cá nhân hóa** | AI hiểu ngữ cảnh tài chính *riêng* của người dùng, không phải AI chung chung |
| **Cascade Delete** | Xóa tài khoản → dọn sạch toàn bộ dữ liệu — GDPR-friendly |
| **Ngân sách rollover** | Ngân sách chưa dùng hết tháng trước được cộng sang tháng sau tự động |

### 12.3 Điểm mạnh vận hành

| Điểm mạnh | Chi tiết |
|-----------|---------|
| **Docker hóa hoàn toàn** | `docker-compose up -d --build` → toàn hệ thống chạy trong 1 lệnh |
| **Alembic Migration** | Schema changes có lịch sử, an toàn, rollback được |
| **CI/CD tự động** | Push to main → Vercel/Render tự deploy — zero downtime deployment |
| **OpenAPI / Swagger UI** | FastAPI tự sinh docs tại `/docs` — test API ngay trên browser |
| **Seed Data** | `python seed.py` → data mẫu đầy đủ cho demo/presentation |

---

*Tài liệu được tạo ngày 14/04/2026 — IFinance v1.0.0*
