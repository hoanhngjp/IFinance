# DATABASE DESIGN DOCUMENT (DDD)
## Hệ thống Quản lý Tài chính Cá nhân IFinance

| Thông tin | Chi tiết |
|-----------|---------|
| **Phiên bản tài liệu** | v1.0 |
| **Ngày lập** | 14/04/2026 |
| **Hệ thống** | IFinance — Personal Finance Management System |
| **DBMS chính** | PostgreSQL (Supabase/Neon) |
| **DBMS phụ** | MongoDB Atlas |
| **ORM** | SQLAlchemy + Alembic (PostgreSQL) / PyMongo (MongoDB) |
| **Mục đích** | Chương "Thiết kế Cơ sở Dữ liệu" trong báo cáo đồ án chuyên ngành |

---

## MỤC LỤC

1. [Tổng quan hệ thống dữ liệu](#1-tổng-quan-hệ-thống-dữ-liệu)
2. [Thiết kế cơ sở dữ liệu quan hệ (PostgreSQL)](#2-thiết-kế-cơ-sở-dữ-liệu-quan-hệ-postgresql)
   - 2.1 Danh sách các bảng
   - 2.2 Định nghĩa kiểu ENUM
   - 2.3 Mô tả chi tiết từng bảng
3. [Sơ đồ quan hệ thực thể (ERD)](#3-sơ-đồ-quan-hệ-thực-thể-erd)
   - 3.1 Quan hệ toàn hệ thống
   - 3.2 Phân tích từng quan hệ
4. [Thiết kế cơ sở dữ liệu phi quan hệ (MongoDB)](#4-thiết-kế-cơ-sở-dữ-liệu-phi-quan-hệ-mongodb)
5. [Lịch sử tiến hóa Schema (Alembic Migrations)](#5-lịch-sử-tiến-hóa-schema-alembic-migrations)
6. [Chiến lược Hybrid Database (PostgreSQL + MongoDB)](#6-chiến-lược-hybrid-database-postgresql--mongodb)
7. [Ưu điểm thiết kế cơ sở dữ liệu](#7-ưu-điểm-thiết-kế-cơ-sở-dữ-liệu)

---

## 1. TỔNG QUAN HỆ THỐNG DỮ LIỆU

### 1.1 Kiến trúc dữ liệu tổng quát

IFinance áp dụng kiến trúc **Hybrid Database** — sử dụng đồng thời hai hệ quản trị cơ sở dữ liệu với mục đích khác nhau:

```
┌─────────────────────────────────────────────────────────────────┐
│                   DATA ARCHITECTURE OVERVIEW                     │
│                                                                  │
│  ┌──────────────────────────────────┐  ┌─────────────────────┐  │
│  │       PostgreSQL (Chính)          │  │   MongoDB (Phụ)     │  │
│  │       Supabase / Neon             │  │   MongoDB Atlas     │  │
│  │                                   │  │                     │  │
│  │  • Dữ liệu tài chính cốt lõi     │  │  • Lịch sử chat AI │  │
│  │  • 10 bảng quan hệ               │  │  • 1 collection     │  │
│  │  • ACID transactions              │  │  • Schema-free      │  │
│  │  • Foreign Key constraints        │  │  • Document-based   │  │
│  │  • SQLAlchemy ORM                 │  │  • PyMongo driver   │  │
│  │  • Alembic migrations             │  │                     │  │
│  └──────────────────────────────────┘  └─────────────────────┘  │
│                      ▲                          ▲                │
│                      │ SQLAlchemy               │ PyMongo        │
│                      └──────────────┬───────────┘                │
│                                     │                            │
│                              FastAPI Backend                      │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Thống kê cơ sở dữ liệu

| Thống kê | PostgreSQL | MongoDB |
|---------|-----------|---------|
| Số bảng / Collection | 10 bảng | 1 collection |
| Số kiểu ENUM | 7 enum types | — |
| Số quan hệ FK | 16 foreign keys | — |
| Cascade Delete | Có (user → tất cả) | — |
| Indexing | username, email, token | session_id, user_id |
| Schema enforcement | Strict (Pydantic + SQLAlchemy) | Flexible (schema-free) |
| Transaction support | ACID | Eventual consistency |

### 1.3 Nguyên tắc thiết kế

Thiết kế cơ sở dữ liệu IFinance tuân thủ các nguyên tắc:

1. **User Isolation (Cô lập dữ liệu người dùng)**: Mọi bảng dữ liệu đều có cột `user_id` làm khóa ngoại, đảm bảo người dùng chỉ truy cập được dữ liệu của chính họ.

2. **Cascading Referential Integrity (Tính toàn vẹn tham chiếu dây chuyền)**: Khi xóa một `User`, toàn bộ dữ liệu liên quan (ví, danh mục, giao dịch, nợ...) được tự động xóa theo cơ chế `CASCADE`.

3. **Normalized Schema (Schema chuẩn hóa)**: Dữ liệu được phân chia vào các bảng chuyên biệt, tránh lặp lại dữ liệu, đảm bảo ở dạng chuẩn 3NF (Third Normal Form).

4. **ENUM cho domain values (Kiểu liệt kê cho miền giá trị)**: Các trường có tập giá trị xác định (loại ví, loại giao dịch...) sử dụng kiểu PostgreSQL ENUM để đảm bảo tính toàn vẹn tại tầng database.

5. **Precision Financial Data (Độ chính xác dữ liệu tài chính)**: Mọi cột tiền tệ sử dụng kiểu `NUMERIC(15, 2)` thay vì `FLOAT` để tránh sai số dấu phẩy động trong tính toán tài chính.

---

## 2. THIẾT KẾ CƠ SỞ DỮ LIỆU QUAN HỆ (PostgreSQL)

### 2.1 Danh sách các bảng

| STT | Tên bảng | Số cột | Số FK | Mô tả chức năng |
|-----|----------|--------|-------|----------------|
| 1 | `users` | 8 | 0 | Thông tin tài khoản người dùng, root entity |
| 2 | `token_blacklist` | 3 | 0 | Danh sách JWT token đã bị thu hồi (logout) |
| 3 | `wallets` | 8 | 1 | Ví tiền của người dùng (tiền mặt, ngân hàng, v.v.) |
| 4 | `categories` | 6 | 2 | Danh mục thu/chi phân cấp cha–con |
| 5 | `transactions` | 10 | 3 | Giao dịch tài chính (thu, chi, chuyển khoản...) |
| 6 | `debts` | 9 | 1 | Hợp đồng vay nợ / cho vay |
| 7 | `debt_repayments` | 5 | 2 | Lịch sử thanh toán từng phần của khoản nợ |
| 8 | `investments` | 10 | 2 | Danh mục đầu tư (cổ phiếu, crypto, vàng...) |
| 9 | `subscriptions` | 9 | 3 | Gói chi tiêu định kỳ tự động |
| 10 | `budgets` | 8 | 2 | Ngân sách theo danh mục và kỳ hạn |

### 2.2 Định nghĩa kiểu ENUM

Hệ thống định nghĩa 7 kiểu ENUM trong module `app/models/enums.py`, tất cả kế thừa từ `str, enum.Enum` để hỗ trợ serialization JSON và validation Pydantic tự động:

#### WalletType — Loại ví tiền

| Giá trị | Ý nghĩa |
|---------|---------|
| `cash` | Tiền mặt |
| `bank` | Tài khoản ngân hàng |
| `credit` | Thẻ tín dụng (cho phép số dư âm trong hạn mức) |
| `e_wallet` | Ví điện tử (MoMo, ZaloPay, VNPay...) |
| `asset` | Tài sản (dùng để tracking giá trị tài sản vật chất) |

#### CategoryType — Loại danh mục

| Giá trị | Ý nghĩa |
|---------|---------|
| `income` | Danh mục thu nhập |
| `expense` | Danh mục chi tiêu |

#### TransactionType — Loại giao dịch

| Giá trị | Ý nghĩa | Tác động số dư ví |
|---------|---------|-----------------|
| `income` | Thu nhập | Ví tăng |
| `expense` | Chi tiêu | Ví giảm |
| `transfer` | Chuyển khoản nội bộ | Ví nguồn giảm, ví đích tăng |
| `debt_loan` | Ghi nhận vay/cho vay | Ví tăng (nhận tiền) hoặc giảm (cho vay) |
| `debt_repayment` | Thanh toán khoản nợ | Ví giảm + cập nhật `remaining_amount` của Debt |
| `investment_in` | Bỏ vốn đầu tư | Ví giảm |
| `investment_return` | Thu lợi nhuận đầu tư | Ví tăng |

#### DebtType — Loại nợ

| Giá trị | Ý nghĩa |
|---------|---------|
| `receivable` | Phải thu — tiền đã cho người khác vay |
| `payable` | Phải trả — tiền đang vay của người khác |

#### InvestmentType — Loại đầu tư

| Giá trị | Ý nghĩa | Nguồn giá thực tế |
|---------|---------|-----------------|
| `stock` | Cổ phiếu / chứng khoán | vnstock API (cổ phiếu VN) |
| `gold` | Vàng | Nhập tay hoặc API giá vàng |
| `crypto` | Tiền điện tử | CoinGecko API |
| `savings_deposit` | Gửi tiết kiệm / tiền gửi | Tính theo lãi suất |
| `real_estate` | Bất động sản | Nhập tay (định giá thủ công) |

#### FrequencyType — Tần suất định kỳ (Subscriptions)

| Giá trị | Ý nghĩa |
|---------|---------|
| `daily` | Hàng ngày |
| `weekly` | Hàng tuần |
| `monthly` | Hàng tháng |
| `yearly` | Hàng năm |

#### BudgetPeriod — Kỳ ngân sách

| Giá trị | Ý nghĩa |
|---------|---------|
| `weekly` | Ngân sách theo tuần |
| `monthly` | Ngân sách theo tháng |

---

### 2.3 Mô tả chi tiết từng bảng

---

#### Bảng 1: `users` — Người dùng

**Mục đích:** Lưu trữ thông tin tài khoản người dùng. Đây là **root entity** của toàn hệ thống — mọi bảng khác đều có quan hệ trực tiếp hoặc gián tiếp với `users`.

| Cột | Kiểu dữ liệu SQLAlchemy | Kiểu PostgreSQL | Ràng buộc | Ý nghĩa |
|-----|------------------------|----------------|----------|---------|
| `user_id` | `Integer` | `SERIAL` | PK, AUTO INCREMENT | Khóa chính định danh người dùng |
| `username` | `String(50)` | `VARCHAR(50)` | UNIQUE, NOT NULL, INDEX | Tên đăng nhập, duy nhất toàn hệ thống |
| `email` | `String(100)` | `VARCHAR(100)` | UNIQUE, NOT NULL, INDEX | Địa chỉ email, dùng để đăng nhập |
| `password_hash` | `String(255)` | `VARCHAR(255)` | NOT NULL | Mật khẩu đã mã hóa Bcrypt (không lưu plaintext) |
| `full_name` | `String(100)` | `VARCHAR(100)` | nullable | Họ và tên hiển thị |
| `is_active` | `Boolean` | `BOOLEAN` | DEFAULT true | Trạng thái tài khoản (false = bị khóa) |
| `has_seen_tutorial` | `Boolean` | `BOOLEAN` | NOT NULL, DEFAULT false | Đã xem tutorial lần đầu chưa (dùng cho onboarding) |
| `created_at` | `DateTime(timezone=True)` | `TIMESTAMPTZ` | DEFAULT NOW() | Thời điểm tạo tài khoản |

**Index:** `username` (B-tree), `email` (B-tree) — tối ưu truy vấn đăng nhập.

**Lưu ý thiết kế:** `password_hash` sử dụng Bcrypt với salt tự động — không bao giờ lưu mật khẩu gốc. `has_seen_tutorial` được thêm vào phiên bản sau (migration `c9d1e2f3a4b5`) để tránh reset tutorial sau các lần cập nhật hệ thống.

---

#### Bảng 2: `token_blacklist` — Danh sách token bị thu hồi

**Mục đích:** Lưu trữ các JWT token đã bị vô hiệu hóa sau khi đăng xuất, thực hiện cơ chế **Zero-Trust Logout** — đảm bảo token không thể tái sử dụng dù chưa hết thời gian hiệu lực.

| Cột | Kiểu dữ liệu SQLAlchemy | Kiểu PostgreSQL | Ràng buộc | Ý nghĩa |
|-----|------------------------|----------------|----------|---------|
| `id` | `Integer` | `SERIAL` | PK, AUTO INCREMENT | Khóa chính |
| `token` | `String(500)` | `VARCHAR(500)` | UNIQUE, NOT NULL, INDEX | Chuỗi JWT token bị blacklist |
| `blacklisted_on` | `DateTime(timezone=True)` | `TIMESTAMPTZ` | DEFAULT NOW() | Thời điểm thu hồi token |

**Index:** `token` (B-tree, UNIQUE) — đảm bảo kiểm tra blacklist nhanh O(log n).

**Lưu ý thiết kế:** Không có FK về bảng `users` vì khi user bị xóa, token cũng nên được giữ lại trong blacklist để ngăn replay attack. Cần cron job định kỳ dọn dẹp các token đã hết hạn để kiểm soát kích thước bảng.

---

#### Bảng 3: `wallets` — Ví tiền

**Mục đích:** Quản lý các tài khoản tiền (ví tiền mặt, tài khoản ngân hàng, thẻ tín dụng, ví điện tử, tài sản) của người dùng. Số dư `balance` được cập nhật tự động sau mỗi giao dịch.

| Cột | Kiểu dữ liệu SQLAlchemy | Kiểu PostgreSQL | Ràng buộc | Ý nghĩa |
|-----|------------------------|----------------|----------|---------|
| `wallet_id` | `Integer` | `SERIAL` | PK, AUTO INCREMENT | Khóa chính |
| `user_id` | `Integer` | `INTEGER` | FK → users.user_id (CASCADE), NOT NULL | Chủ sở hữu ví |
| `name` | `String(100)` | `VARCHAR(100)` | NOT NULL | Tên ví (VD: "Ví tiền mặt", "BIDV", "MoMo") |
| `type` | `SQLEnum(WalletType)` | `wallettype` | NOT NULL | Loại ví (xem enum WalletType) |
| `balance` | `Numeric(15, 2)` | `NUMERIC(15,2)` | DEFAULT 0 | Số dư hiện tại (tính bằng VND) |
| `currency` | `String(10)` | `VARCHAR(10)` | DEFAULT 'VND' | Đơn vị tiền tệ |
| `is_active` | `Boolean` | `BOOLEAN` | DEFAULT true | Ví đang hoạt động hay đã đóng |
| `credit_limit` | `Numeric(15, 2)` | `NUMERIC(15,2)` | DEFAULT 0 | Hạn mức tín dụng (chỉ áp dụng với loại `credit`) |

**Lưu ý thiết kế:**
- `NUMERIC(15, 2)` cho `balance`: Hỗ trợ số tiền tối đa 999,999,999,999,999.99 — đủ lớn cho mọi nhu cầu cá nhân, tránh sai số dấu phẩy động của `FLOAT`.
- Thẻ tín dụng (`type = credit`): Không kiểm tra `balance >= amount` khi chi tiêu — thay vào đó kiểm tra `balance + credit_limit >= amount`. Logic này nằm trong Service layer.
- `is_active` cho phép "đóng ví" mà không mất lịch sử giao dịch.

**Business Rules (Validation tại API layer — `WalletCreate` schema):**
- `name` không được là chuỗi rỗng (`min_length=1`). Trả về HTTP 422 nếu vi phạm.
- Khi `type = credit`, bắt buộc phải truyền `credit_limit > 0`. Trả về HTTP 422 với thông báo: *"Ví tín dụng (credit) bắt buộc phải có hạn mức tín dụng (credit_limit > 0)"*. *(Cập nhật 2026-04-30)*

---

#### Bảng 4: `categories` — Danh mục thu/chi

**Mục đích:** Phân loại giao dịch theo danh mục. Hỗ trợ cấu trúc phân cấp **cha–con (self-referential)** tùy sâu. Danh mục hệ thống (`user_id = NULL`) được chia sẻ cho tất cả người dùng; danh mục tùy chỉnh (`user_id != NULL`) chỉ hiển thị cho user đó.

| Cột | Kiểu dữ liệu SQLAlchemy | Kiểu PostgreSQL | Ràng buộc | Ý nghĩa |
|-----|------------------------|----------------|----------|---------|
| `category_id` | `Integer` | `SERIAL` | PK, AUTO INCREMENT | Khóa chính |
| `user_id` | `Integer` | `INTEGER` | FK → users.user_id (CASCADE), **nullable** | NULL = danh mục hệ thống; có giá trị = danh mục cá nhân |
| `parent_id` | `Integer` | `INTEGER` | FK → categories.category_id (CASCADE), nullable | Tham chiếu tự thân — ID danh mục cha; NULL = danh mục gốc |
| `name` | `String(100)` | `VARCHAR(100)` | NOT NULL | Tên danh mục (VD: "Ăn uống", "Lương") |
| `type` | `SQLEnum(CategoryType)` | `categorytype` | NOT NULL | Loại: income (thu) hoặc expense (chi) |
| `icon` | `String(255)` | `VARCHAR(255)` | nullable | Mã icon hoặc emoji đại diện |

**Cấu trúc phân cấp Self-Referential:**
```
Ăn uống (parent_id = NULL)         ← Danh mục gốc
  ├── Ăn sáng (parent_id = Ăn uống.id)
  ├── Ăn trưa (parent_id = Ăn uống.id)
  └── Ăn tối  (parent_id = Ăn uống.id)

Thu nhập (parent_id = NULL)
  ├── Lương  (parent_id = Thu nhập.id)
  └── Thưởng (parent_id = Thu nhập.id)
```

**SQLAlchemy Self-Referential Relationship:**
```python
parent = relationship("Category", remote_side=[category_id],
                      back_populates="subcategories")
subcategories = relationship("Category", back_populates="parent")
```

**Lưu ý thiết kế:** `user_id nullable` là một thiết kế đặc biệt — cho phép "danh mục hệ thống" được chia sẻ mà không cần nhân bản vào từng user. Query lấy danh mục của user luôn là: `WHERE user_id = ? OR user_id IS NULL`.

---

#### Bảng 5: `transactions` — Giao dịch tài chính

**Mục đích:** Lưu trữ toàn bộ giao dịch tài chính của người dùng. Đây là bảng trung tâm nhất của hệ thống — kết nối với `wallets`, `categories`, và có quan hệ đặc biệt 1-1 với `debt_repayments`.

| Cột | Kiểu dữ liệu SQLAlchemy | Kiểu PostgreSQL | Ràng buộc | Ý nghĩa |
|-----|------------------------|----------------|----------|---------|
| `transaction_id` | `Integer` | `SERIAL` | PK, AUTO INCREMENT | Khóa chính |
| `user_id` | `Integer` | `INTEGER` | FK → users.user_id (CASCADE), NOT NULL | Người dùng sở hữu giao dịch |
| `wallet_id` | `Integer` | `INTEGER` | FK → wallets.wallet_id, NOT NULL | Ví thực hiện giao dịch |
| `category_id` | `Integer` | `INTEGER` | FK → categories.category_id, NOT NULL | Danh mục phân loại giao dịch |
| `transaction_type` | `SQLEnum(TransactionType)` | `transactiontype` | NOT NULL | Loại giao dịch (xem enum TransactionType) |
| `amount` | `Numeric(15, 2)` | `NUMERIC(15,2)` | NOT NULL | Số tiền — **luôn là giá trị dương** |
| `date` | `DateTime(timezone=True)` | `TIMESTAMPTZ` | NOT NULL, DEFAULT NOW() | Ngày giờ phát sinh giao dịch |
| `note` | `Text` | `TEXT` | nullable | Ghi chú mô tả giao dịch |
| `images` | `JSON` | `JSON` | nullable | Danh sách URL ảnh hóa đơn đính kèm |
| `ocr_data` | `JSON` | `JSON` | nullable | Dữ liệu trích xuất từ OCR (merchant, items, total...) |

**Lưu ý thiết kế:**
- **`amount` luôn dương**: Chiều tăng/giảm của số dư ví được xác định bởi `transaction_type` trong Service layer, không phải dấu của `amount`. Thiết kế này đơn giản hóa query thống kê (SUM, GROUP BY).
- **`images` JSON**: Lưu array URL dạng `["https://...img1.jpg", "https://...img2.jpg"]`. Không tạo bảng riêng `transaction_images` vì thường mỗi giao dịch có 0–3 ảnh, không cần bảng phụ.
- **`ocr_data` JSON**: Lưu structured data từ Gemini OCR dạng `{"merchant": "Highlands", "total": 59000, "items": [...]}`.
- **Timezone-aware timestamps**: `DateTime(timezone=True)` đảm bảo lưu UTC, hiển thị đúng múi giờ khi render frontend.

---

#### Bảng 6: `debts` — Hợp đồng vay nợ

**Mục đích:** Quản lý các khoản vay hoặc cho vay. Mỗi bản ghi đại diện cho một "hợp đồng nợ" với tổng giá trị ban đầu, số tiền còn lại, và các điều kiện trả nợ.

| Cột | Kiểu dữ liệu SQLAlchemy | Kiểu PostgreSQL | Ràng buộc | Ý nghĩa |
|-----|------------------------|----------------|----------|---------|
| `debt_id` | `Integer` | `SERIAL` | PK, AUTO INCREMENT | Khóa chính |
| `user_id` | `Integer` | `INTEGER` | FK → users.user_id (CASCADE), NOT NULL | Người dùng sở hữu khoản nợ |
| `creditor_name` | `String(150)` | `VARCHAR(150)` | NOT NULL | Tên chủ nợ / con nợ (VD: "Anh Sơn", "Ngân hàng VCB") |
| `total_amount` | `Numeric(15, 2)` | `NUMERIC(15,2)` | NOT NULL | Tổng giá trị ban đầu của khoản nợ |
| `remaining_amount` | `Numeric(15, 2)` | `NUMERIC(15,2)` | DEFAULT 0 | Số tiền còn phải trả / còn phải thu |
| `type` | `SQLEnum(DebtType)` | `debttype` | NOT NULL | Loại nợ: receivable (cho vay) / payable (đi vay) |
| `interest_rate` | `Float` | `FLOAT8` | nullable | Lãi suất (%/năm) nếu có |
| `due_date` | `Date` | `DATE` | nullable | Hạn trả nợ |
| `is_installment` | `Boolean` | `BOOLEAN` | DEFAULT false | Hình thức trả góp nhiều lần hay trả một lần |

**Lưu ý thiết kế:**
- `remaining_amount` là **derived field** — được tính và cập nhật bởi Service layer mỗi khi có `DebtRepayment` mới: `remaining_amount -= repayment.amount`. Không tính bằng JOIN để tránh query nặng mỗi lần load.
- `interest_rate` dùng `Float` thay vì `Numeric` vì đây là tỷ lệ phần trăm (không cần độ chính xác tài chính cao như tiền tệ).

---

#### Bảng 7: `debt_repayments` — Lịch sử trả nợ

**Mục đích:** Ghi lại từng lần thanh toán nợ, liên kết 1-1 với một giao dịch (`transaction_id UNIQUE`). Cho phép theo dõi tiến trình trả nợ theo từng kỳ.

| Cột | Kiểu dữ liệu SQLAlchemy | Kiểu PostgreSQL | Ràng buộc | Ý nghĩa |
|-----|------------------------|----------------|----------|---------|
| `repayment_id` | `Integer` | `SERIAL` | PK, AUTO INCREMENT | Khóa chính |
| `debt_id` | `Integer` | `INTEGER` | FK → debts.debt_id (CASCADE), NOT NULL | Khoản nợ được thanh toán |
| `transaction_id` | `Integer` | `INTEGER` | FK → transactions.transaction_id, **UNIQUE**, NOT NULL | Giao dịch tương ứng — **ràng buộc 1-to-1** |
| `amount` | `Numeric(15, 2)` | `NUMERIC(15,2)` | NOT NULL | Số tiền thanh toán lần này |
| `date` | `DateTime(timezone=True)` | `TIMESTAMPTZ` | NOT NULL, DEFAULT NOW() | Ngày thanh toán |

**Quan hệ 1-1 đặc biệt:**

`transaction_id UNIQUE` là kỹ thuật triển khai quan hệ **One-to-One** trong RDBMS — mỗi giao dịch tài chính chỉ có thể là bằng chứng của đúng một lần trả nợ, và mỗi lần trả nợ chỉ được gắn với đúng một giao dịch.

```
transactions (1) ──── (1) debt_repayments
  transaction_id (PK) ←── transaction_id (FK, UNIQUE)
```

**Cascade:** `debt_id → debt_id (CASCADE)`: Xóa hợp đồng nợ sẽ xóa toàn bộ lịch sử trả nợ.

---

#### Bảng 8: `investments` — Danh mục đầu tư

**Mục đích:** Theo dõi danh mục đầu tư cá nhân. Hỗ trợ 5 loại tài sản: cổ phiếu, vàng, tiền điện tử, tiết kiệm, bất động sản.

| Cột | Kiểu dữ liệu SQLAlchemy | Kiểu PostgreSQL | Ràng buộc | Ý nghĩa |
|-----|------------------------|----------------|----------|---------|
| `investment_id` | `Integer` | `SERIAL` | PK, AUTO INCREMENT | Khóa chính |
| `user_id` | `Integer` | `INTEGER` | FK → users.user_id (CASCADE), NOT NULL | Người dùng sở hữu khoản đầu tư |
| `wallet_id` | `Integer` | `INTEGER` | FK → wallets.wallet_id, NOT NULL | Ví nguồn vốn đầu tư |
| `name` | `String(150)` | `VARCHAR(150)` | NOT NULL | Tên khoản đầu tư (VD: "VNM", "Bitcoin", "Vàng SJC") |
| `type` | `SQLEnum(InvestmentType)` | `investmenttype` | NOT NULL | Loại tài sản đầu tư |
| `quantity` | `Numeric(20, 8)` | `NUMERIC(20,8)` | NOT NULL, DEFAULT 1 | Số lượng đơn vị sở hữu |
| `principal_amount` | `Numeric(15, 2)` | `NUMERIC(15,2)` | NOT NULL | Tổng vốn đầu tư ban đầu (cost basis) |
| `current_value` | `Numeric(15, 2)` | `NUMERIC(15,2)` | nullable | Giá trị thị trường hiện tại (cập nhật thủ công hoặc qua API) |
| `total_passive_income` | `Numeric(15, 2)` | `NUMERIC(15,2)` | DEFAULT 0 | Tổng thu nhập thụ động tích lũy (cổ tức, lãi tiết kiệm...) |
| `start_date` | `Date` | `DATE` | nullable | Ngày bắt đầu khoản đầu tư |

**Lưu ý thiết kế:**
- `quantity NUMERIC(20, 8)`: Độ chính xác 8 chữ số thập phân cho tiền điện tử (VD: `0.00001234 BTC`). `FLOAT` không đủ chính xác cho crypto.
- `current_value nullable`: Không bắt buộc — chỉ được ghi khi người dùng cập nhật thủ công hoặc khi API bên ngoài trả về giá. `NULL` có nghĩa là "chưa có giá thị trường".
- **ROI = (current_value - principal_amount) / principal_amount × 100%** — tính trong Service layer, không lưu vào DB (derived metric).

---

#### Bảng 9: `subscriptions` — Chi tiêu định kỳ

**Mục đích:** Quản lý các khoản chi tiêu định kỳ (Netflix, điện thoại, gym...). APScheduler Worker đọc bảng này mỗi ngày 00:01 để tự động tạo giao dịch chi tiêu.

| Cột | Kiểu dữ liệu SQLAlchemy | Kiểu PostgreSQL | Ràng buộc | Ý nghĩa |
|-----|------------------------|----------------|----------|---------|
| `subscription_id` | `Integer` | `SERIAL` | PK, AUTO INCREMENT | Khóa chính |
| `user_id` | `Integer` | `INTEGER` | FK → users.user_id (CASCADE), NOT NULL | Người dùng sở hữu gói |
| `default_wallet_id` | `Integer` | `INTEGER` | FK → wallets.wallet_id, NOT NULL | Ví tự động trừ tiền |
| `category_id` | `Integer` | `INTEGER` | FK → categories.category_id, NOT NULL | Danh mục phân loại chi tiêu định kỳ |
| `name` | `String(150)` | `VARCHAR(150)` | NOT NULL | Tên gói (VD: "Netflix", "Spotify", "Điện thoại") |
| `amount` | `Numeric(15, 2)` | `NUMERIC(15,2)` | NOT NULL | Số tiền mỗi kỳ thanh toán |
| `frequency` | `SQLEnum(FrequencyType)` | `frequencytype` | NOT NULL | Tần suất định kỳ (daily/weekly/monthly/yearly) |
| `next_due_date` | `Date` | `DATE` | nullable | Ngày đến hạn thanh toán tiếp theo |
| `is_active` | `Boolean` | `BOOLEAN` | DEFAULT true | Gói đang hoạt động hay tạm dừng |

**Lưu ý thiết kế:**
- `next_due_date` là "trạng thái động" — APScheduler Worker cập nhật sau mỗi lần xử lý: `next_due_date += timedelta(days=frequency)`.
- **Catch-up mechanism**: Nếu server downtime nhiều ngày, Worker chạy vòng lặp xử lý tất cả các kỳ chưa được tính đến hiện tại (không chỉ 1 kỳ gần nhất).
- `is_active` cho phép tạm dừng gói mà không mất cấu hình.

---

#### Bảng 10: `budgets` — Ngân sách

**Mục đích:** Đặt hạn mức chi tiêu theo danh mục trong một kỳ (tuần/tháng). Hỗ trợ tính năng **rollover** — ngân sách còn dư từ kỳ trước được cộng sang kỳ sau.

| Cột | Kiểu dữ liệu SQLAlchemy | Kiểu PostgreSQL | Ràng buộc | Ý nghĩa |
|-----|------------------------|----------------|----------|---------|
| `budget_id` | `Integer` | `SERIAL` | PK, AUTO INCREMENT | Khóa chính |
| `user_id` | `Integer` | `INTEGER` | FK → users.user_id (CASCADE), NOT NULL | Người dùng thiết lập ngân sách |
| `category_id` | `Integer` | `INTEGER` | FK → categories.category_id, NOT NULL | Danh mục áp dụng ngân sách |
| `amount_limit` | `Numeric(15, 2)` | `NUMERIC(15,2)` | NOT NULL | Hạn mức chi tiêu tối đa cho kỳ này |
| `period` | `SQLEnum(BudgetPeriod)` | `budgetperiod` | NOT NULL | Kỳ ngân sách: weekly hoặc monthly |
| `is_rollover` | `Boolean` | `BOOLEAN` | DEFAULT false | Có cộng dồn ngân sách dư sang kỳ sau không |
| `start_date` | `Date` | `DATE` | nullable | Ngày bắt đầu áp dụng ngân sách |
| `end_date` | `Date` | `DATE` | nullable | Ngày kết thúc kỳ ngân sách |

**Lưu ý thiết kế:**
- **Tiến độ ngân sách** = `SUM(transactions.amount WHERE category_id = budget.category_id AND date IN period)` — được tính **động** trong Service layer mỗi lần query, không lưu vào DB để luôn phản ánh chính xác.
- `is_rollover`: Nếu `true`, khi tạo kỳ ngân sách mới, `amount_limit` mới = `amount_limit cũ` + phần dư chưa dùng.

---

## 3. SƠ ĐỒ QUAN HỆ THỰC THỂ (ERD)

### 3.1 ERD Tổng quan

```
╔════════════════════════════════════════════════════════════════════════════╗
║                    ENTITY RELATIONSHIP DIAGRAM — IFinance                  ║
╠════════════════════════════════════════════════════════════════════════════╣
║                                                                            ║
║                           ┌─────────────────┐                             ║
║                           │     USERS        │                             ║
║                           │─────────────────│                             ║
║                           │ PK user_id       │                             ║
║                           │    username      │                             ║
║                           │    email         │                             ║
║                           │    password_hash │                             ║
║                           │    full_name     │                             ║
║                           │    is_active     │                             ║
║                           │    has_seen_tut. │                             ║
║                           │    created_at    │                             ║
║                           └────────┬────────┘                             ║
║                    ┌───────────────┼──────────────────────┐               ║
║              (1:N) │         (1:N) │              (1:N)   │ (1:N)          ║
║                    ▼               ▼                      ▼               ║
║           ┌──────────────┐  ┌──────────────┐   ┌──────────────────┐      ║
║           │   WALLETS     │  │  CATEGORIES  │   │  TRANSACTIONS    │      ║
║           │──────────────│  │──────────────│   │──────────────────│      ║
║           │ PK wallet_id  │  │ PK cat_id    │   │ PK transaction_id│      ║
║           │ FK user_id    │  │ FK user_id   │   │ FK user_id       │      ║
║           │    name       │  │ FK parent_id◄┼─┐ │ FK wallet_id     │      ║
║           │    type(ENUM) │  │    name      │ │ │ FK category_id   │      ║
║           │    balance    │  │    type(ENUM)│ └─┤    type(ENUM)    │      ║
║           │    currency   │  │    icon      │   │    amount        │      ║
║           │    is_active  │  └──────┬───────┘   │    date          │      ║
║           │    credit_lim.│         │(1:N)       │    note          │      ║
║           └──────┬────────┘         ▼            │    images(JSON)  │      ║
║                  │ (1:N)   ┌──────────────┐      │    ocr_data(JSON)│      ║
║                  │         │   BUDGETS    │      └────────┬─────────┘      ║
║                  │         │──────────────│               │ (1:1)          ║
║                  │         │ PK budget_id │               ▼                ║
║                  │         │ FK user_id   │      ┌──────────────────┐      ║
║                  │         │ FK cat_id    │      │ DEBT_REPAYMENTS  │      ║
║                  │         │ amount_limit │      │──────────────────│      ║
║                  │         │ period(ENUM) │      │ PK repayment_id  │      ║
║                  │         │ is_rollover  │      │ FK debt_id       │      ║
║                  │         └──────────────┘      │ FK trans_id(UNIQ)│      ║
║                  │(1:N)                          │    amount        │      ║
║                  ▼                               │    date          │      ║
║          ┌──────────────┐                        └────────┬─────────┘      ║
║          │ SUBSCRIPTIONS│                                 │ (N:1)          ║
║          │──────────────│                                 ▼                ║
║          │ PK sub_id    │                        ┌──────────────────┐      ║
║          │ FK user_id   │                        │     DEBTS        │      ║
║          │ FK wallet_id │                        │──────────────────│      ║
║          │ FK cat_id    │                        │ PK debt_id       │      ║
║          │    name      │                        │ FK user_id       │      ║
║          │    amount    │                        │    creditor_name │      ║
║          │ frequency    │                        │    total_amount  │      ║
║          │ next_due_date│                        │    remaining_amt │      ║
║          │    is_active │                        │    type(ENUM)    │      ║
║          └──────────────┘                        │    interest_rate │      ║
║                                                  │    due_date      │      ║
║          ┌──────────────┐                        │    is_installment│      ║
║          │ INVESTMENTS  │                        └──────────────────┘      ║
║          │──────────────│                                                  ║
║          │ PK invest_id │      ┌──────────────────┐                        ║
║          │ FK user_id   │      │  TOKEN_BLACKLIST  │                        ║
║          │ FK wallet_id │      │──────────────────│                        ║
║          │    name      │      │ PK id            │                        ║
║          │    type(ENUM)│      │    token         │  (standalone table,    ║
║          │    quantity  │      │    blacklisted_on│   no FK to users)      ║
║          │ principal_amt│      └──────────────────┘                        ║
║          │ current_value│                                                  ║
║          │ passive_inc. │                                                  ║
║          │    start_date│                                                  ║
║          └──────────────┘                                                  ║
╚════════════════════════════════════════════════════════════════════════════╝
```

### 3.2 Phân tích từng quan hệ

#### Quan hệ 1: users → wallets (1:N)

```
users.user_id (PK)  ──────────────── (1)
                                       │
wallets.user_id (FK, CASCADE)  ─────── (N)
```

- **Cardinality**: Một người dùng có nhiều ví; một ví thuộc về đúng một người dùng.
- **ON DELETE CASCADE**: Xóa user → xóa toàn bộ ví tiền.
- **Ý nghĩa nghiệp vụ**: Người dùng có thể quản lý đa ví (tiền mặt + ngân hàng + ví điện tử đồng thời).

#### Quan hệ 2: users → categories (1:N, nullable FK)

```
users.user_id (PK)  ──────────────── (1)
                                       │
categories.user_id (FK, nullable, CASCADE)  ─── (N)
```

- **Đặc biệt**: `user_id nullable` — khi `NULL` là danh mục hệ thống chia sẻ chung.
- **Ý nghĩa nghiệp vụ**: Người dùng mới có sẵn danh mục mặc định; có thể thêm danh mục riêng.

#### Quan hệ 3: categories → categories (Self-Referential 1:N)

```
categories.category_id (PK)  ────── (1) ← Danh mục cha
                                       │
categories.parent_id (FK, nullable)  ── (N) ← Danh mục con
```

- **ON DELETE CASCADE**: Xóa danh mục cha → xóa toàn bộ danh mục con.
- **Root categories**: `parent_id = NULL`.
- **Ý nghĩa nghiệp vụ**: "Ăn uống > Ăn sáng", "Đi lại > Xăng xe", v.v.

#### Quan hệ 4: users → transactions (1:N)

```
users.user_id (PK)  ──────────────── (1)
                                       │
transactions.user_id (FK, CASCADE)  ── (N)
```

- **Bảng trung tâm nhất**: Mọi hoạt động tài chính đều tạo ra ít nhất một transaction.

#### Quan hệ 5: wallets → transactions (1:N)

```
wallets.wallet_id (PK)  ─────────── (1)
                                       │
transactions.wallet_id (FK)  ────────── (N)
```

- **Không CASCADE**: Xóa ví không xóa giao dịch (giữ lại lịch sử).
- **Ý nghĩa nghiệp vụ**: Có thể truy vấn toàn bộ lịch sử ví dù ví đã bị đóng.

#### Quan hệ 6: categories → transactions (1:N)

```
categories.category_id (PK)  ──────── (1)
                                        │
transactions.category_id (FK)  ─────── (N)
```

- **Ý nghĩa nghiệp vụ**: Phân loại giao dịch để thống kê theo danh mục.

#### Quan hệ 7: transactions → debt_repayments (1:1)

```
transactions.transaction_id (PK)  ──── (1)
                                         │
debt_repayments.transaction_id (FK, UNIQUE)  ── (0 hoặc 1)
```

- **UNIQUE constraint** trên FK tạo quan hệ 1-1: Mỗi giao dịch chỉ được liên kết với tối đa một lần trả nợ.
- **Ý nghĩa nghiệp vụ**: Khi ghi nhận trả nợ, hệ thống tạo transaction (để trừ tiền ví) VÀ debt_repayment (để gạch nợ) trong cùng một atomic operation.

#### Quan hệ 8: debts → debt_repayments (1:N)

```
debts.debt_id (PK)  ──────────────── (1)
                                        │
debt_repayments.debt_id (FK, CASCADE)  ─ (N)
```

- **Cardinality**: Một khoản nợ có thể được thanh toán nhiều lần (trả góp).
- **ON DELETE CASCADE**: Xóa hợp đồng nợ → xóa toàn bộ lịch sử trả nợ.

#### Quan hệ 9: wallets → investments (1:N)

```
wallets.wallet_id (PK)  ─────────── (1)
                                       │
investments.wallet_id (FK)  ────────── (N)
```

- **Ý nghĩa nghiệp vụ**: Tracking nguồn vốn đầu tư từ ví nào.

#### Quan hệ 10: wallets + categories → subscriptions (1:N, 1:N)

```
wallets.wallet_id (PK)  ──────── (1) → subscriptions.default_wallet_id (N)
categories.category_id (PK) ──── (1) → subscriptions.category_id (N)
```

- **Ý nghĩa nghiệp vụ**: Mỗi gói định kỳ chỉ định ví mặc định để tự động trừ tiền.

#### Quan hệ 11: categories → budgets (1:N)

```
categories.category_id (PK)  ──── (1)
                                     │
budgets.category_id (FK)  ─────────── (N)
```

- **Ý nghĩa nghiệp vụ**: Ngân sách được thiết lập theo từng danh mục chi tiêu.

---

## 4. THIẾT KẾ CƠ SỞ DỮ LIỆU PHI QUAN HỆ (MongoDB)

### 4.1 Tổng quan MongoDB trong IFinance

MongoDB Atlas được sử dụng **độc lập song song** với PostgreSQL, phục vụ duy nhất cho chức năng **RAG Chatbot** (Retrieval-Augmented Generation). Không có dữ liệu tài chính nào được lưu trong MongoDB.

```python
# app/db/mongodb.py
client = MongoClient(MONGO_URI)
mongodb = client["ifinance_db"]          # Database
chat_collection = mongodb["chat_history"] # Collection
```

### 4.2 Collection: `chat_history`

**Mục đích:** Lưu trữ toàn bộ lịch sử hội thoại giữa người dùng và AI Assistant. Dữ liệu này được dùng làm **ngữ cảnh (context)** cho Gemini Flash trong mỗi lần gọi AI mới.

#### Schema Document (không có schema enforcement — flexible)

```json
{
    "_id": "ObjectId (auto-generated by MongoDB)",
    "session_id": "string (UUID v4)",
    "user_id": "integer",
    "sender": "string ('user' | 'assistant')",
    "text": "string",
    "timestamp": "ISODate (UTC)"
}
```

#### Mô tả từng trường

| Trường | Kiểu BSON | Ý nghĩa | Ví dụ |
|--------|----------|---------|-------|
| `_id` | ObjectId | Khóa chính tự sinh của MongoDB | `ObjectId("6614a3b2...")` |
| `session_id` | String | UUID phân biệt cuộc hội thoại. Mỗi phiên chat là một `session_id` riêng | `"f47ac10b-58cc-4372-a567-0e02b2c3d479"` |
| `user_id` | Int32 | ID người dùng — dùng để lọc dữ liệu đúng user (mirror từ PostgreSQL `users.user_id`) | `42` |
| `sender` | String | Nguồn gốc tin nhắn | `"user"` hoặc `"assistant"` |
| `text` | String | Nội dung tin nhắn | `"Tháng này tôi chi bao nhiêu tiền?"` |
| `timestamp` | Date | Thời điểm gửi (UTC) dùng để sort theo thứ tự thời gian | `ISODate("2026-04-14T10:30:00Z")` |

#### Ví dụ một cuộc hội thoại (3 document)

```json
// Document 1 — User gửi câu hỏi
{
    "_id": ObjectId("6614a3b200000001"),
    "session_id": "f47ac10b-0001",
    "user_id": 42,
    "sender": "user",
    "text": "Tháng này mình chi bao nhiêu tiền ăn uống rồi?",
    "timestamp": ISODate("2026-04-14T10:00:00Z")
}

// Document 2 — AI trả lời
{
    "_id": ObjectId("6614a3b200000002"),
    "session_id": "f47ac10b-0001",
    "user_id": 42,
    "sender": "assistant",
    "text": "Dựa trên dữ liệu của bạn, tháng 4/2026 bạn đã chi **1,250,000 VND** cho danh mục Ăn uống, chiếm 25% tổng chi tiêu tháng này.",
    "timestamp": ISODate("2026-04-14T10:00:05Z")
}

// Document 3 — User tiếp tục hội thoại
{
    "_id": ObjectId("6614a3b200000003"),
    "session_id": "f47ac10b-0001",
    "user_id": 42,
    "sender": "user",
    "text": "Ghi thêm cho mình bữa ăn trưa hôm nay 85k nhé",
    "timestamp": ISODate("2026-04-14T12:30:00Z")
}
```

### 4.3 Query pattern trong RAG Chatbot

```python
# Lấy 6 tin nhắn gần nhất trong session để build context window
recent_chat = chat_collection.find(
    {
        "session_id": session_id,   # Filter đúng cuộc hội thoại
        "user_id": user_id          # Filter đúng người dùng (bảo mật)
    }
).sort("timestamp", -1).limit(6)   # Sắp xếp mới nhất, lấy 6 tin nhắn

# Lưu tin nhắn mới vào collection
chat_collection.insert_one({
    "session_id": session_id,
    "user_id": user_id,
    "sender": "user",
    "text": message,
    "timestamp": datetime.utcnow()
})
```

### 4.4 Đặc điểm kỹ thuật MongoDB trong IFinance

| Đặc điểm | Chi tiết |
|---------|---------|
| **Connection** | MongoClient singleton khởi tạo khi ứng dụng start |
| **Database** | `ifinance_db` |
| **Collection** | `chat_history` (1 collection duy nhất) |
| **Index khuyến nghị** | `{ session_id: 1, user_id: 1, timestamp: -1 }` — compound index |
| **Retention policy** | Không giới hạn (có thể thêm TTL index để tự xóa sau N ngày) |
| **Consistency** | Eventual consistency — chấp nhận được cho chat history |
| **Fail-safe** | `if chat_collection is None: raise RuntimeError` — graceful degradation nếu MongoDB offline |

---

## 5. LỊCH SỬ TIẾN HÓA SCHEMA (ALEMBIC MIGRATIONS)

Alembic — công cụ migration của SQLAlchemy — được sử dụng để quản lý toàn bộ thay đổi schema PostgreSQL theo thứ tự thời gian. Mỗi migration là một file Python với phiên bản (revision ID) và mô tả rõ ràng.

### Thứ tự migration

| Revision ID (rút gọn) | Nội dung thay đổi | Giai đoạn phát triển |
|----------------------|------------------|---------------------|
| `59ad80630598` | **Initial schema** — Tạo toàn bộ bảng lõi: users, wallets, categories, transactions, debts, debt_repayments, investments, subscriptions, budgets | v0.1 — MVP |
| `79aee8821840` | Thêm bảng `token_blacklist` — Hỗ trợ Zero-Trust Logout | v0.2 — Security |
| `38b3f14e370d` | Thêm cột `is_active` và `credit_limit` vào bảng `wallets` — Hỗ trợ đóng ví và thẻ tín dụng | v0.3 — Wallet types |
| `5e1bfba0d1e8` | Thêm cột `quantity` vào bảng `investments` — Hỗ trợ tracking số lượng đơn vị đầu tư | v0.4 — Investment |
| `ba3e26a24f84` | Thêm cột `is_rollover` vào bảng `budgets` — Tính năng cộng dồn ngân sách | v0.5 — Budget |
| `cbc807782163` | Thêm cột `total_passive_income` vào `investments` — Tích lũy thu nhập thụ động | v0.6 — Investment+ |
| `f7703a8b0f47` | Thêm cột `is_active` vào `subscriptions` — Tạm dừng gói định kỳ | v0.7 — Subscription |
| `c9d1e2f3a4b5` | Thêm cột `has_seen_tutorial` vào `users` — Hệ thống onboarding tutorial | v0.8 — UX |

### Vòng đời migration

```bash
# 1. Phát hiện thay đổi trong model file
alembic revision --autogenerate -m "mô tả thay đổi"
# → Sinh file migration trong alembic/versions/

# 2. Review và chỉnh sửa file migration nếu cần

# 3. Áp dụng migration
alembic upgrade head

# 4. Rollback nếu có vấn đề
alembic downgrade -1
```

---

## 6. CHIẾN LƯỢC HYBRID DATABASE (PostgreSQL + MongoDB)

### 6.1 Lý do không dùng chỉ một hệ quản trị duy nhất

#### Phương án A: Chỉ dùng PostgreSQL

```
PROS:
  ✓ Đơn giản hóa infrastructure (1 DBMS)
  ✓ ACID transaction xuyên suốt
  ✓ JOIN giữa chat history và dữ liệu tài chính

CONS:
  ✗ Chat history schema sẽ thay đổi thường xuyên
    (thêm fields mới như reactions, attachments...)
    → Yêu cầu Alembic migration mỗi lần
  ✗ JSON column trong PostgreSQL kém linh hoạt
    hơn native MongoDB document
  ✗ Lưu lịch sử chat dài làm phình bảng SQL,
    ảnh hưởng hiệu năng query tài chính
  ✗ Không scale ngang (horizontal) dễ dàng
    cho lưu lượng chat lớn
```

#### Phương án B: Chỉ dùng MongoDB

```
PROS:
  ✓ Schema linh hoạt tuyệt đối
  ✓ Scale ngang dễ dàng

CONS:
  ✗ Không có ACID transaction thực sự
    → Nguy hiểm với dữ liệu tài chính
    (VD: trừ tiền ví nhưng không tạo được GD)
  ✗ Không có Foreign Key constraint
    → Không thể đảm bảo referential integrity
  ✗ JOIN phức tạp (phải dùng $lookup aggregation)
  ✗ NUMERIC precision cho tài chính không tốt
    bằng PostgreSQL NUMERIC(15,2)
```

#### Phương án C (Được chọn): Hybrid PostgreSQL + MongoDB

```
PHÂN CÔNG RÕ RÀNG THEO TÍNH CHẤT DỮ LIỆU:

PostgreSQL ─── Dữ liệu tài chính (ACID, quan hệ, precision)
MongoDB    ─── Lịch sử chat AI (flexible, document, fast read)

PROS:
  ✓ Đúng công cụ cho đúng bài toán
  ✓ ACID cho tài chính, schema-free cho chat
  ✓ Tách biệt load: chat traffic không ảnh hưởng
    tới query tài chính
  ✓ Dễ mở rộng schema chat mà không migration

CONS:
  ✗ Phức tạp hơn (2 connection pools)
  ✗ Không thể JOIN trực tiếp giữa 2 DB
  → Được giải quyết bằng Application-level join
    trong ai_service.py (query riêng rồi merge)
```

### 6.2 Ma trận so sánh kỹ thuật

| Tiêu chí | PostgreSQL | MongoDB |
|---------|-----------|---------|
| **ACID Transactions** | Đầy đủ | Partial (single document) |
| **Schema Enforcement** | Strict (DDL) | Flexible (schema-free) |
| **Referential Integrity** | Foreign Key constraints | Không có (application-level) |
| **Query Language** | SQL (chuẩn quốc tế) | MQL (MongoDB Query Language) |
| **JOIN** | Native, hiệu quả | `$lookup` aggregate (chậm hơn) |
| **Horizontal Scaling** | Khó (cần sharding setup) | Native (auto-sharding) |
| **JSON/Document** | JSON column (hỗ trợ) | Native document store |
| **Financial Precision** | `NUMERIC(15,2)` xuất sắc | Double (có thể mất độ chính xác) |
| **Read Pattern** | Indexed queries, JOIN | `find({session_id})` đơn giản |
| **Write Pattern** | Transaction với commit | Insert one/many, eventual |
| **Use case phù hợp** | Dữ liệu quan hệ, tài chính | Time-series, documents, logs |

### 6.3 Nguyên tắc phân vùng dữ liệu (Data Partitioning)

```
Rule: "Dữ liệu nào cần ACID và FK → PostgreSQL
       Dữ liệu nào schema-free, append-only → MongoDB"

PostgreSQL (10 bảng):
  • users, wallets, categories   ← Master data (cần FK, unique)
  • transactions, debt_repayments ← Financial records (cần ACID)
  • debts, investments            ← Financial contracts (cần precision)
  • subscriptions, budgets        ← Configuration (cần FK)
  • token_blacklist               ← Security records (cần uniqueness)

MongoDB (1 collection):
  • chat_history                  ← Log/event data (schema thay đổi,
                                    append-only, cần đọc nhanh theo session)
```

---

## 7. ƯU ĐIỂM THIẾT KẾ CƠ SỞ DỮ LIỆU

### 7.1 Đảm bảo tính toàn vẹn dữ liệu (Data Integrity)

| Cơ chế | Triển khai | Mục đích |
|--------|-----------|---------|
| **Foreign Key Constraints** | 16 FK trên 9 bảng | Đảm bảo tham chiếu hợp lệ |
| **Cascade Delete** | `ondelete="CASCADE"` trên FK → users | Tự động dọn sạch dữ liệu orphan |
| **ENUM Types** | 7 PostgreSQL ENUM | Ngăn giá trị ngoài domain |
| **NOT NULL constraints** | Trên các cột bắt buộc | Ngăn thiếu dữ liệu thiết yếu |
| **UNIQUE constraints** | username, email, token, transaction_id | Ngăn trùng lặp |
| **NUMERIC precision** | `NUMERIC(15,2)` cho tiền | Không sai số dấu phẩy động |

### 7.2 Hiệu năng truy vấn (Query Performance)

| Kỹ thuật | Áp dụng tại | Lợi ích |
|---------|------------|---------|
| **B-tree Index** | `users.username`, `users.email`, `token_blacklist.token` | Đăng nhập O(log n) thay vì O(n) |
| **Derived fields** | `debts.remaining_amount`, `wallets.balance` | Tránh SUM aggregate mỗi lần load |
| **Pagination** | Mọi list endpoint (skip + limit) | Không load toàn bộ bảng |
| **Compound Index (MongoDB)** | `{session_id, user_id, timestamp}` | Sort theo thời gian nhanh |
| **Connection Pool** | SQLAlchemy SessionLocal | Tái sử dụng connection, không mở mới mỗi request |

### 7.3 Khả năng bảo trì (Maintainability)

- **Alembic Migration History**: Toàn bộ 8 thay đổi schema đều có file Python với lịch sử, rollback được, không can thiệp thủ công vào database.
- **ORM abstraction**: SQLAlchemy Models là Single Source of Truth — thay đổi model → autogenerate migration → không viết SQL thủ công.
- **Enum centralization**: Tất cả domain values định nghĩa một chỗ (`enums.py`), thay đổi enum lan tuyền tự động sang Pydantic schemas và PostgreSQL type.

### 7.4 Khả năng mở rộng (Scalability)

- **Stateless backend**: Database không lưu session state → có thể chạy nhiều backend instance song song (horizontal scale) mà không conflict.
- **Modular entity design**: Thêm tính năng mới (VD: "bills", "goals") chỉ cần tạo model mới + migration, không sửa bảng hiện có.
- **MongoDB auto-sharding**: Chat history có thể scale riêng biệt mà không ảnh hưởng PostgreSQL.

### 7.5 Bảo mật dữ liệu (Data Security)

- **Bcrypt hashing**: `password_hash` không bao giờ là plaintext — kể cả DB admin cũng không đọc được mật khẩu gốc.
- **Token Blacklist**: JWT logout không phụ thuộc vào expiry — token bị thu hồi ngay lập tức, chống replay attack.
- **User Isolation**: Mọi query đều có điều kiện `WHERE user_id = ?` — không thể cross-user data leak dù có SQL injection (nhờ SQLAlchemy parameterized query).
- **No sensitive data in MongoDB**: Chat history không chứa số tài khoản, số dư, password — chỉ chứa nội dung hội thoại.

### 7.6 Thiết kế cho nghiệp vụ tài chính

- **ACID transactions**: Cập nhật `wallet.balance` và INSERT `transaction` trong cùng một `db.commit()` — không thể xảy ra tình huống trừ tiền nhưng không ghi giao dịch.
- **Always-positive amount**: `amount > 0` luôn đúng — chiều tài chính xác định bởi `transaction_type`, tránh bug âm/dương.
- **Derived `remaining_amount`**: Cập nhật ngay khi có trả nợ (eager update) thay vì tính động mỗi lần query — cân bằng giữa độ chính xác và hiệu năng.
- **`NUMERIC(20,8)` cho crypto**: Hỗ trợ tài sản có giá trị rất nhỏ như Satoshi (0.00000001 BTC) mà không mất độ chính xác.

---

## PHỤ LỤC A: DANH SÁCH TOÀN BỘ FOREIGN KEY

| STT | Bảng con | Cột FK | Bảng cha | Cột PK | ON DELETE |
|-----|----------|--------|----------|--------|----------|
| 1 | `wallets` | `user_id` | `users` | `user_id` | CASCADE |
| 2 | `categories` | `user_id` | `users` | `user_id` | CASCADE |
| 3 | `categories` | `parent_id` | `categories` | `category_id` | CASCADE |
| 4 | `transactions` | `user_id` | `users` | `user_id` | CASCADE |
| 5 | `transactions` | `wallet_id` | `wallets` | `wallet_id` | RESTRICT |
| 6 | `transactions` | `category_id` | `categories` | `category_id` | RESTRICT |
| 7 | `debts` | `user_id` | `users` | `user_id` | CASCADE |
| 8 | `debt_repayments` | `debt_id` | `debts` | `debt_id` | CASCADE |
| 9 | `debt_repayments` | `transaction_id` | `transactions` | `transaction_id` | RESTRICT (UNIQUE) |
| 10 | `investments` | `user_id` | `users` | `user_id` | CASCADE |
| 11 | `investments` | `wallet_id` | `wallets` | `wallet_id` | RESTRICT |
| 12 | `subscriptions` | `user_id` | `users` | `user_id` | CASCADE |
| 13 | `subscriptions` | `default_wallet_id` | `wallets` | `wallet_id` | RESTRICT |
| 14 | `subscriptions` | `category_id` | `categories` | `category_id` | RESTRICT |
| 15 | `budgets` | `user_id` | `users` | `user_id` | CASCADE |
| 16 | `budgets` | `category_id` | `categories` | `category_id` | RESTRICT |

> **Ghi chú phân loại ON DELETE:**
> - **CASCADE**: Xóa bản ghi cha → xóa dây chuyền bản ghi con. Áp dụng cho quan hệ "ownership" (users sở hữu các entity).
> - **RESTRICT (mặc định)**: Ngăn xóa bản ghi cha nếu còn bản ghi con tham chiếu. Áp dụng cho quan hệ "reference" (transaction tham chiếu wallet đã tồn tại).

---

## PHỤ LỤC B: TỔNG HỢP KIỂU DỮ LIỆU

| Kiểu Python/SQLAlchemy | Kiểu PostgreSQL | Dùng cho | Ghi chú |
|-----------------------|----------------|---------|---------|
| `Integer` | `INTEGER / SERIAL` | PK, FK, IDs | Auto-increment với `SERIAL` |
| `String(N)` | `VARCHAR(N)` | Tên, email, hash | N = giới hạn ký tự |
| `Text` | `TEXT` | Note, ghi chú | Không giới hạn độ dài |
| `Numeric(15, 2)` | `NUMERIC(15,2)` | Số tiền VND | Chính xác tuyệt đối, tránh floating point |
| `Numeric(20, 8)` | `NUMERIC(20,8)` | Số lượng crypto | Hỗ trợ đến 8 chữ số thập phân |
| `Float` | `FLOAT8` | Lãi suất (%) | Tỷ lệ, chấp nhận imprecision nhỏ |
| `Boolean` | `BOOLEAN` | Flags (is_active, has_seen...) | true/false |
| `Date` | `DATE` | Ngày (không có giờ) | Ngày đến hạn, ngày bắt đầu |
| `DateTime(timezone=True)` | `TIMESTAMPTZ` | Timestamp với timezone | Lưu UTC, hiển thị theo local |
| `JSON` | `JSON` | images, ocr_data | Flexible structured data |
| `SQLEnum(...)` | `enumtype` | Domain values | Type-safe enum tại DB level |

---

*Tài liệu Database Design Document — IFinance v1.0*
*Ngày lập: 14/04/2026 | Tác giả: IFinance Development Team*
