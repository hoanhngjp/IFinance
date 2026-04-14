# USE CASE SPECIFICATION (UCS)
## Hệ thống Quản lý Tài chính Cá nhân IFinance

| Thông tin | Chi tiết |
|-----------|---------|
| **Phiên bản tài liệu** | v1.0 |
| **Ngày lập** | 14/04/2026 |
| **Hệ thống** | IFinance — Personal Finance Management System |
| **Phương pháp** | UML Use Case + Sequence Diagram (mô tả text) |
| **Mục đích** | Chương "Phân tích Yêu cầu" trong báo cáo đồ án chuyên ngành |

---

## MỤC LỤC

1. [Tổng quan hệ thống](#1-tổng-quan-hệ-thống)
2. [Danh sách Actor](#2-danh-sách-actor)
3. [Danh sách Use Case tổng hợp](#3-danh-sách-use-case-tổng-hợp)
4. [Đặc tả chi tiết Use Case](#4-đặc-tả-chi-tiết-use-case)
   - UC-01: Đăng ký tài khoản
   - UC-02: Đăng nhập hệ thống
   - UC-03: Quản lý ví tiền
   - UC-04: Quản lý danh mục
   - UC-05: Tạo giao dịch thủ công
   - UC-06: Xem danh sách và lọc giao dịch
   - UC-07: Chỉnh sửa / Xóa giao dịch
   - UC-08: Smart Input bằng AI (NLP)
   - UC-09: OCR quét hóa đơn
   - UC-10: Smart Bulk Import từ file CSV/Excel
   - UC-11: Chatbot AI tư vấn tài chính (RAG)
   - UC-12: Quản lý ngân sách
   - UC-13: Quản lý sổ nợ
   - UC-14: Quản lý danh mục đầu tư
   - UC-15: Quản lý chi tiêu định kỳ
   - UC-16: Xem Dashboard & Thống kê
   - UC-17: Tự động xử lý gói định kỳ (System)
5. [Sequence Diagram — Mô tả text](#5-sequence-diagram--mô-tả-text)
   - SD-01: AI Smart Input
   - SD-02: Import File Excel/CSV
   - SD-03: Chatbot RAG
   - SD-04: Transaction Flow (Tạo giao dịch)
   - SD-05: Auto Token Refresh

---

## 1. TỔNG QUAN HỆ THỐNG

IFinance là hệ thống quản lý tài chính cá nhân hỗ trợ người dùng theo dõi thu chi, quản lý ví, lập ngân sách, theo dõi đầu tư và nợ vay. Hệ thống tích hợp trí tuệ nhân tạo (Google Gemini Flash 2.5) để tự động hóa nhập liệu, phân tích tài chính và tư vấn thông minh.

**Phạm vi hệ thống:**

```
┌───────────────────────────────────────────────────────────────┐
│                    HỆ THỐNG IFINANCE                           │
│                                                               │
│  ┌──────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │  QUẢN LÝ TÀI │  │  AI AUTOMATION  │  │  PHÂN TÍCH &   │  │
│  │  CHÍNH CÁ NH.│  │                 │  │  THỐNG KÊ       │  │
│  │              │  │  • Smart Input  │  │                 │  │
│  │  • Giao dịch │  │  • OCR Receipt  │  │  • Dashboard    │  │
│  │  • Ví tiền   │  │  • Bulk Import  │  │  • Báo cáo      │  │
│  │  • Ngân sách │  │  • RAG Chatbot  │  │  • Xu hướng     │  │
│  │  • Nợ vay    │  │  • Auto-Worker  │  │  • Khuyến nghị  │  │
│  │  • Đầu tư    │  │                 │  │                 │  │
│  └──────────────┘  └─────────────────┘  └─────────────────┘  │
└───────────────────────────────────────────────────────────────┘
```

---

## 2. DANH SÁCH ACTOR

### 2.1 Actor chính

#### Actor 1: Người dùng (User)

| Thuộc tính | Mô tả |
|-----------|-------|
| **Định nghĩa** | Người đã đăng ký tài khoản và đăng nhập vào hệ thống IFinance |
| **Mục tiêu** | Quản lý tài chính cá nhân: ghi nhận thu chi, theo dõi ví, ngân sách, nợ, đầu tư |
| **Đặc điểm** | Không có quyền quản trị hệ thống; chỉ thao tác trên dữ liệu của chính mình |
| **Phương thức xác thực** | JWT Access Token (60 phút) + Refresh Token (7 ngày); hoặc Google OAuth2 |
| **Điều kiện tiên quyết** | Đã đăng ký tài khoản và đăng nhập thành công |

**Các nhóm hành vi chính của Người dùng:**
- Quản lý dữ liệu tài chính (ví, danh mục, giao dịch, ngân sách, nợ, đầu tư, gói định kỳ)
- Sử dụng các công cụ AI (Smart Input, OCR, Chatbot)
- Xem thống kê và phân tích tài chính

#### Actor 2: Hệ thống AI (AI System — Gemini Flash 2.5)

| Thuộc tính | Mô tả |
|-----------|-------|
| **Định nghĩa** | Dịch vụ Google Gemini Flash 2.5 được tích hợp vào Backend IFinance |
| **Mục tiêu** | Cung cấp khả năng xử lý ngôn ngữ tự nhiên, nhận dạng hình ảnh, và trả lời thông minh |
| **Đặc điểm** | External actor; không khởi xướng hành động — chỉ phản hồi khi được Backend gọi |
| **Giao tiếp** | HTTPS API calls từ `AIService` tới Google AI Studio endpoint |
| **Rate limit** | 5 request/phút cho NLP Parse; 3 request/phút cho OCR |

**Các chức năng AI System tham gia:**
- Phân tích ngôn ngữ tự nhiên (Smart Input)
- Nhận dạng và trích xuất dữ liệu từ ảnh hóa đơn (OCR)
- Tạo phản hồi hội thoại dựa trên ngữ cảnh tài chính (RAG Chatbot)
- Gọi Function (Function Calling) để ghi nhận giao dịch từ chat
- Đề xuất ngân sách (Budget Template)

#### Actor 3: Hệ thống nền (Background System — APScheduler)

| Thuộc tính | Mô tả |
|-----------|-------|
| **Định nghĩa** | Background worker chạy ngầm trong FastAPI process, được quản lý bởi APScheduler |
| **Mục tiêu** | Tự động xử lý các gói chi tiêu định kỳ đến hạn mà không cần người dùng thao tác |
| **Đặc điểm** | Không có giao diện người dùng; chạy theo lịch cron 00:01 mỗi ngày |
| **Trigger** | Cron job: `hour=0, minute=1` — mỗi ngày lúc 00:01 AM |

### 2.2 Ghi chú về Admin

> IFinance **không có module quản trị (Admin)** riêng biệt trong phiên bản hiện tại. Việc quản trị hệ thống (tạo danh mục mặc định, seed data, maintenance) được thực hiện trực tiếp qua:
> - **Script Python** (`seed.py`) — khởi tạo dữ liệu mẫu
> - **Alembic CLI** — quản lý schema database
> - **FastAPI Swagger UI** (`/docs`) — test và debug API
> - **Supabase/MongoDB Atlas Dashboard** — quản lý database trực tiếp

---

## 3. DANH SÁCH USE CASE TỔNG HỢP

### 3.1 Use Case Diagram (mô tả text)

```
╔══════════════════════════════════════════════════════════════════╗
║                    HỆ THỐNG IFINANCE                             ║
║                                                                  ║
║  ┌─────────────────────────────────────────────────────────┐    ║
║  │              NHÓM: XÁC THỰC                              │    ║
║  │  UC-01 Đăng ký tài khoản                                │◄───╫── Người dùng
║  │  UC-02 Đăng nhập hệ thống                               │◄───╫── Người dùng
║  └─────────────────────────────────────────────────────────┘    ║
║                                                                  ║
║  ┌─────────────────────────────────────────────────────────┐    ║
║  │              NHÓM: DỮ LIỆU CƠ SỞ                        │    ║
║  │  UC-03 Quản lý ví tiền                                  │◄───╫── Người dùng
║  │  UC-04 Quản lý danh mục                                 │◄───╫── Người dùng
║  └─────────────────────────────────────────────────────────┘    ║
║                                                                  ║
║  ┌─────────────────────────────────────────────────────────┐    ║
║  │              NHÓM: GIAO DỊCH                             │    ║
║  │  UC-05 Tạo giao dịch thủ công                           │◄───╫── Người dùng
║  │  UC-06 Xem danh sách & lọc giao dịch                    │◄───╫── Người dùng
║  │  UC-07 Chỉnh sửa / Xóa giao dịch                        │◄───╫── Người dùng
║  └─────────────────────────────────────────────────────────┘    ║
║                                                                  ║
║  ┌─────────────────────────────────────────────────────────┐    ║
║  │              NHÓM: AI & NHẬP LIỆU THÔNG MINH             │    ║
║  │  UC-08 Smart Input bằng AI (NLP)        ◄── AI System   │◄───╫── Người dùng
║  │  UC-09 OCR quét hóa đơn                ◄── AI System   │◄───╫── Người dùng
║  │  UC-10 Smart Bulk Import từ file       (extend UC-05)  │◄───╫── Người dùng
║  │  UC-11 Chatbot AI tư vấn (RAG)         ◄── AI System   │◄───╫── Người dùng
║  └─────────────────────────────────────────────────────────┘    ║
║                                                                  ║
║  ┌─────────────────────────────────────────────────────────┐    ║
║  │              NHÓM: QUẢN LÝ TÀI CHÍNH                    │    ║
║  │  UC-12 Quản lý ngân sách                                │◄───╫── Người dùng
║  │  UC-13 Quản lý sổ nợ                                    │◄───╫── Người dùng
║  │  UC-14 Quản lý danh mục đầu tư                          │◄───╫── Người dùng
║  │  UC-15 Quản lý chi tiêu định kỳ                         │◄───╫── Người dùng
║  └─────────────────────────────────────────────────────────┘    ║
║                                                                  ║
║  ┌─────────────────────────────────────────────────────────┐    ║
║  │              NHÓM: THỐNG KÊ & TỰ ĐỘNG HÓA               │    ║
║  │  UC-16 Xem Dashboard & Thống kê                         │◄───╫── Người dùng
║  │  UC-17 Tự động xử lý gói định kỳ       (System Actor)  │◄───╫── Background System
║  └─────────────────────────────────────────────────────────┘    ║
╚══════════════════════════════════════════════════════════════════╝
```

### 3.2 Bảng tổng hợp Use Case

| Mã UC | Tên Use Case | Actor chính | Nhóm chức năng | Độ ưu tiên |
|-------|-------------|------------|----------------|-----------|
| UC-01 | Đăng ký tài khoản | Người dùng | Xác thực | Cao |
| UC-02 | Đăng nhập hệ thống | Người dùng | Xác thực | Cao |
| UC-03 | Quản lý ví tiền | Người dùng | Dữ liệu cơ sở | Cao |
| UC-04 | Quản lý danh mục | Người dùng | Dữ liệu cơ sở | Cao |
| UC-05 | Tạo giao dịch thủ công | Người dùng | Giao dịch | Cao |
| UC-06 | Xem danh sách & lọc giao dịch | Người dùng | Giao dịch | Cao |
| UC-07 | Chỉnh sửa / Xóa giao dịch | Người dùng | Giao dịch | Trung bình |
| UC-08 | Smart Input bằng AI (NLP) | Người dùng, AI System | AI & Nhập liệu | Cao |
| UC-09 | OCR quét hóa đơn | Người dùng, AI System | AI & Nhập liệu | Trung bình |
| UC-10 | Smart Bulk Import từ file | Người dùng | AI & Nhập liệu | Cao |
| UC-11 | Chatbot AI tư vấn (RAG) | Người dùng, AI System | AI & Nhập liệu | Cao |
| UC-12 | Quản lý ngân sách | Người dùng | Quản lý tài chính | Trung bình |
| UC-13 | Quản lý sổ nợ | Người dùng | Quản lý tài chính | Trung bình |
| UC-14 | Quản lý danh mục đầu tư | Người dùng | Quản lý tài chính | Trung bình |
| UC-15 | Quản lý chi tiêu định kỳ | Người dùng | Quản lý tài chính | Trung bình |
| UC-16 | Xem Dashboard & Thống kê | Người dùng | Thống kê | Cao |
| UC-17 | Tự động xử lý gói định kỳ | Background System | Tự động hóa | Cao |

---

## 4. ĐẶC TẢ CHI TIẾT USE CASE

---

### UC-01: Đăng ký tài khoản

| Trường | Nội dung |
|--------|---------|
| **Mã Use Case** | UC-01 |
| **Tên** | Đăng ký tài khoản |
| **Actor chính** | Người dùng (chưa có tài khoản) |
| **Mục tiêu** | Tạo tài khoản mới để sử dụng hệ thống IFinance |
| **Tiền điều kiện** | Người dùng chưa có tài khoản; có kết nối Internet |
| **Hậu điều kiện** | Tài khoản được tạo trong database; người dùng được chuyển hướng đến trang đăng nhập |

**Luồng chính (Main Flow):**

```
1. Người dùng truy cập trang /register
2. Hệ thống hiển thị form đăng ký với các trường:
   username, email, password, confirm_password, full_name
3. Người dùng điền đầy đủ thông tin và nhấn "Đăng ký"
4. Hệ thống kiểm tra validation phía client:
   a. username: 3–50 ký tự, không chứa ký tự đặc biệt
   b. email: đúng định dạng email
   c. password: tối thiểu 6 ký tự
   d. confirm_password == password
5. Frontend gửi POST /api/v1/auth/register với payload JSON
6. Backend kiểm tra username và email chưa tồn tại trong DB
7. Backend hash mật khẩu bằng Bcrypt
8. Backend INSERT bản ghi User mới vào bảng users
9. Backend trả về HTTP 201 Created
10. Frontend hiển thị thông báo "Đăng ký thành công"
11. Frontend tự động chuyển hướng đến /login sau 2 giây
```

**Luồng thay thế (Alternative Flow):**

| Tình huống | Xử lý |
|-----------|-------|
| **A1 — Username đã tồn tại** | Bước 6: Backend trả về HTTP 400 với message "Username đã được sử dụng". Frontend hiển thị lỗi dưới trường username |
| **A2 — Email đã đăng ký** | Bước 6: Backend trả về HTTP 400 với message "Email đã được đăng ký". Frontend hiển thị lỗi dưới trường email |
| **A3 — Validation thất bại** | Bước 4: Frontend hiển thị thông báo lỗi inline, không gửi request đến Backend |
| **A4 — Đăng ký bằng Google** | Thay thế toàn bộ luồng chính: Người dùng click "Đăng nhập với Google" → Google OAuth2 → Backend upsert user → Trả JWT → Vào app |
| **A5 — Lỗi mạng** | Bước 5: Frontend hiển thị toast "Không thể kết nối đến máy chủ" |

---

### UC-02: Đăng nhập hệ thống

| Trường | Nội dung |
|--------|---------|
| **Mã Use Case** | UC-02 |
| **Tên** | Đăng nhập hệ thống |
| **Actor chính** | Người dùng |
| **Mục tiêu** | Xác thực danh tính và nhận JWT token để truy cập các chức năng bảo vệ |
| **Tiền điều kiện** | Người dùng đã có tài khoản; tài khoản đang ở trạng thái is_active = true |
| **Hậu điều kiện** | JWT access_token và refresh_token được lưu trong localStorage; người dùng được chuyển đến Dashboard |

**Luồng chính (Main Flow):**

```
1. Người dùng truy cập /login
2. Hệ thống hiển thị form đăng nhập (email/username + password)
3. Người dùng nhập thông tin và nhấn "Đăng nhập"
4. Frontend gửi POST /api/v1/auth/login
5. Backend tìm kiếm user theo email (hoặc username)
6. Backend xác thực mật khẩu bằng Bcrypt.verify()
7. Backend kiểm tra user.is_active == true
8. Backend tạo cặp token:
   - access_token (HS256, hết hạn 60 phút)
   - refresh_token (HS256, hết hạn 7 ngày)
9. Backend trả về HTTP 200 với {access_token, refresh_token, token_type}
10. Frontend lưu tokens vào localStorage
11. Frontend chuyển hướng đến /
12. UserProvider.fetchUser() được gọi → lấy thông tin user từ /users/me
13. Nếu user.has_seen_tutorial == false → Tutorial tự động hiển thị
```

**Luồng thay thế (Alternative Flow):**

| Tình huống | Xử lý |
|-----------|-------|
| **A1 — Sai mật khẩu** | Bước 6: Backend trả về HTTP 401. Frontend hiển thị toast lỗi "Sai email hoặc mật khẩu" |
| **A2 — Email không tồn tại** | Bước 5: Backend trả về HTTP 401 (thông báo chung, không tiết lộ email có tồn tại không) |
| **A3 — Tài khoản bị khóa** | Bước 7: Backend trả về HTTP 403 "Tài khoản đã bị vô hiệu hóa" |
| **A4 — Đăng nhập Google OAuth2** | Thay thế bước 3–9: Google ID Token → Backend verify → Upsert user → Trả JWT |
| **A5 — Access token hết hạn (sau khi đã đăng nhập)** | Axios interceptor tự động gọi POST /auth/refresh với refresh_token → Nhận token mới → Retry request gốc |

---

### UC-03: Quản lý ví tiền

| Trường | Nội dung |
|--------|---------|
| **Mã Use Case** | UC-03 |
| **Tên** | Quản lý ví tiền |
| **Actor chính** | Người dùng |
| **Mục tiêu** | Tạo, xem, cập nhật, đóng ví tiền để theo dõi số dư từng tài khoản |
| **Tiền điều kiện** | Người dùng đã đăng nhập |
| **Hậu điều kiện** | Ví tiền được tạo/cập nhật/đóng trong database |

**Luồng chính — Tạo ví mới:**

```
1. Người dùng vào trang /wallets → chọn "Thêm ví mới"
2. Hệ thống hiển thị form: tên ví, loại ví (cash/bank/credit/e_wallet/asset),
   số dư ban đầu, đơn vị tiền tệ
3. Đối với thẻ tín dụng: hiển thị thêm trường "Hạn mức tín dụng"
4. Người dùng điền thông tin → nhấn "Lưu"
5. Frontend gửi POST /api/v1/wallets
6. Backend INSERT bản ghi Wallet với user_id = current_user.user_id
7. Backend trả về WalletResponse với wallet_id mới
8. Frontend refresh danh sách ví, hiển thị toast "Tạo ví thành công"
```

**Luồng thay thế (Alternative Flow):**

| Tình huống | Xử lý |
|-----------|-------|
| **A1 — Cập nhật ví** | Bước 4: PATCH /api/v1/wallets/{wallet_id} → Backend cập nhật name, currency, credit_limit |
| **A2 — Đóng ví** | Người dùng chọn "Đóng ví" → Backend PATCH is_active = false (không xóa để giữ lịch sử giao dịch) |
| **A3 — Xóa ví** | Xóa vĩnh viễn: Backend kiểm tra không còn giao dịch liên kết → DELETE → CASCADE xóa dữ liệu phụ |
| **A4 — Tên ví rỗng** | Validation phía client: hiển thị lỗi "Tên ví không được để trống" |

---

### UC-04: Quản lý danh mục

| Trường | Nội dung |
|--------|---------|
| **Mã Use Case** | UC-04 |
| **Tên** | Quản lý danh mục thu/chi |
| **Actor chính** | Người dùng |
| **Mục tiêu** | Tạo, chỉnh sửa danh mục cá nhân để phân loại giao dịch |
| **Tiền điều kiện** | Người dùng đã đăng nhập |
| **Hậu điều kiện** | Danh mục được tạo/cập nhật/xóa; sẵn sàng để gắn vào giao dịch |

**Luồng chính:**

```
1. Người dùng vào /categories
2. Hệ thống hiển thị:
   - Danh mục hệ thống mặc định (user_id = NULL): Ăn uống, Đi lại, Giải trí...
   - Danh mục cá nhân của user (user_id = current_user.user_id)
3. Người dùng chọn "Thêm danh mục"
4. Form nhập: tên, loại (income/expense), danh mục cha (tùy chọn), icon
5. Frontend gửi POST /api/v1/categories
6. Backend INSERT Category với user_id = current_user.user_id
7. Danh mục mới xuất hiện trong danh sách
```

**Luồng thay thế (Alternative Flow):**

| Tình huống | Xử lý |
|-----------|-------|
| **A1 — Tạo danh mục con** | Bước 4: Chọn "Danh mục cha" → Frontend gửi parent_id theo cùng request |
| **A2 — Sửa danh mục cá nhân** | Người dùng click biểu tượng sửa → PATCH /api/v1/categories/{id} |
| **A3 — Xóa danh mục** | DELETE /api/v1/categories/{id} → CASCADE xóa danh mục con; Backend kiểm tra không có giao dịch liên kết |
| **A4 — Danh mục hệ thống** | Người dùng không thể xóa/sửa danh mục hệ thống (user_id = NULL); chỉ xem |

---

### UC-05: Tạo giao dịch thủ công

| Trường | Nội dung |
|--------|---------|
| **Mã Use Case** | UC-05 |
| **Tên** | Tạo giao dịch thủ công |
| **Actor chính** | Người dùng |
| **Mục tiêu** | Ghi nhận một giao dịch tài chính (thu, chi, chuyển khoản) vào hệ thống |
| **Tiền điều kiện** | Người dùng đã đăng nhập; có ít nhất 1 ví và 1 danh mục |
| **Hậu điều kiện** | Giao dịch được lưu vào DB; số dư ví liên quan được cập nhật tự động |

**Luồng chính:**

```
1. Người dùng vào /add hoặc nhấn nút "Thêm giao dịch"
2. Hệ thống hiển thị form với các trường:
   - Loại giao dịch: Thu nhập / Chi tiêu / Chuyển khoản
   - Số tiền (CurrencyInput format VND)
   - Ví thực hiện
   - Danh mục
   - Ngày giờ (mặc định = ngày hôm nay)
   - Ghi chú (tùy chọn)
   - Đính kèm ảnh (tùy chọn)
3. Người dùng điền thông tin → nhấn "Lưu giao dịch"
4. Frontend validate:
   - Số tiền > 0
   - Ví đã chọn
   - Danh mục đã chọn
5. Frontend gửi POST /api/v1/transactions
6. Backend (TransactionService.create()):
   a. Xác nhận ví thuộc về current_user
   b. Nếu loại = expense: kiểm tra wallet.balance >= amount
      (Ngoại lệ: ví credit không kiểm tra)
   c. Cập nhật wallet.balance (tăng/giảm theo loại giao dịch)
   d. INSERT Transaction record
   e. db.commit() — atomic flush
7. Backend trả về HTTP 201 + TransactionResponse
8. Frontend hiển thị toast "Giao dịch được ghi nhận thành công"
9. Frontend redirect về /transactions
```

**Luồng thay thế (Alternative Flow):**

| Tình huống | Xử lý |
|-----------|-------|
| **A1 — Số dư không đủ** | Bước 6b: Backend trả về HTTP 400 "Ví nguồn không đủ số dư để chi tiêu". Frontend hiển thị toast lỗi |
| **A2 — Chuyển khoản nội bộ** | Bước 2: Hiển thị thêm trường "Ví đích". Backend tạo 2 giao dịch: expense (ví nguồn) + income (ví đích) trong cùng transaction DB |
| **A3 — Ghi nhận giao dịch nợ** | Loại = debt_loan: Backend tạo transaction + tạo Debt record. Loại = debt_repayment: Backend tạo transaction + tạo DebtRepayment + cập nhật debt.remaining_amount |
| **A4 — Đính kèm ảnh hóa đơn** | Bước 2: Người dùng upload ảnh → Hệ thống lưu URL vào images JSON column |

---

### UC-06: Xem danh sách và lọc giao dịch

| Trường | Nội dung |
|--------|---------|
| **Mã Use Case** | UC-06 |
| **Tên** | Xem danh sách và lọc giao dịch |
| **Actor chính** | Người dùng |
| **Mục tiêu** | Duyệt, tìm kiếm và lọc lịch sử giao dịch tài chính |
| **Tiền điều kiện** | Người dùng đã đăng nhập |
| **Hậu điều kiện** | Hệ thống hiển thị danh sách giao dịch theo tiêu chí lọc |

**Luồng chính:**

```
1. Người dùng vào /transactions
2. Hệ thống gửi GET /api/v1/transactions?page=1&size=20
3. Backend trả về danh sách phân trang với tổng số bản ghi
4. Frontend hiển thị danh sách giao dịch với:
   - Tên danh mục + icon
   - Số tiền (màu xanh = thu, đỏ = chi)
   - Ví thực hiện
   - Ngày giờ
   - Ghi chú (nếu có)
5. Người dùng cuộn xuống → Frontend tự động load trang tiếp
6. Người dùng có thể áp dụng bộ lọc:
   - Theo loại (thu/chi/chuyển khoản)
   - Theo ví
   - Theo danh mục
   - Theo khoảng thời gian (start_date – end_date)
7. Frontend gửi lại GET /api/v1/transactions với query params lọc
8. Hệ thống trả về kết quả đã lọc
```

**Luồng thay thế (Alternative Flow):**

| Tình huống | Xử lý |
|-----------|-------|
| **A1 — Chưa có giao dịch** | Bước 3: Backend trả về items = [], total = 0. Frontend hiển thị empty state |
| **A2 — Lọc kết quả rỗng** | Sau lọc không có kết quả: Frontend hiển thị "Không tìm thấy giao dịch phù hợp" |
| **A3 — Lọc ngày không hợp lệ** | start_date > end_date: Backend trả về HTTP 400. Frontend hiển thị cảnh báo |

---

### UC-07: Chỉnh sửa / Xóa giao dịch

| Trường | Nội dung |
|--------|---------|
| **Mã Use Case** | UC-07 |
| **Tên** | Chỉnh sửa / Xóa giao dịch |
| **Actor chính** | Người dùng |
| **Mục tiêu** | Sửa thông tin hoặc xóa một giao dịch đã ghi nhận trước đó |
| **Tiền điều kiện** | Giao dịch tồn tại và thuộc về người dùng đang đăng nhập |
| **Hậu điều kiện** | Giao dịch được cập nhật/xóa; số dư ví được điều chỉnh bù trừ tương ứng |

**Luồng chính — Chỉnh sửa:**

```
1. Người dùng nhấn vào biểu tượng sửa trên giao dịch
2. Modal/form hiển thị thông tin giao dịch hiện tại
3. Người dùng thay đổi thông tin → nhấn "Cập nhật"
4. Frontend gửi PATCH /api/v1/transactions/{transaction_id}
5. Backend:
   a. Xác nhận giao dịch thuộc về current_user
   b. Hoàn tác tác động cũ lên ví (reverse balance)
   c. Áp dụng tác động mới lên ví
   d. UPDATE transaction record
   e. db.commit()
6. Frontend hiển thị toast "Cập nhật thành công"
```

**Luồng chính — Xóa:**

```
1. Người dùng nhấn biểu tượng xóa → Hệ thống hiển thị dialog xác nhận
2. Người dùng xác nhận "Có, xóa giao dịch"
3. Frontend gửi DELETE /api/v1/transactions/{transaction_id}
4. Backend:
   a. Xác nhận giao dịch thuộc về current_user
   b. Hoàn tác tác động lên ví (reverse balance)
   c. DELETE transaction (CASCADE: xóa debt_repayment nếu có)
5. Frontend refresh danh sách giao dịch
```

**Luồng thay thế (Alternative Flow):**

| Tình huống | Xử lý |
|-----------|-------|
| **A1 — Giao dịch không thuộc user** | Bước 5a/4a: Backend trả về HTTP 404 "Không tìm thấy giao dịch" |
| **A2 — Người dùng hủy xóa** | Bước 2: Người dùng nhấn "Hủy" → Dialog đóng, không có gì thay đổi |
| **A3 — Ví không đủ sau reverse** | Rất hiếm: Service layer xử lý bù trừ an toàn |

---

### UC-08: Smart Input bằng AI (NLP)

| Trường | Nội dung |
|--------|---------|
| **Mã Use Case** | UC-08 |
| **Tên** | Smart Input bằng AI (NLP Parsing) |
| **Actor chính** | Người dùng |
| **Actor phụ** | AI System (Google Gemini Flash 2.5) |
| **Mục tiêu** | Nhập nhiều giao dịch cùng lúc bằng câu lệnh ngôn ngữ tự nhiên tiếng Việt thay vì điền form thủ công |
| **Tiền điều kiện** | Người dùng đã đăng nhập; có ít nhất 1 ví và 1 danh mục |
| **Hậu điều kiện** | Các giao dịch được phân tích và hiển thị để người dùng xác nhận; sau xác nhận sẽ được lưu vào DB |
| **Rate limit** | 5 request/phút |

**Luồng chính:**

```
1. Người dùng vào /add → chọn tab "Nhập bằng AI"
2. Hệ thống hiển thị text input với placeholder:
   "VD: Sáng nay ăn phở 45k tiền mặt, chiều đổ xăng 80k..."
3. Người dùng gõ câu lệnh tự nhiên → nhấn "Phân tích"
4. Frontend gửi POST /api/v1/ai/parse { "text": "..." }
5. Backend AIService.parse_natural_language():
   a. Query danh sách ví của user từ PostgreSQL
   b. Query danh sách danh mục của user từ PostgreSQL
   c. Build prompt với context: câu lệnh + danh sách ví/danh mục + ngày hôm nay
   d. Gọi Gemini Flash API với prompt
   e. Parse JSON response → List[TransactionCreate]
6. Backend trả về mảng giao dịch đã phân tích
7. Frontend hiển thị preview table với các giao dịch:
   - Số tiền (đã quy đổi "50k" → 50,000)
   - Loại (thu/chi)
   - Danh mục (đã map)
   - Ví (đã map)
   - Ghi chú
8. Người dùng kiểm tra, có thể chỉnh sửa từng dòng
9. Người dùng nhấn "Xác nhận tất cả"
10. Frontend gửi POST /api/v1/transactions cho từng giao dịch
11. Hệ thống lưu giao dịch, cập nhật số dư ví
12. Frontend hiển thị toast "Đã ghi nhận N giao dịch"
```

**Luồng thay thế (Alternative Flow):**

| Tình huống | Xử lý |
|-----------|-------|
| **A1 — AI không hiểu câu lệnh** | Bước 5e: AI trả về JSON rỗng hoặc sai cấu trúc → Backend trả về HTTP 400. Frontend gợi ý "Vui lòng nhập câu rõ ràng hơn" |
| **A2 — Chưa có ví** | Bước 5a: Không có ví → Backend trả về HTTP 400 "Bạn cần tạo ít nhất 1 ví trước". Frontend redirect đến /wallets |
| **A3 — Rate limit vượt quá** | Backend trả về HTTP 429. Frontend hiển thị "Bạn đã dùng AI quá nhiều, vui lòng chờ 1 phút" |
| **A4 — AI Service tạm dừng** | Gemini API timeout/lỗi → Backend trả về HTTP 503. Frontend hiển thị "Dịch vụ AI tạm thời gián đoạn" |
| **A5 — Người dùng sửa giao dịch trước khi xác nhận** | Bước 8: Người dùng inline-edit số tiền/danh mục/ví. Bước 9: Lưu với dữ liệu đã chỉnh sửa |
| **A6 — Đa giao dịch trong một câu** | "Ăn sáng 30k, cafe 25k, xăng 50k": AI trả về mảng 3 giao dịch; mỗi giao dịch hiển thị 1 dòng trong preview |

---

### UC-09: OCR Quét hóa đơn

| Trường | Nội dung |
|--------|---------|
| **Mã Use Case** | UC-09 |
| **Tên** | OCR quét và trích xuất dữ liệu từ hóa đơn |
| **Actor chính** | Người dùng |
| **Actor phụ** | AI System (Google Gemini Flash 2.5 — Multimodal) |
| **Mục tiêu** | Chụp ảnh hóa đơn/biên lai → AI tự động trích xuất thông tin để tạo giao dịch |
| **Tiền điều kiện** | Người dùng đã đăng nhập; có file ảnh hóa đơn (JPG/PNG/WEBP) |
| **Hậu điều kiện** | Dữ liệu hóa đơn được trích xuất và pre-fill vào form tạo giao dịch |
| **Rate limit** | 3 request/phút |

**Luồng chính:**

```
1. Người dùng vào /add → chọn tab "Scan hóa đơn"
2. Hệ thống hiển thị nút upload / chụp ảnh
3. Người dùng chọn file ảnh hóa đơn (JPG/PNG/WEBP, tối đa 10MB)
4. Frontend hiển thị preview ảnh đã chọn
5. Người dùng nhấn "Trích xuất dữ liệu"
6. Frontend gửi POST /api/v1/ai/ocr với form-data (file upload)
7. Backend:
   a. Validate content_type (chỉ chấp nhận image/jpeg, image/png, image/webp)
   b. Đọc file bytes (await file.read())
   c. PIL.Image.open() để xác nhận ảnh hợp lệ
   d. Gọi Gemini Flash với prompt text + image object (multimodal)
   e. Parse JSON response:
      { merchant, total, date, items[], ocr_data }
8. Backend trả về OCR data
9. Frontend pre-fill form giao dịch:
   - Số tiền = total từ OCR
   - Ngày = date từ OCR
   - Ghi chú = merchant từ OCR
10. Người dùng kiểm tra thông tin, chỉnh sửa nếu cần
11. Người dùng điền thêm: Ví, Danh mục
12. Nhấn "Lưu giao dịch" → UC-05 Main Flow bước 5 trở đi
```

**Luồng thay thế (Alternative Flow):**

| Tình huống | Xử lý |
|-----------|-------|
| **A1 — File không phải ảnh** | Bước 7a: Backend trả về HTTP 400 "Chỉ hỗ trợ file ảnh JPG, PNG, WEBP" |
| **A2 — Ảnh mờ, không đọc được** | Bước 7d: AI không thể trích xuất → Backend trả về HTTP 400 "Vui lòng chụp lại rõ nét hơn" |
| **A3 — Hóa đơn không có giá trị tổng** | Bước 9: OCR trả về total = null. Frontend để trống trường số tiền, người dùng nhập thủ công |
| **A4 — Rate limit vượt quá** | HTTP 429, thông báo chờ 1 phút |

---

### UC-10: Smart Bulk Import từ file CSV/Excel

| Trường | Nội dung |
|--------|---------|
| **Mã Use Case** | UC-10 |
| **Tên** | Smart Bulk Import từ file CSV/Excel |
| **Actor chính** | Người dùng |
| **Mục tiêu** | Import hàng loạt giao dịch lịch sử từ file CSV hoặc Excel vào hệ thống |
| **Tiền điều kiện** | Người dùng đã đăng nhập; có file CSV/XLSX hợp lệ |
| **Hậu điều kiện** | Toàn bộ giao dịch trong file được import vào DB; ví/danh mục/nợ mới được tự động tạo nếu cần |

**Luồng chính:**

```
1. Người dùng vào /transactions → nhấn "Import File"
2. ImportModal hiển thị với hướng dẫn định dạng file
3. Người dùng upload file CSV hoặc Excel (.xlsx)
4. Frontend đọc file:
   - CSV: Papa Parse
   - Excel: SheetJS (xlsx library)
5. Frontend thực hiện Fuzzy Matching:
   a. So sánh tên cột trong file với các tên cột chuẩn đã biết
   b. "Ngày giao dịch" → date; "Số tiền" → amount; "Danh mục" → category_name
   c. Hiển thị kết quả mapping để user xác nhận
6. Người dùng kiểm tra column mapping, điều chỉnh nếu cần
7. Frontend phân tích data trong file, phát hiện:
   - Danh mục chưa tồn tại (VD: "Trà Camm") → đề xuất auto-create
   - Ví chưa tồn tại (VD: "BIDV") → đề xuất auto-create
   - Pattern nợ (VD: "Vay anh Sơn 2 triệu") → đề xuất tạo Debt contract
8. Hiển thị preview bảng dữ liệu với cảnh báo về các mục cần tạo mới
9. Người dùng xác nhận và nhấn "Import"
10. Frontend gửi POST /api/v1/transactions/bulk với danh sách giao dịch
11. Backend (TransactionService.create_bulk()):
    a. Với mỗi giao dịch:
       - wallet_id < 0 AND new_wallet_name → INSERT Wallet mới (chỉ 1 lần cho mỗi tên)
       - category_id < 0 AND new_category_name → INSERT Category mới
       - debt_name không rỗng → INSERT Debt + INSERT DebtRepayment nếu là giao dịch hoàn trả
       - INSERT Transaction
    b. db.commit() → atomic cho toàn batch
12. Backend trả về {created: N, new_wallets: [...], new_categories: [...]}
13. Frontend hiển thị "Đã import N giao dịch thành công"
```

**Luồng thay thế (Alternative Flow):**

| Tình huống | Xử lý |
|-----------|-------|
| **A1 — File sai định dạng** | Bước 4: Frontend hiển thị lỗi "Chỉ hỗ trợ file CSV hoặc XLSX" |
| **A2 — File rỗng** | Bước 5: Không có dữ liệu → Frontend hiển thị "File không có dữ liệu" |
| **A3 — Cột không map được** | Bước 5b: Fuzzy score thấp → Người dùng phải map thủ công |
| **A4 — Một giao dịch lỗi** | Bước 11: Bỏ qua giao dịch lỗi (invalid amount, missing field), commit phần còn lại |
| **A5 — Người dùng bỏ qua auto-create** | Bước 7: Người dùng deselect các item → chỉ import các giao dịch có ví/danh mục hợp lệ |

---

### UC-11: Chatbot AI Tư vấn Tài chính (RAG)

| Trường | Nội dung |
|--------|---------|
| **Mã Use Case** | UC-11 |
| **Tên** | Chatbot AI tư vấn tài chính (RAG — Retrieval-Augmented Generation) |
| **Actor chính** | Người dùng |
| **Actor phụ** | AI System (Google Gemini Flash 2.5 + Function Calling) |
| **Mục tiêu** | Hỏi đáp tài chính, nhận tư vấn thông minh và ghi nhận giao dịch qua hội thoại tự nhiên |
| **Tiền điều kiện** | Người dùng đã đăng nhập; MongoDB Atlas đang kết nối |
| **Hậu điều kiện** | Câu trả lời AI được hiển thị; lịch sử hội thoại được lưu vào MongoDB; giao dịch được tạo nếu AI Function Calling kích hoạt |

**Luồng chính — Hỏi đáp tài chính:**

```
1. Người dùng vào /ai-chat
2. Hệ thống hiển thị lịch sử hội thoại của session hiện tại
3. Người dùng gõ câu hỏi: "Tháng này tôi chi bao nhiêu tiền ăn uống?"
4. Frontend gửi POST /api/v1/ai/chat { "message": "...", "session_id": "uuid" }
5. Backend AIService.chat_rag():
   a. INSERT user message vào MongoDB chat_collection
   b. Query 20 giao dịch gần nhất của user từ PostgreSQL
   c. Query danh sách ví và danh mục từ PostgreSQL
   d. Query 6 tin nhắn gần nhất trong session từ MongoDB
   e. Build RAG prompt:
      - Role: "Bạn là IFinance, trợ lý tài chính thông minh"
      - Context: dữ liệu tài chính thực + lịch sử chat
      - Query: câu hỏi của người dùng
   f. Gọi Gemini Flash với chế độ Function Calling enabled
   g. AI phân tích → tạo câu trả lời Markdown với số liệu thực
   h. INSERT assistant response vào MongoDB
6. Backend trả về { "reply": "...", "action_type": null }
7. Frontend hiển thị câu trả lời AI với Markdown rendering
```

**Luồng thay thế A — Function Calling (Ghi nhận giao dịch qua chat):**

```
3. Người dùng nói: "Ghi cho tôi vừa ăn phở 65k ví tiền mặt"
4-5e. (Tương tự luồng chính đến bước 5e)
5f. AI nhận dạng intent = "thêm giao dịch" → trả về JSON Function Calling:
    { "action": "add_transaction",
      "data": [{"amount":65000,"transaction_type":"expense",
                "category_id":3,"wallet_id":1,"note":"Ăn phở"}],
      "reply": "Mình đã ghi nhận bạn vừa chi 65,000 đ cho Ăn uống!" }
5g. Backend parse JSON → tự động gọi transaction_service.create()
5h. INSERT transaction vào PostgreSQL + cập nhật wallet.balance
6. Backend trả về { "reply": "...", "action_type": "add_transaction",
                    "created_transactions": [...] }
7. Frontend hiển thị câu trả lời + badge "✓ Đã ghi nhận giao dịch"
```

**Luồng thay thế (Alternative Flow):**

| Tình huống | Xử lý |
|-----------|-------|
| **A1 — MongoDB không kết nối** | Bước 5: Backend trả về HTTP 503 "Chưa kết nối MongoDB". Chatbot không khả dụng |
| **A2 — Người dùng hỏi về nhiều giao dịch** | Function Calling trả về mảng data[] nhiều phần tử; Backend loop tạo từng giao dịch |
| **A3 — Session mới** | session_id tạo mới bằng UUID; lịch sử chat rỗng |
| **A4 — AI không có đủ context** | AI trả lời "Bạn chưa có giao dịch nào để phân tích" nếu PostgreSQL data rỗng |

---

### UC-12: Quản lý ngân sách

| Trường | Nội dung |
|--------|---------|
| **Mã Use Case** | UC-12 |
| **Tên** | Quản lý ngân sách |
| **Actor chính** | Người dùng |
| **Mục tiêu** | Thiết lập hạn mức chi tiêu theo danh mục và theo dõi mức độ sử dụng trong kỳ |
| **Tiền điều kiện** | Người dùng đã đăng nhập; có ít nhất 1 danh mục expense |
| **Hậu điều kiện** | Ngân sách được tạo/cập nhật; hiển thị tiến độ chi tiêu theo % |

**Luồng chính — Tạo ngân sách:**

```
1. Người dùng vào /budgets
2. Hệ thống hiển thị danh sách ngân sách hiện tại với progress bar
3. Người dùng nhấn "Thêm ngân sách"
4. Form nhập:
   - Danh mục (chỉ danh mục expense)
   - Hạn mức (amount_limit)
   - Kỳ: Hàng tuần / Hàng tháng
   - Bật/tắt Rollover (cộng dồn sang kỳ sau)
5. Người dùng nhấn "Lưu" → POST /api/v1/budgets
6. Backend budget_service.create_or_update():
   a. Nếu đã có ngân sách cho danh mục + kỳ này → UPDATE
   b. Nếu chưa có → INSERT
7. Người dùng xem tiến độ:
   - GET /api/v1/budgets/progress?period=monthly
   - Backend tính: spent = SUM(transactions.amount WHERE category + kỳ)
   - Backend trả về [{budget, spent, percent_used, remaining}]
8. Frontend hiển thị progress bar (xanh → vàng → đỏ theo %)
```

**Luồng thay thế (Alternative Flow):**

| Tình huống | Xử lý |
|-----------|-------|
| **A1 — Vượt hạn mức** | Khi percent_used > 100%: Frontend hiển thị progress bar màu đỏ, cảnh báo "Đã vượt ngân sách" |
| **A2 — Xem gợi ý AI** | GET /api/v1/budgets/recommendation?category_id=X → AI phân tích chi tiêu lịch sử → Gợi ý hạn mức hợp lý |
| **A3 — Xem xu hướng** | GET /api/v1/budgets/trend?category_id=X&months=6 → Biểu đồ chi tiêu 6 tháng |
| **A4 — Rollover** | Cuối kỳ: remaining_amount = amount_limit - spent > 0 → Cộng vào amount_limit kỳ sau |
| **A5 — Gợi ý 50-30-20** | Người dùng chọn "Dùng mẫu AI 50-30-20": POST /api/v1/ai/budget-template → AI tạo bộ ngân sách theo tỷ lệ |

---

### UC-13: Quản lý sổ nợ

| Trường | Nội dung |
|--------|---------|
| **Mã Use Case** | UC-13 |
| **Tên** | Quản lý sổ nợ (Debt Management) |
| **Actor chính** | Người dùng |
| **Mục tiêu** | Theo dõi các khoản cho vay và đi vay, ghi nhận thanh toán từng phần |
| **Tiền điều kiện** | Người dùng đã đăng nhập |
| **Hậu điều kiện** | Hợp đồng nợ được tạo; khi trả nợ, remaining_amount tự động giảm |

**Luồng chính — Tạo khoản nợ:**

```
1. Người dùng vào /debts
2. Nhấn "Thêm khoản nợ"
3. Form nhập:
   - Tên chủ nợ/con nợ
   - Tổng số tiền
   - Loại: Cho vay (receivable) / Đi vay (payable)
   - Lãi suất (tùy chọn)
   - Hạn trả (tùy chọn)
   - Hình thức: Trả một lần / Trả góp
4. POST /api/v1/debts → Backend INSERT Debt record
5. remaining_amount = total_amount (chưa trả gì)
```

**Luồng chính — Ghi nhận thanh toán:**

```
1. Người dùng chọn khoản nợ → nhấn "Ghi nhận thanh toán"
2. Form nhập: số tiền thanh toán lần này, ví thực hiện, ngày
3. POST /api/v1/debts/{debt_id}/repay
4. Backend (atomic):
   a. INSERT Transaction (type=debt_repayment, trừ ví)
   b. INSERT DebtRepayment (liên kết 1-1 với transaction)
   c. UPDATE Debt.remaining_amount -= amount
   d. db.commit()
5. Frontend cập nhật progress bar khoản nợ
```

**Luồng thay thế (Alternative Flow):**

| Tình huống | Xử lý |
|-----------|-------|
| **A1 — Khoản nợ đã trả hết** | remaining_amount = 0 → Frontend hiển thị badge "Đã thanh toán" |
| **A2 — Thanh toán vượt số dư** | Bước 4a: Service kiểm tra wallet.balance → HTTP 400 nếu không đủ |
| **A3 — Trả góp nhiều lần** | is_installment = true: Mỗi lần trả tạo 1 DebtRepayment mới; lịch sử trả góp hiển thị timeline |
| **A4 — Auto-create từ Bulk Import** | Trong UC-10: Hệ thống nhận diện "Vay anh Sơn" → tự động INSERT Debt |

---

### UC-14: Quản lý danh mục đầu tư

| Trường | Nội dung |
|--------|---------|
| **Mã Use Case** | UC-14 |
| **Tên** | Quản lý danh mục đầu tư |
| **Actor chính** | Người dùng |
| **Mục tiêu** | Theo dõi danh mục đầu tư, cập nhật giá thị trường, tính ROI |
| **Tiền điều kiện** | Người dùng đã đăng nhập; có ít nhất 1 ví |
| **Hậu điều kiện** | Khoản đầu tư được ghi nhận; ROI và lãi/lỗ được tính toán |

**Luồng chính:**

```
1. Người dùng vào /investments
2. Nhấn "Thêm khoản đầu tư"
3. Form nhập:
   - Tên tài sản (VD: "VNM", "Bitcoin", "Vàng SJC 1 chỉ")
   - Loại: stock / gold / crypto / savings_deposit / real_estate
   - Số lượng (NUMERIC(20,8) — hỗ trợ crypto thập phân)
   - Vốn đầu tư ban đầu (principal_amount)
   - Ví nguồn vốn
   - Ngày bắt đầu
4. POST /api/v1/investments → Backend INSERT Investment
5. Hệ thống tính ROI = (current_value - principal_amount) / principal_amount × 100%
```

**Luồng — Cập nhật giá thị trường:**

```
1. Người dùng nhấn "Cập nhật giá" trên khoản đầu tư
2. Nếu loại = stock: Backend gọi vnstock API lấy giá cổ phiếu VN thời gian thực
3. Nếu loại = crypto: Backend gọi CoinGecko API
4. PATCH /api/v1/investments/{id}/value { "current_value": price × quantity }
5. Frontend cập nhật hiển thị PnL và ROI
```

**Luồng thay thế (Alternative Flow):**

| Tình huống | Xử lý |
|-----------|-------|
| **A1 — vnstock API lỗi** | Backend trả về lỗi 503; Frontend cho phép nhập giá thủ công |
| **A2 — Bán khoản đầu tư** | POST /api/v1/investments/{id}/sell: tạo giao dịch investment_return + cộng ví |
| **A3 — Ghi nhận thu nhập thụ động** | POST /api/v1/investments/{id}/passive-income: cộng total_passive_income + tạo giao dịch income |

---

### UC-15: Quản lý chi tiêu định kỳ

| Trường | Nội dung |
|--------|---------|
| **Mã Use Case** | UC-15 |
| **Tên** | Quản lý chi tiêu định kỳ (Subscriptions) |
| **Actor chính** | Người dùng |
| **Mục tiêu** | Đăng ký các gói định kỳ để hệ thống tự động trừ tiền theo lịch |
| **Tiền điều kiện** | Người dùng đã đăng nhập |
| **Hậu điều kiện** | Gói định kỳ được tạo; APScheduler sẽ tự động xử lý vào ngày đến hạn |

**Luồng chính:**

```
1. Người dùng vào /subs → nhấn "Thêm gói định kỳ"
2. Form nhập:
   - Tên gói (VD: "Netflix", "Gym tháng", "Điện thoại")
   - Số tiền mỗi kỳ
   - Tần suất: Hàng ngày / Hàng tuần / Hàng tháng / Hàng năm
   - Ví mặc định để trừ tiền
   - Danh mục
   - Ngày đến hạn tiếp theo (next_due_date)
3. POST /api/v1/subscriptions → INSERT Subscription
4. Hệ thống hiển thị gói với countdown đến ngày đến hạn
5. Khi đến hạn (00:01 mỗi ngày), UC-17 tự động xử lý
```

**Luồng thay thế (Alternative Flow):**

| Tình huống | Xử lý |
|-----------|-------|
| **A1 — Tạm dừng gói** | PATCH /subscriptions/{id}: is_active = false → APScheduler bỏ qua gói này |
| **A2 — Thay đổi ví thanh toán** | PATCH /subscriptions/{id}: default_wallet_id = new_wallet_id |
| **A3 — Xóa gói** | DELETE /subscriptions/{id}: gói bị xóa, không xử lý nữa |

---

### UC-16: Xem Dashboard & Thống kê

| Trường | Nội dung |
|--------|---------|
| **Mã Use Case** | UC-16 |
| **Tên** | Xem Dashboard & Thống kê |
| **Actor chính** | Người dùng |
| **Mục tiêu** | Nắm bắt tổng quan tài chính qua biểu đồ và số liệu trực quan |
| **Tiền điều kiện** | Người dùng đã đăng nhập |
| **Hậu điều kiện** | Dashboard hiển thị đầy đủ số liệu tài chính |

**Luồng chính:**

```
1. Người dùng vào / (trang chủ)
2. Frontend gửi đồng thời nhiều API call:
   a. GET /api/v1/wallets → Danh sách ví + số dư
   b. GET /api/v1/transactions?start_date=&end_date= → Giao dịch kỳ hiện tại
   c. GET /api/v1/budgets/progress?period=monthly → Tiến độ ngân sách
3. Hệ thống tổng hợp và hiển thị:
   a. Tổng tài sản ròng = SUM(wallet.balance) cho tất cả ví active
   b. Biểu đồ thu/chi theo thời gian (bar chart Recharts)
   c. Phân bổ chi tiêu theo danh mục (pie chart Recharts)
   d. Danh sách ví với số dư từng ví
   e. Tiến độ ngân sách tháng này
4. Người dùng chọn khoảng thời gian: 3 tháng / 6 tháng / 1 năm / Tùy chỉnh
5. Frontend re-fetch dữ liệu với params mới → Biểu đồ tự cập nhật
```

---

### UC-17: Tự động xử lý gói định kỳ (System Use Case)

| Trường | Nội dung |
|--------|---------|
| **Mã Use Case** | UC-17 |
| **Tên** | Tự động xử lý gói chi tiêu định kỳ |
| **Actor chính** | Background System (APScheduler) |
| **Mục tiêu** | Tự động tạo giao dịch chi tiêu cho các gói đến hạn mà không cần người dùng thao tác |
| **Tiền điều kiện** | Có subscription với next_due_date <= ngày hôm nay và is_active = true |
| **Hậu điều kiện** | Giao dịch expense được tạo; số dư ví giảm; next_due_date tăng thêm 1 kỳ |
| **Trigger** | Cron job: hàng ngày lúc 00:01 AM |

**Luồng chính:**

```
1. APScheduler kích hoạt process_due_subscriptions() lúc 00:01
2. Backend query:
   SELECT * FROM subscriptions
   WHERE next_due_date <= TODAY AND is_active = true
3. Với mỗi subscription:
   a. INSERT Transaction (type=expense, amount=sub.amount, wallet=sub.default_wallet_id)
   b. UPDATE Wallet.balance -= sub.amount
   c. Tính next_due_date mới:
      - daily: next_due_date += 1 ngày
      - weekly: next_due_date += 7 ngày
      - monthly: next_due_date += 1 tháng
      - yearly: next_due_date += 1 năm
   d. UPDATE Subscription.next_due_date = new_date
   e. db.commit() cho từng subscription
4. Lặp lại bước 2 cho đến khi không còn subscription nào đến hạn
   (Catch-up mechanism: xử lý nhiều kỳ nếu server bị downtime)
5. Ghi log kết quả vào console
```

**Luồng thay thế (Alternative Flow):**

| Tình huống | Xử lý |
|-----------|-------|
| **A1 — Ví không đủ số dư** | Bước 3b: Số dư âm → ghi nhận vẫn tạo giao dịch (báo cáo âm); ghi log cảnh báo |
| **A2 — Server downtime nhiều ngày** | Vòng lặp bước 4 xử lý TẤT CẢ kỳ chưa được tính (catch-up), không bỏ qua |
| **A3 — Subscription bị tắt** | is_active = false → Query bước 2 không lấy về → Bỏ qua |
| **A4 — Cũng chạy lúc startup** | main.py gọi process_due_subscriptions() ngay khi khởi động server để xử lý kỳ bị bỏ lỡ |

---

## 5. SEQUENCE DIAGRAM — MÔ TẢ TEXT

---

### SD-01: AI Smart Input (NLP Transaction Parsing)

**Mục tiêu:** Mô tả tương tác giữa các thành phần khi người dùng nhập giao dịch bằng ngôn ngữ tự nhiên.

```
Actor/Thành phần tham gia:
  User        — Người dùng cuối
  Browser     — Frontend React SPA
  axiosClient — HTTP client với interceptors
  FastAPI     — Backend server
  AIService   — Module xử lý AI
  PostgreSQL  — Cơ sở dữ liệu chính
  Gemini API  — Google AI service

─────────────────────────────────────────────────────────────────────

User          Browser         axiosClient      FastAPI        AIService    PostgreSQL    Gemini API
  │               │                │               │               │             │             │
  │ Gõ câu lệnh   │                │               │               │             │             │
  │ "Ăn phở 45k"  │                │               │               │             │             │
  │──────────────►│                │               │               │             │             │
  │               │                │               │               │             │             │
  │               │ POST /ai/parse │               │               │             │             │
  │               │ {text: "..."}  │               │               │             │             │
  │               │───────────────►│               │               │             │             │
  │               │                │               │               │             │             │
  │               │                │ Attach Bearer │               │             │             │
  │               │                │ Token header  │               │             │             │
  │               │                │───────────────►               │             │             │
  │               │                │               │               │             │             │
  │               │                │               │ Decode JWT    │             │             │
  │               │                │               │ → user_id=42  │             │             │
  │               │                │               │               │             │             │
  │               │                │               │ Gọi           │             │             │
  │               │                │               │ AIService     │             │             │
  │               │                │               │──────────────►│             │             │
  │               │                │               │               │             │             │
  │               │                │               │               │ SELECT ví   │             │
  │               │                │               │               │ của user 42 │             │
  │               │                │               │               │────────────►│             │
  │               │                │               │               │◄────────────│             │
  │               │                │               │               │ [ví: cash,  │             │
  │               │                │               │               │  bank, ...]  │             │
  │               │                │               │               │             │             │
  │               │                │               │               │ SELECT      │             │
  │               │                │               │               │ danh mục    │             │
  │               │                │               │               │────────────►│             │
  │               │                │               │               │◄────────────│             │
  │               │                │               │               │ [ăn uống,   │             │
  │               │                │               │               │  đi lại, ...]│            │
  │               │                │               │               │             │             │
  │               │                │               │               │ Build prompt│             │
  │               │                │               │               │ + context   │             │
  │               │                │               │               │             │             │
  │               │                │               │               │ POST Gemini │             │
  │               │                │               │               │ generate_   │             │
  │               │                │               │               │ content()   │             │
  │               │                │               │               │────────────────────────────►
  │               │                │               │               │                            │
  │               │                │               │               │           JSON response     │
  │               │                │               │               │◄────────────────────────────
  │               │                │               │               │ {transactions:[             │
  │               │                │               │               │  {amount:45000,             │
  │               │                │               │               │   type:expense,...}]}        │
  │               │                │               │               │             │             │
  │               │                │               │ TransactionList│             │             │
  │               │                │               │◄──────────────│             │             │
  │               │                │               │               │             │             │
  │               │                │ HTTP 200      │               │             │             │
  │               │                │ {data: [...]} │               │             │             │
  │               │◄───────────────│◄──────────────│               │             │             │
  │               │                │               │               │             │             │
  │  Preview      │                │               │               │             │             │
  │  table hiện   │                │               │               │             │             │
  │◄──────────────│                │               │               │             │             │
  │               │                │               │               │             │             │
  │ Xác nhận      │                │               │               │             │             │
  │──────────────►│                │               │               │             │             │
  │               │                │               │               │             │             │
  │               │ POST /transact.│               │               │             │             │
  │               │ (với từng GD)  │               │               │             │             │
  │               │───────────────►│               │               │             │             │
  │               │                │───────────────►               │             │             │
  │               │                │               │ TransactionSvc│             │             │
  │               │                │               │ .create()     │             │             │
  │               │                │               │ kiểm tra số dư│             │             │
  │               │                │               │               │             │             │
  │               │                │               │ UPDATE wallet │             │             │
  │               │                │               │ INSERT trans. │             │             │
  │               │                │               │ db.commit()   │             │             │
  │               │                │               │──────────────────────────────►            │
  │               │                │               │◄──────────────────────────── │            │
  │               │                │               │               │  OK          │            │
  │               │                │ HTTP 201      │               │             │             │
  │               │◄───────────────│◄──────────────│               │             │             │
  │  Toast: "Đã   │                │               │               │             │             │
  │  ghi 2 giao   │                │               │               │             │             │
  │  dịch"        │                │               │               │             │             │
  │◄──────────────│                │               │               │             │             │
```

---

### SD-02: Import File Excel/CSV (Smart Bulk Import)

**Mục tiêu:** Mô tả luồng xử lý khi người dùng import file CSV/Excel với auto-create ví và danh mục mới.

```
Actor/Thành phần tham gia:
  User        — Người dùng cuối
  Browser     — Frontend React (Papa Parse / SheetJS)
  FastAPI     — Backend server
  TxService   — TransactionService.create_bulk()
  PostgreSQL  — Cơ sở dữ liệu

─────────────────────────────────────────────────────────────────────

User          Browser               FastAPI           TxService       PostgreSQL
  │               │                     │                 │               │
  │ Upload file   │                     │                 │               │
  │ CSV/Excel     │                     │                 │               │
  │──────────────►│                     │                 │               │
  │               │                     │                 │               │
  │               │ Papa Parse / SheetJS│                 │               │
  │               │ đọc file → rows[]   │                 │               │
  │               │                     │                 │               │
  │               │ Fuzzy Matching      │                 │               │
  │               │ "Ngày GD" → date    │                 │               │
  │               │ "Số tiền" → amount  │                 │               │
  │               │                     │                 │               │
  │ Xem preview   │                     │                 │               │
  │ column mapping│                     │                 │               │
  │◄──────────────│                     │                 │               │
  │               │                     │                 │               │
  │ Phát hiện:    │                     │                 │               │
  │ - "Trà Camm"  │                     │                 │               │
  │   (cat mới)   │                     │                 │               │
  │ - "BIDV" (ví  │                     │                 │               │
  │   mới)        │                     │                 │               │
  │◄──────────────│                     │                 │               │
  │               │                     │                 │               │
  │ Xác nhận      │                     │                 │               │
  │ "Import"      │                     │                 │               │
  │──────────────►│                     │                 │               │
  │               │                     │                 │               │
  │               │ POST /transactions  │                 │               │
  │               │ /bulk               │                 │               │
  │               │ [{wallet_id:-1,     │                 │               │
  │               │   new_wallet_name:  │                 │               │
  │               │   "BIDV",           │                 │               │
  │               │   category_id:-1,   │                 │               │
  │               │   new_cat_name:     │                 │               │
  │               │   "Trà Camm",...}]  │                 │               │
  │               │────────────────────►│                 │               │
  │               │                     │                 │               │
  │               │                     │ create_bulk()   │               │
  │               │                     │────────────────►│               │
  │               │                     │                 │               │
  │               │                     │                 │ wallet_cache={}│
  │               │                     │                 │               │
  │               │                     │                 │ [Giao dịch 1] │
  │               │                     │                 │ wallet_id<0   │
  │               │                     │                 │ → "BIDV" chưa │
  │               │                     │                 │   trong cache │
  │               │                     │                 │               │
  │               │                     │                 │ INSERT Wallet │
  │               │                     │                 │ (name="BIDV") │
  │               │                     │                 │──────────────►│
  │               │                     │                 │◄──────────────│
  │               │                     │                 │ wallet_id=15  │
  │               │                     │                 │               │
  │               │                     │                 │ cache["bidv"] │
  │               │                     │                 │  = 15         │
  │               │                     │                 │               │
  │               │                     │                 │ category_id<0 │
  │               │                     │                 │ → "Trà Camm"  │
  │               │                     │                 │   chưa trong  │
  │               │                     │                 │   cache       │
  │               │                     │                 │               │
  │               │                     │                 │ INSERT Cat.   │
  │               │                     │                 │ ("Trà Camm")  │
  │               │                     │                 │──────────────►│
  │               │                     │                 │◄──────────────│
  │               │                     │                 │ cat_id=22     │
  │               │                     │                 │               │
  │               │                     │                 │ INSERT Transac│
  │               │                     │                 │ wallet=15,    │
  │               │                     │                 │ category=22   │
  │               │                     │                 │──────────────►│
  │               │                     │                 │               │
  │               │                     │                 │ [Giao dịch 2] │
  │               │                     │                 │ "Vay anh Sơn" │
  │               │                     │                 │               │
  │               │                     │                 │ INSERT Debt   │
  │               │                     │                 │ (creditor=    │
  │               │                     │                 │  "Anh Sơn")   │
  │               │                     │                 │──────────────►│
  │               │                     │                 │               │
  │               │                     │                 │ INSERT Trans. │
  │               │                     │                 │ (debt_loan)   │
  │               │                     │                 │──────────────►│
  │               │                     │                 │               │
  │               │                     │                 │ INSERT Debt   │
  │               │                     │                 │ Repayment     │
  │               │                     │                 │──────────────►│
  │               │                     │                 │               │
  │               │                     │                 │ db.commit()   │
  │               │                     │                 │ (ATOMIC)      │
  │               │                     │                 │──────────────►│
  │               │                     │                 │◄──────────────│
  │               │                     │                 │    OK         │
  │               │                     │◄────────────────│               │
  │               │                     │ {created:N,     │               │
  │               │                     │  new_wallets:   │               │
  │               │                     │  ["BIDV"],      │               │
  │               │                     │  new_categories │               │
  │               │                     │  :["Trà Camm"]} │               │
  │               │◄────────────────────│                 │               │
  │               │                     │                 │               │
  │ Toast: "Đã    │                     │                 │               │
  │ import N GD   │                     │                 │               │
  │ thành công"   │                     │                 │               │
  │◄──────────────│                     │                 │               │
```

---

### SD-03: Chatbot RAG (Retrieval-Augmented Generation)

**Mục tiêu:** Mô tả luồng xử lý đầy đủ của một tin nhắn chatbot, bao gồm cả trường hợp Function Calling tự ghi giao dịch.

```
Actor/Thành phần tham gia:
  User        — Người dùng cuối
  Browser     — Frontend React (AIChat page)
  FastAPI     — Backend server
  AIService   — Module xử lý AI + RAG
  PostgreSQL  — Lấy dữ liệu tài chính thực
  MongoDB     — Lưu/đọc lịch sử chat
  Gemini API  — Google AI service (Function Calling)

─────────────────────────────────────────────────────────────────────

User       Browser        FastAPI        AIService    PostgreSQL   MongoDB    Gemini API
  │            │               │               │            │          │           │
  │ Gõ:        │               │               │            │          │           │
  │ "Ghi tôi   │               │               │            │          │           │
  │  vừa ăn    │               │               │            │          │           │
  │  phở 65k"  │               │               │            │          │           │
  │───────────►│               │               │            │          │           │
  │            │               │               │            │          │           │
  │            │ POST /ai/chat │               │            │          │           │
  │            │ {message,     │               │            │          │           │
  │            │  session_id}  │               │            │          │           │
  │            │──────────────►│               │            │          │           │
  │            │               │               │            │          │           │
  │            │               │ chat_rag()    │            │          │           │
  │            │               │──────────────►│            │          │           │
  │            │               │               │            │          │           │
  │            │               │               │ INSERT     │          │           │
  │            │               │               │ user_msg   │          │           │
  │            │               │               │──────────────────────►│           │
  │            │               │               │            │          │           │
  │            │               │               │ SELECT 20  │          │           │
  │            │               │               │ giao dịch  │          │           │
  │            │               │               │ gần nhất   │          │           │
  │            │               │               │───────────►│          │           │
  │            │               │               │◄───────────│          │           │
  │            │               │               │ tx_data    │          │           │
  │            │               │               │            │          │           │
  │            │               │               │ SELECT ví  │          │           │
  │            │               │               │ và danh mục│          │           │
  │            │               │               │───────────►│          │           │
  │            │               │               │◄───────────│          │           │
  │            │               │               │            │          │           │
  │            │               │               │ FIND 6 msg │          │           │
  │            │               │               │ gần nhất   │          │           │
  │            │               │               │ (session)  │          │           │
  │            │               │               │──────────────────────►│           │
  │            │               │               │◄──────────────────────│           │
  │            │               │               │ chat_history│          │           │
  │            │               │               │            │          │           │
  │            │               │               │ Build RAG  │          │           │
  │            │               │               │ prompt:    │          │           │
  │            │               │               │ role +     │          │           │
  │            │               │               │ tx_data +  │          │           │
  │            │               │               │ chat_hist +│          │           │
  │            │               │               │ wallets +  │          │           │
  │            │               │               │ categories │          │           │
  │            │               │               │            │          │           │
  │            │               │               │ POST Gemini│          │           │
  │            │               │               │ (Function  │          │           │
  │            │               │               │  Calling)  │          │           │
  │            │               │               │────────────────────────────────────►
  │            │               │               │                                   │
  │            │               │               │         Intent: add_transaction    │
  │            │               │               │         JSON Function Call:         │
  │            │               │               │◄────────────────────────────────────
  │            │               │               │ {action:"add_transaction",         │
  │            │               │               │  data:[{amount:65000,              │
  │            │               │               │   type:"expense",                  │
  │            │               │               │   cat_id:3, wallet_id:1,           │
  │            │               │               │   note:"Ăn phở"}],                 │
  │            │               │               │  reply:"Mình đã ghi nhận..."}      │
  │            │               │               │            │          │           │
  │            │               │               │ INSERT     │          │           │
  │            │               │               │ assistant  │          │           │
  │            │               │               │ message    │          │           │
  │            │               │               │──────────────────────►│           │
  │            │               │               │            │          │           │
  │            │               │               │ Gọi        │          │           │
  │            │               │               │ transaction│          │           │
  │            │               │               │ _service   │          │           │
  │            │               │               │ .create()  │          │           │
  │            │               │               │            │          │           │
  │            │               │               │ UPDATE ví  │          │           │
  │            │               │               │ INSERT GD  │          │           │
  │            │               │               │ db.commit()│          │           │
  │            │               │               │───────────►│          │           │
  │            │               │               │◄───────────│          │           │
  │            │               │               │    OK      │          │           │
  │            │               │◄──────────────│            │          │           │
  │            │               │ {reply:"...", │            │          │           │
  │            │               │  action_type: │            │          │           │
  │            │               │  "add_trans", │            │          │           │
  │            │               │  created:[...]}            │          │           │
  │            │◄──────────────│               │            │          │           │
  │            │               │               │            │          │           │
  │ Chat bubble│               │               │            │          │           │
  │ + badge    │               │               │            │          │           │
  │ "✓ Đã ghi  │               │               │            │          │           │
  │  nhận GD"  │               │               │            │          │           │
  │◄───────────│               │               │            │          │           │
```

---

### SD-04: Transaction Flow (Tạo giao dịch thủ công)

**Mục tiêu:** Mô tả chi tiết luồng atomic khi tạo một giao dịch, bao gồm cả trường hợp trả nợ.

```
Actor/Thành phần tham gia:
  User           — Người dùng cuối
  Browser        — Frontend React (AddTransaction page)
  axiosClient    — HTTP client
  Router         — FastAPI transaction router
  TxService      — TransactionService
  CRUDWallet     — CRUD layer cho Wallet
  CRUDCategory   — CRUD layer cho Category
  PostgreSQL     — Database

─────────────────────────────────────────────────────────────────────

User        Browser      axiosClient    Router       TxService   CRUDWallet  CRUDCat  PostgreSQL
  │             │               │            │             │           │         │           │
  │ Điền form   │               │            │             │           │         │           │
  │ + Lưu GD    │               │            │             │           │         │           │
  │────────────►│               │            │             │           │         │           │
  │             │               │            │             │           │         │           │
  │             │ POST          │            │             │           │         │           │
  │             │ /transactions │            │             │           │         │           │
  │             │──────────────►│            │             │           │         │           │
  │             │               │            │             │           │         │           │
  │             │               │ Attach JWT │            │             │         │           │
  │             │               │ Bearer hdr │            │             │         │           │
  │             │               │───────────►│             │           │         │           │
  │             │               │            │             │           │         │           │
  │             │               │            │ Pydantic    │           │         │           │
  │             │               │            │ validate    │           │         │           │
  │             │               │            │ TransCreate │           │         │           │
  │             │               │            │             │           │         │           │
  │             │               │            │ Decode JWT  │           │         │           │
  │             │               │            │ user_id=42  │           │         │           │
  │             │               │            │             │           │         │           │
  │             │               │            │ service     │           │         │           │
  │             │               │            │ .create()   │           │         │           │
  │             │               │            │────────────►│           │         │           │
  │             │               │            │             │           │         │           │
  │             │               │            │             │ get_by_   │         │           │
  │             │               │            │             │ user_id() │         │           │
  │             │               │            │             │──────────►│         │           │
  │             │               │            │             │           │ SELECT  │           │
  │             │               │            │             │           │ wallet  │           │
  │             │               │            │             │           │ WHERE   │           │
  │             │               │            │             │           │ user=42 │           │
  │             │               │            │             │           │────────────────────►│
  │             │               │            │             │           │◄────────────────────│
  │             │               │            │             │◄──────────│ wallet obj          │
  │             │               │            │             │           │         │           │
  │             │               │            │             │ get_by_id │         │           │
  │             │               │            │             │ _and_user │         │           │
  │             │               │            │             │──────────────────────►          │
  │             │               │            │             │           │  SELECT │           │
  │             │               │            │             │           │  categ. │           │
  │             │               │            │             │           │─────────────────────►
  │             │               │            │             │           │◄─────────────────────
  │             │               │            │             │◄──────────────────── │ cat obj  │
  │             │               │            │             │           │         │           │
  │             │               │            │             │ [type=expense]       │           │
  │             │               │            │             │ wallet.balance       │           │
  │             │               │            │             │ (450,000)           │           │
  │             │               │            │             │ >= amount           │           │
  │             │               │            │             │ (45,000)?           │           │
  │             │               │            │             │ YES → OK            │           │
  │             │               │            │             │           │         │           │
  │             │               │            │             │ wallet.balance       │           │
  │             │               │            │             │ -= 45,000           │           │
  │             │               │            │             │ db.add(wallet)      │           │
  │             │               │            │             │           │         │           │
  │             │               │            │             │ new_tx =  │         │           │
  │             │               │            │             │ Transaction(...)    │           │
  │             │               │            │             │ db.add(tx)│         │           │
  │             │               │            │             │           │         │           │
  │             │               │            │             │ [KHÔNG phải         │           │
  │             │               │            │             │  debt_repayment]    │           │
  │             │               │            │             │           │         │           │
  │             │               │            │             │ db.commit()         │           │
  │             │               │            │             │──────────────────────────────────►
  │             │               │            │             │◄──────────────────────────────────
  │             │               │            │             │           │         │    OK     │
  │             │               │            │             │           │         │           │
  │             │               │            │ db.refresh  │           │         │           │
  │             │               │            │ (new_tx)    │           │         │           │
  │             │               │            │◄────────────│           │         │           │
  │             │               │            │             │           │         │           │
  │             │               │            │ Pydantic    │           │         │           │
  │             │               │            │ serialize   │           │         │           │
  │             │               │            │ → JSON      │           │         │           │
  │             │               │            │             │           │         │           │
  │             │               │ HTTP 201   │             │           │         │           │
  │             │               │ {status:   │             │           │         │           │
  │             │               │  "success",│             │           │         │           │
  │             │               │  data:{...}}            │           │         │           │
  │             │◄──────────────│◄───────────│             │           │         │           │
  │             │               │            │             │           │         │           │
  │  Toast:     │               │            │             │           │         │           │
  │ "Ghi nhận   │               │            │             │           │         │           │
  │  thành công"│               │            │             │           │         │           │
  │◄────────────│               │            │             │           │         │           │

─────────────────────────────────────────────────────────────────────
[Nhánh thay thế: type = debt_repayment]

  │             │               │            │             │           │         │           │
  │             │               │            │             │ [type=debt_repayment]│           │
  │             │               │            │             │           │         │           │
  │             │               │            │             │ SELECT debt         │           │
  │             │               │            │             │ WHERE debt_id=X     │           │
  │             │               │            │             │ AND user=42         │           │
  │             │               │            │             │──────────────────────────────────►
  │             │               │            │             │◄──────────────────────────────────
  │             │               │            │             │           │         │  debt obj │
  │             │               │            │             │           │         │           │
  │             │               │            │             │ wallet.balance       │           │
  │             │               │            │             │ -= amount           │           │
  │             │               │            │             │ INSERT Transaction   │           │
  │             │               │            │             │           │         │           │
  │             │               │            │             │ debt.remaining_      │           │
  │             │               │            │             │ amount -= amount     │           │
  │             │               │            │             │           │         │           │
  │             │               │            │             │ INSERT DebtRepayment │           │
  │             │               │            │             │ (transaction_id=     │           │
  │             │               │            │             │  new_tx.id,         │           │
  │             │               │            │             │  debt_id=X)         │           │
  │             │               │            │             │           │         │           │
  │             │               │            │             │ db.commit() [ATOMIC]│           │
  │             │               │            │             │──────────────────────────────────►
```

---

### SD-05: Auto Token Refresh

**Mục tiêu:** Mô tả cơ chế tự động gia hạn JWT token khi access token hết hạn, đảm bảo trải nghiệm người dùng liền mạch.

```
Actor/Thành phần tham gia:
  Browser        — React SPA đang hoạt động
  axiosClient    — HTTP client với response interceptor
  FastAPI        — Backend server
  localStorage   — Bộ nhớ cục bộ trình duyệt

─────────────────────────────────────────────────────────────────────

Browser       axiosClient        FastAPI          localStorage
  │               │                  │                 │
  │ Thực hiện     │                  │                 │
  │ GET /transact.│                  │                 │
  │──────────────►│                  │                 │
  │               │                  │                 │
  │               │ Request Intercept│                 │
  │               │ Lấy access_token │                 │
  │               │────────────────────────────────────►
  │               │◄────────────────────────────────────
  │               │ token (ĐÃ HẾT HẠN)│               │
  │               │                  │                 │
  │               │ GET /transactions │                 │
  │               │ Authorization:    │                 │
  │               │ Bearer <expired>  │                 │
  │               │─────────────────►│                 │
  │               │                  │                 │
  │               │                  │ jwt.decode()    │
  │               │                  │ ExpiredSignature│
  │               │                  │ Error           │
  │               │                  │                 │
  │               │    HTTP 401      │                 │
  │               │◄─────────────────│                 │
  │               │                  │                 │
  │               │ Response Intercept│                 │
  │               │ status == 401?    │                 │
  │               │ _retry == false?  │                 │
  │               │ → YES → Set       │                 │
  │               │   _retry = true   │                 │
  │               │                  │                 │
  │               │ Lấy refresh_token│                 │
  │               │────────────────────────────────────►
  │               │◄────────────────────────────────────
  │               │ refresh_token    │                 │
  │               │                  │                 │
  │               │ POST /auth/refresh (raw axios)     │
  │               │ [bypass interceptor!]              │
  │               │─────────────────►│                 │
  │               │                  │                 │
  │               │                  │ Verify refresh  │
  │               │                  │ token JWT       │
  │               │                  │ type="refresh" ✓│
  │               │                  │ NOT blacklisted ✓│
  │               │                  │ user active ✓   │
  │               │                  │                 │
  │               │                  │ Tạo access_token│
  │               │                  │ mới             │
  │               │  HTTP 200        │                 │
  │               │  {access_token:  │                 │
  │               │   "NEW_TOKEN",   │                 │
  │               │   refresh_token: │                 │
  │               │   "NEW_REFRESH"} │                 │
  │               │◄─────────────────│                 │
  │               │                  │                 │
  │               │ Lưu tokens mới   │                 │
  │               │ vào localStorage │                 │
  │               │────────────────────────────────────►
  │               │                  │                 │
  │               │ Gắn NEW_TOKEN    │                 │
  │               │ vào header request│                 │
  │               │ gốc (bị fail)    │                 │
  │               │                  │                 │
  │               │ RETRY request gốc│                 │
  │               │ GET /transactions │                 │
  │               │ Authorization:   │                 │
  │               │ Bearer NEW_TOKEN │                 │
  │               │─────────────────►│                 │
  │               │                  │                 │
  │               │                  │ jwt.decode() ✓  │
  │               │                  │ Xử lý request   │
  │               │                  │                 │
  │               │    HTTP 200      │                 │
  │               │    {data: [...]} │                 │
  │               │◄─────────────────│                 │
  │               │                  │                 │
  │ Dữ liệu hiển  │                  │                 │
  │ thị bình thường│                 │                 │
  │ (User không   │                  │                 │
  │ biết gì đã    │                  │                 │
  │ xảy ra)       │                  │                 │
  │◄──────────────│                  │                 │

─────────────────────────────────────────────────────────────────────
[Nhánh thất bại: Refresh token cũng hết hạn]

  │               │                  │                 │
  │               │  HTTP 401        │                 │
  │               │◄─────────────────│                 │
  │               │                  │                 │
  │               │ Xóa access_token │                 │
  │               │ Xóa refresh_token│                 │
  │               │────────────────────────────────────►
  │               │                  │                 │
  │               │ window.location  │                 │
  │               │ .href = '/login' │                 │
  │               │                  │                 │
  │ Toast: "Phiên │                  │                 │
  │ đăng nhập hết │                  │                 │
  │ hạn, đăng nhập│                  │                 │
  │ lại"          │                  │                 │
  │◄──────────────│                  │                 │
```

---

## PHỤ LỤC: MA TRẬN USE CASE × ACTOR

| Use Case | Người dùng | AI System | Background System |
|----------|-----------|----------|------------------|
| UC-01 Đăng ký | ✓ Primary | — | — |
| UC-02 Đăng nhập | ✓ Primary | — | — |
| UC-03 Quản lý ví | ✓ Primary | — | — |
| UC-04 Quản lý danh mục | ✓ Primary | — | — |
| UC-05 Tạo giao dịch | ✓ Primary | — | — |
| UC-06 Xem & lọc GD | ✓ Primary | — | — |
| UC-07 Sửa/Xóa GD | ✓ Primary | — | — |
| UC-08 Smart Input AI | ✓ Primary | ✓ Secondary | — |
| UC-09 OCR hóa đơn | ✓ Primary | ✓ Secondary | — |
| UC-10 Bulk Import | ✓ Primary | — | — |
| UC-11 Chatbot RAG | ✓ Primary | ✓ Secondary | — |
| UC-12 Ngân sách | ✓ Primary | ✓ Secondary (gợi ý) | — |
| UC-13 Sổ nợ | ✓ Primary | — | — |
| UC-14 Đầu tư | ✓ Primary | — | — |
| UC-15 Định kỳ | ✓ Primary | — | ✓ Secondary |
| UC-16 Dashboard | ✓ Primary | — | — |
| UC-17 Auto Worker | — | — | ✓ Primary |

---

*Tài liệu Use Case Specification — IFinance v1.0*
*Ngày lập: 14/04/2026 | Tác giả: IFinance Development Team*
