# SYSTEM ARCHITECTURE DOCUMENT (SAD)
## Hệ thống Quản lý Tài chính Cá nhân IFinance

| Thông tin | Chi tiết |
|-----------|---------|
| **Phiên bản tài liệu** | v1.0 |
| **Ngày lập** | 14/04/2026 |
| **Hệ thống** | IFinance — Personal Finance Management System |
| **Kiến trúc tổng quát** | Client–Server, 3-Tier Backend, SPA Frontend |
| **Mục đích** | Chương "Thiết kế Hệ thống" trong báo cáo đồ án chuyên ngành |

---

## MỤC LỤC

1. [Tổng quan kiến trúc hệ thống](#1-tổng-quan-kiến-trúc-hệ-thống)
2. [Sơ đồ kiến trúc tổng thể](#2-sơ-đồ-kiến-trúc-tổng-thể)
3. [Mô hình kiến trúc chi tiết](#3-mô-hình-kiến-trúc-chi-tiết)
   - 3.1 Backend: Mô hình 3-Tier
   - 3.2 Frontend: React Component Architecture
4. [Mô tả từng thành phần hệ thống](#4-mô-tả-từng-thành-phần-hệ-thống)
   - 4.1 Frontend Layer
   - 4.2 Backend Layer
   - 4.3 Database Layer
   - 4.4 AI Service Layer
5. [Luồng request end-to-end](#5-luồng-request-end-to-end)
6. [Các Design Pattern sử dụng](#6-các-design-pattern-sử-dụng)
7. [Ưu điểm kiến trúc](#7-ưu-điểm-kiến-trúc)

---

## 1. TỔNG QUAN KIẾN TRÚC HỆ THỐNG

### 1.1 Triết lý thiết kế

IFinance được xây dựng trên ba nguyên tắc kiến trúc cốt lõi:

**Separation of Concerns (Phân tách mối quan tâm):** Mỗi lớp trong hệ thống chỉ chịu trách nhiệm cho một tập hợp chức năng xác định. Frontend không chứa business logic; Backend không biết đến cấu trúc HTML; CRUD layer không xử lý validation nghiệp vụ. Nguyên tắc này giúp từng lớp có thể được phát triển, kiểm thử và triển khai độc lập.

**API-First Design (Thiết kế API trước):** Backend được xây dựng như một RESTful API service thuần túy, không phụ thuộc vào bất kỳ frontend cụ thể nào. OpenAPI Specification (Swagger) được FastAPI tự động sinh ra từ Pydantic schemas, đảm bảo tài liệu luôn đồng bộ với code thực tế.

**Cloud-Native Deployment (Triển khai thuần đám mây):** Toàn bộ hệ thống được thiết kế để chạy trên hạ tầng đám mây (Vercel, Render, Supabase, MongoDB Atlas) với Docker hóa cho môi trường phát triển cục bộ, đảm bảo tính nhất quán giữa các môi trường.

### 1.2 Tổng quan các thành phần

Hệ thống IFinance bao gồm **6 thành phần kiến trúc** chính:

| Thành phần | Công nghệ | Nền tảng triển khai | Vai trò |
|-----------|-----------|---------------------|---------|
| **Frontend SPA** | React 19 + Vite | Vercel CDN | Giao diện người dùng |
| **Backend API** | FastAPI (Python) | Render.com | Business logic & REST API |
| **Primary Database** | PostgreSQL | Supabase / Neon | Dữ liệu quan hệ (ACID) |
| **Chat Database** | MongoDB Atlas | MongoDB Cloud | Lịch sử hội thoại AI (RAG) |
| **AI Service** | Google Gemini Flash 2.5 | Google Cloud | NLP, OCR, Function Calling |
| **Background Worker** | APScheduler | Embedded trong Backend | Xử lý định kỳ tự động |

### 1.3 Phong cách kiến trúc (Architectural Style)

IFinance áp dụng phong cách kiến trúc **Layered Architecture** (Kiến trúc phân tầng) kết hợp với **Client-Server Pattern**:

- **Presentation Layer**: React SPA tại Vercel — hoàn toàn độc lập, giao tiếp với backend qua HTTPS REST API
- **Application Layer**: FastAPI với mô hình 3-tier nội bộ (Router → Service → CRUD)
- **Data Layer**: PostgreSQL cho dữ liệu quan hệ + MongoDB cho dữ liệu phi quan hệ (hội thoại AI)
- **External Services**: Google Gemini AI, vnstock API, CoinGecko API, Google OAuth2

---

## 2. SƠ ĐỒ KIẾN TRÚC TỔNG THỂ

### 2.1 Production Deployment Architecture

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                         PRODUCTION ENVIRONMENT                               ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║    ┌─────────────────────────────────────┐                                   ║
║    │           CLIENT TIER               │                                   ║
║    │                                     │                                   ║
║    │   ╔═══════════════════════════╗     │                                   ║
║    │   ║  React 19 SPA (Browser)   ║     │                                   ║
║    │   ║  ─────────────────────── ║     │                                   ║
║    │   ║  • Axios HTTP Client      ║     │                                   ║
║    │   ║  • React Context (State)  ║     │                                   ║
║    │   ║  • React Router (SPA Nav) ║     │                                   ║
║    │   ║  • Tailwind CSS           ║     │                                   ║
║    │   ╚═══════════════╤═══════════╝     │                                   ║
║    │   Vercel CDN      │                 │                                   ║
║    └───────────────────┼─────────────────┘                                   ║
║                        │ HTTPS / REST API                                    ║
║                        │ JSON payload                                        ║
║                        │ Bearer JWT token                                    ║
║    ┌───────────────────┼─────────────────┐                                   ║
║    │   APPLICATION TIER│                 │                                   ║
║    │                   ▼                 │                                   ║
║    │   ╔═══════════════════════════╗     │                                   ║
║    │   ║   FastAPI Backend         ║     │                                   ║
║    │   ║  ─────────────────────── ║     │                                   ║
║    │   ║  [1] Routers (10 modules) ║     │                                   ║
║    │   ║  [2] Services (Business)  ║◄────║──── Google Gemini Flash 2.5       ║
║    │   ║  [3] CRUD (DB Access)     ║     ║     (AI: NLP/OCR/RAG/Functions)   ║
║    │   ║  [APScheduler Worker]     ║     │                                   ║
║    │   ╚═══════╤══════════╤════════╝     │                                   ║
║    │   Render  │          │              │                                   ║
║    └───────────┼──────────┼──────────────┘                                   ║
║                │          │                                                  ║
║    ┌───────────┼──────────┼──────────────┐                                   ║
║    │   DATA TIER          │              │                                   ║
║    │           ▼          ▼              │                                   ║
║    │   ╔════════════╗ ╔════════════╗     │                                   ║
║    │   ║ PostgreSQL ║ ║  MongoDB   ║     │                                   ║
║    │   ║ (Supabase) ║ ║  (Atlas)   ║     │                                   ║
║    │   ║ 10 tables  ║ ║ Chat hist. ║     │                                   ║
║    │   ║ ACID / ORM ║ ║ RAG ctx    ║     │                                   ║
║    │   ╚════════════╝ ╚════════════╝     │                                   ║
║    └──────────────────────────────────────┘                                   ║
║                                                                              ║
║    EXTERNAL APIs:  vnstock (cổ phiếu VN) │ CoinGecko (crypto) │ Google OAuth ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

### 2.2 Network Communication Flow

```
Browser
  │
  │  1. Static assets (JS/CSS/HTML) — served by Vercel CDN (global edge)
  ├──────────────────────────────────────────────────────────────────────▶ Vercel CDN
  │
  │  2. API calls — HTTPS with JWT Bearer token in Authorization header
  ├──────────────────────────────────────────────────────────────────────▶ Render.com (FastAPI)
  │                                                                              │
  │                                                          3. DB queries (TCP) │
  │                                                    ┌─────────────────────────┤
  │                                                    ▼                         │
  │                                           Supabase PostgreSQL                │
  │                                           MongoDB Atlas                      │
  │                                                                              │
  │                                          4. AI API calls (HTTPS)             │
  │                                    ┌─────────────────────────────────────────┤
  │                                    ▼
  │                           Google AI Studio (Gemini Flash 2.5)
```

---

## 3. MÔ HÌNH KIẾN TRÚC CHI TIẾT

### 3.1 Backend: Mô hình 3-Tier (Router – Service – CRUD)

Backend IFinance triển khai mô hình **3-Tier Architecture** nội bộ, phân tách rõ ràng ba lớp trách nhiệm:

#### Tổng quan phân tầng

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        BACKEND 3-TIER MODEL                              │
│                                                                         │
│  HTTP Request ──▶  Middleware (CORS, Auth, Rate Limit)                  │
│                           │                                             │
│  ┌────────────────────────▼──────────────────────────────────────────┐  │
│  │  TIER 1: ROUTER LAYER  (app/api/v1/routers/)                      │  │
│  │  ─────────────────────────────────────────────────────────────    │  │
│  │  Trách nhiệm:                                                      │  │
│  │  • Khai báo HTTP endpoint (GET/POST/PUT/PATCH/DELETE)              │  │
│  │  • Deserialize & validate request body qua Pydantic schema         │  │
│  │  • Inject dependencies: DB session, current_user (JWT decode)      │  │
│  │  • Serialize response sang JSON qua Pydantic response_model        │  │
│  │  • Ủy quyền xử lý cho Service layer                               │  │
│  │                                                                    │  │
│  │  Không được phép:                                                  │  │
│  │  • Chứa business logic (kiểm tra số dư, tính toán...)             │  │
│  │  • Trực tiếp gọi SQLAlchemy query                                  │  │
│  └────────────────────────┬──────────────────────────────────────────┘  │
│                           │ gọi service function                        │
│  ┌────────────────────────▼──────────────────────────────────────────┐  │
│  │  TIER 2: SERVICE LAYER  (app/services/)                            │  │
│  │  ─────────────────────────────────────────────────────────────    │  │
│  │  Trách nhiệm:                                                      │  │
│  │  • Toàn bộ Business Logic cốt lõi của ứng dụng                    │  │
│  │  • Kiểm tra quyền sở hữu (wallet có thuộc user không?)            │  │
│  │  • Kiểm tra điều kiện nghiệp vụ (số dư, hạn mức...)              │  │
│  │  • Tính toán phức tạp (ROI đầu tư, dư nợ, tiến độ ngân sách)     │  │
│  │  • Gọi external API (Gemini AI, vnstock, CoinGecko)               │  │
│  │  • Điều phối transaction DB (đảm bảo atomicity)                   │  │
│  │                                                                    │  │
│  │  Không được phép:                                                  │  │
│  │  • Biết đến HTTP request/response structure                        │  │
│  │  • Viết SQL/SQLAlchemy query trực tiếp                            │  │
│  └────────────────────────┬──────────────────────────────────────────┘  │
│                           │ gọi CRUD function                           │
│  ┌────────────────────────▼──────────────────────────────────────────┐  │
│  │  TIER 3: CRUD LAYER  (app/crud/)                                   │  │
│  │  ─────────────────────────────────────────────────────────────    │  │
│  │  Trách nhiệm:                                                      │  │
│  │  • Trực tiếp tương tác SQLAlchemy ORM                              │  │
│  │  • Tất cả truy vấn SELECT, INSERT, UPDATE, DELETE                  │  │
│  │  • Filter, pagination, ordering                                    │  │
│  │  • CRUDBase generic: 5 phương thức tái sử dụng cho mọi entity     │  │
│  │                                                                    │  │
│  │  Không được phép:                                                  │  │
│  │  • Chứa business logic                                             │  │
│  │  • Gọi external API                                                │  │
│  └────────────────────────┬──────────────────────────────────────────┘  │
│                           │ SQLAlchemy ORM query                        │
│                  ┌────────▼────────┐                                    │
│                  │   PostgreSQL    │                                    │
│                  └─────────────────┘                                    │
└─────────────────────────────────────────────────────────────────────────┘
```

#### CRUDBase Generic Class — Trái tim của Data Access Layer

`CRUDBase` là lớp generic dùng **Python Generics** với `TypeVar` để tái sử dụng cho tất cả 9 entity:

```python
# app/crud/base.py
class CRUDBase(Generic[ModelType, CreateSchemaType, UpdateSchemaType]):
    def __init__(self, model: Type[ModelType]):
        self.model = model

    def get(self, db: Session, id: Any) -> Optional[ModelType]:
        return db.query(self.model).get(id)

    def get_multi(self, db: Session, *, skip=0, limit=100) -> List[ModelType]:
        return db.query(self.model).offset(skip).limit(limit).all()

    def create(self, db: Session, *, obj_in: CreateSchemaType) -> ModelType:
        obj_in_data = jsonable_encoder(obj_in)
        db_obj = self.model(**obj_in_data)
        db.add(db_obj); db.commit(); db.refresh(db_obj)
        return db_obj

    def update(self, db, *, db_obj, obj_in) -> ModelType:
        update_data = obj_in.model_dump(exclude_unset=True)
        for field in update_data:
            setattr(db_obj, field, update_data[field])
        db.commit(); db.refresh(db_obj)
        return db_obj

    def remove(self, db: Session, *, id: int) -> ModelType:
        obj = db.query(self.model).get(id)
        if obj: db.delete(obj); db.commit()
        return obj
```

Mỗi CRUD module cụ thể kế thừa `CRUDBase` và chỉ thêm các query đặc thù:

```python
# Ví dụ: crud_transaction.py
class CRUDTransaction(CRUDBase[Transaction, TransactionCreate, TransactionUpdate]):
    def get_multi_filtered(self, db, user_id, tx_type=None, wallet_id=None, ...):
        # Query phức tạp với filter nâng cao — không viết lại CRUD cơ bản
        ...

transaction = CRUDTransaction(Transaction)  # Singleton instance
```

#### Dependency Injection — FastAPI Depends()

FastAPI sử dụng cơ chế `Depends()` để inject các dependency vào route handlers theo pattern **Inversion of Control**:

```python
# app/api/deps.py
def get_current_user(
    db: Session = Depends(get_db),           # DB session
    token: str = Depends(oauth2_scheme)       # JWT token từ header
) -> User:
    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    user_id = payload.get("sub")
    token_type = payload.get("type")

    if user_id is None or token_type != "access":
        raise HTTPException(401)

    user = db.query(User).filter(User.user_id == int(user_id)).first()
    if not user or not user.is_active:
        raise HTTPException(401 / 403)

    return user  # Inject vào route handler

# Sử dụng trong router:
@router.post("/transactions")
def create_transaction(
    tx_in: TransactionCreate,                         # Pydantic auto-validate
    db: Session = Depends(get_db),                    # DB session injected
    current_user: User = Depends(get_current_user)    # User object injected
):
    return transaction_service.create(db, tx_in, current_user.user_id)
```

#### Luồng xử lý request đầy đủ trong Backend

```
POST /api/v1/transactions
      │
      ▼ CORS Middleware: kiểm tra Origin header
      │
      ▼ Auth Middleware: OAuth2PasswordBearer extract token
      │
      ▼ Router (transaction.py):
        • Pydantic parse & validate TransactionCreate body
        • Depends(get_db) → tạo SQLAlchemy session
        • Depends(get_current_user) → decode JWT → query User
      │
      ▼ TransactionService.create():
        • crud_wallet.get_by_user_id() → kiểm tra ví thuộc user
        • crud_category.get_by_id_and_user() → kiểm tra danh mục hợp lệ
        • Kiểm tra wallet.balance >= amount (nếu expense)
        • Cập nhật wallet.balance (db.add, chưa commit)
        • INSERT Transaction record (db.add, chưa commit)
        • Nếu type = debt_repayment: cập nhật debt.remaining_amount
        • db.commit() → atomic flush toàn bộ thay đổi
      │
      ▼ Router: serialize kết quả với response_model=TransactionResponse
      │
      ▼ HTTP 201 Created + JSON body
```

### 3.2 Frontend: React Component Architecture

#### Cấu trúc phân tầng Frontend

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       FRONTEND ARCHITECTURE                              │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  ROUTING LAYER (App.jsx + React Router v6)                       │   │
│  │  • BrowserRouter bao toàn bộ ứng dụng                            │   │
│  │  • Routes khai báo URL ↔ Component mapping                       │   │
│  │  • MainLayout wrapper cho các route yêu cầu auth                 │   │
│  │  • TitleUpdater: cập nhật document.title theo route              │   │
│  └─────────────────────────┬───────────────────────────────────────┘   │
│                            │                                           │
│  ┌─────────────────────────▼───────────────────────────────────────┐   │
│  │  CONTEXT LAYER (React Context API)                               │   │
│  │                                                                  │   │
│  │  ┌─────────────────────────┐  ┌──────────────────────────────┐  │   │
│  │  │     UserContext          │  │       TutorialContext         │  │   │
│  │  │  ────────────────────   │  │  ─────────────────────────   │  │   │
│  │  │  • user (object/null)   │  │  • run (boolean)             │  │   │
│  │  │  • isLoading (bool)     │  │  • stepIndex (int)           │  │   │
│  │  │  • fetchUser()          │  │  • steps (array)             │  │   │
│  │  │  • updatePreferences()  │  │  • Lazy-loaded Joyride       │  │   │
│  │  │  • clearUser()          │  │  • Desktop/Mobile steps      │  │   │
│  │  │  • Cross-tab sync       │  │  • Resize listener           │  │   │
│  │  └─────────────────────────┘  └──────────────────────────────┘  │   │
│  └─────────────────────────┬───────────────────────────────────────┘   │
│                            │                                           │
│  ┌─────────────────────────▼───────────────────────────────────────┐   │
│  │  PAGE LAYER  (src/pages/)                                        │   │
│  │  • 13 màn hình chức năng (mỗi màn = 1 React component)          │   │
│  │  • Gọi axiosClient để fetch/mutate data                         │   │
│  │  • Local state quản lý UI (form, modal, filter...)               │   │
│  │  • Sử dụng Recharts cho data visualization                       │   │
│  └─────────────────────────┬───────────────────────────────────────┘   │
│                            │                                           │
│  ┌─────────────────────────▼───────────────────────────────────────┐   │
│  │  COMPONENT LAYER  (src/components/)                              │   │
│  │  • Reusable UI: Sidebar, BottomNav, CurrencyInput, ImportModal  │   │
│  │  • Layout components: responsive Desktop/Mobile                  │   │
│  │  • Không giữ global state, nhận data qua props                  │   │
│  └─────────────────────────┬───────────────────────────────────────┘   │
│                            │                                           │
│  ┌─────────────────────────▼───────────────────────────────────────┐   │
│  │  API LAYER  (src/api/axiosClient.js)                             │   │
│  │  • Axios instance với baseURL từ env variable                    │   │
│  │  • Request interceptor: auto-attach JWT token                    │   │
│  │  • Response interceptor: unwrap data, handle 401, toast errors  │   │
│  │  • Auto-refresh token logic với _retry flag                      │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Cây Route và Component Hierarchy

```
<BrowserRouter>
  <TitleUpdater />
  <Toaster />                          ← Global toast notifications

  <Route path="/login"  → <Login />
  <Route path="/register" → <Register />

  <Route → <MainLayout>                ← Protected: yêu cầu auth
    <UserProvider>                     ← Inject user state
      <TutorialProvider>               ← Inject tutorial state
        <Sidebar />                    ← Desktop navigation
        <BottomNav />                  ← Mobile navigation
        <DesktopHeader />              ← "Thêm giao dịch" button

        <Route "/"           → <Dashboard />
        <Route "/transactions" → <TransactionsList />
        <Route "/add"        → <AddTransaction />
        <Route "/wallets"    → <Wallets />
        <Route "/categories" → <Categories />
        <Route "/budgets"    → <Budgets />
        <Route "/debts"      → <Debts />
        <Route "/investments" → <Investments />
        <Route "/subs"       → <Subscriptions />
        <Route "/ai-chat"    → <AIChat />
        <Route "/profile"    → <Profile />
      </TutorialProvider>
    </UserProvider>
  </MainLayout>
</BrowserRouter>
```

#### Axios Interceptor — Cơ chế Auto Token Refresh

```
Request Interceptor:
  ┌──────────────────────────────────────────────────────┐
  │  axiosClient.interceptors.request.use(config => {    │
  │    const token = localStorage.getItem('access_token')│
  │    if (token) config.headers.Authorization =         │
  │      `Bearer ${token}`                               │
  │    return config                                     │
  │  })                                                  │
  └──────────────────────────────────────────────────────┘

Response Interceptor (401 handling):
  ┌──────────────────────────────────────────────────────┐
  │  Nhận response 401 Unauthorized                      │
  │       │                                              │
  │       ▼ Chưa retry lần nào (_retry = false)?         │
  │  YES: Đánh dấu _retry = true                        │
  │       │                                              │
  │       ▼ Có refresh_token trong localStorage?         │
  │  YES: POST /auth/refresh (axios thuần, bypass        │
  │       interceptor để tránh vòng lặp vô tận)         │
  │       │                                              │
  │       ▼ Refresh thành công?                          │
  │  YES: Lưu access_token mới → Retry request gốc      │
  │  NO:  Xóa tokens → Redirect /login + toast error    │
  └──────────────────────────────────────────────────────┘
```

---

## 4. MÔ TẢ TỪNG THÀNH PHẦN HỆ THỐNG

### 4.1 Frontend Layer

#### 4.1.1 Tổng quan

Frontend IFinance là một **Single Page Application (SPA)** được xây dựng bằng React 19 và đóng gói bằng Vite. Ứng dụng giao tiếp với Backend hoàn toàn qua REST API, không có bất kỳ server-side rendering nào.

#### 4.1.2 Quản lý trạng thái (State Management)

IFinance sử dụng **React Context API** thay vì Redux hay Zustand, phù hợp với quy mô ứng dụng vừa và tránh over-engineering:

| Context | State quản lý | Phạm vi |
|---------|--------------|---------|
| `UserContext` | `user`, `isLoading`, `fetchUser()`, `updatePreferences()`, `clearUser()` | Toàn bộ MainLayout |
| `TutorialContext` | `run`, `stepIndex`, `steps`, `startTutorial()`, `stopTutorial()` | Toàn bộ MainLayout |

**Thiết kế đặc biệt của `UserContext`:**

```
fetchUser() flow:
  1. Kiểm tra access_token trong localStorage
  2. Nếu không có → setIsLoading(false), return (guest mode)
  3. GET /users/me với JWT token
  4. Nhận userData từ axiosClient (interceptor đã unwrap)
  5. Recovery check: nếu localStorage tutorial_seen = 'true'
     nhưng server has_seen_tutorial = false → silent re-sync
  6. setUser(userData) → TutorialContext auto-detect
  7. Cross-tab logout detection qua window.storage event

updatePreferences() flow (Optimistic Update + Exponential Backoff):
  1. Immediately update local state (không chờ server)
  2. Lưu tutorial_seen_[userId] vào localStorage (tường lửa offline)
  3. Retry API call tối đa 3 lần:
     - Lần 1: delay 500ms
     - Lần 2: delay 1000ms
     - Lần 3: delay 2000ms
  4. Abort nếu user logout mid-retry (abortRetryRef)
```

#### 4.1.3 Các màn hình chính

| Trang | Route | Chức năng chính |
|-------|-------|----------------|
| Dashboard | `/` | Tổng tài sản ròng, biểu đồ thu/chi, phân bổ danh mục |
| Transactions | `/transactions` | Danh sách có phân trang, filter đa chiều, import CSV |
| AddTransaction | `/add` | Form tạo GD: nhập tay / AI Smart Input / OCR ảnh |
| Wallets | `/wallets` | CRUD ví tiền, 5 loại ví, cập nhật số dư |
| Categories | `/categories` | Danh mục phân cấp cha–con |
| Budgets | `/budgets` | Ngân sách theo kỳ, progress bar, gợi ý 50-30-20 |
| Debts | `/debts` | Sổ nợ, trả góp, timeline hoàn trả |
| Investments | `/investments` | Portfolio đầu tư, PnL, giá thời gian thực |
| Subscriptions | `/subs` | Gói định kỳ, trạng thái, ngày đến hạn |
| AIChat | `/ai-chat` | Chatbot RAG, lịch sử hội thoại, function calling UI |
| Profile | `/profile` | Hồ sơ, đổi mật khẩu, reset tutorial |

#### 4.1.4 Hệ thống Tutorial (react-joyride v3)

Tutorial là một tính năng kỹ thuật đáng chú ý với nhiều thiết kế tinh tế:

```
Luồng khởi động Tutorial:
  UserContext.fetchUser() → setUser(userData)
       │
       ▼ TutorialContext useEffect phát hiện:
         user != null AND user.has_seen_tutorial == false
       │
       ▼ waitForElement('.tour-sidebar') polling (250ms interval)
         — đảm bảo DOM element tồn tại trước khi highlight
       │
       ▼ run = true, stepIndex = 0
       │
       ▼ react-joyride render overlay
         — Lazy loaded: chỉ import() khi cần
         — Device detection: window.innerWidth >= 1024 → desktopSteps
         — Resize listener: tự chuyển bộ steps khi resize

Điều khiển step (Controlled Mode):
  stepIndex managed bởi consumer (TutorialContext)
  onEvent callback:
    • action='next' → stepIndex += 1
    • action='prev' → stepIndex -= 1
    • action='skip' / type='tour:end' → stopTutorial() + sync server
```

### 4.2 Backend Layer

#### 4.2.1 FastAPI Application Server

FastAPI được khởi động với cơ chế **Lifespan Context Manager** (thay thế `on_event` deprecated):

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── STARTUP ──────────────────────────────────────────────
    scheduler.start()          # Khởi động APScheduler
    process_due_subscriptions() # Catch-up: xử lý kỳ đã bỏ lỡ khi downtime

    yield  # ← Ứng dụng phục vụ request ở đây

    # ── SHUTDOWN ─────────────────────────────────────────────
    scheduler.shutdown()       # Dừng gracefully khi Ctrl+C
```

#### 4.2.2 Các Router Module (10 modules)

| Router | Prefix | Số endpoint chính | Chức năng |
|--------|--------|------------------|-----------|
| `auth.py` | `/api/v1/auth` | 6 | Register, login, refresh, logout, Google OAuth |
| `wallet.py` | `/api/v1/wallets` | 5 | CRUD ví, tổng tài sản ròng |
| `category.py` | `/api/v1/categories` | 5 | CRUD danh mục phân cấp |
| `transaction.py` | `/api/v1/transactions` | 7 | CRUD GD, chuyển khoản, bulk import |
| `debt.py` | `/api/v1/debts` | 6 | CRUD nợ, trả góp |
| `budget.py` | `/api/v1/budgets` | 5 | CRUD ngân sách, tiến độ |
| `investment.py` | `/api/v1/investments` | 7 | CRUD đầu tư, cập nhật giá, bán, thu nhập thụ động |
| `subscription.py` | `/api/v1/subscriptions` | 5 | CRUD gói định kỳ |
| `ai.py` | `/api/v1/ai` | 4 | NLP parse, OCR, chatbot, budget template |
| `user.py` | `/api/v1/users` | 4 | Profile, đổi mật khẩu, preferences |

#### 4.2.3 Security Module

**JWT Token Architecture:**

```
Access Token (HS256, 60 phút):
  payload = {
    "sub": str(user_id),    # Subject — ID người dùng
    "type": "access",        # Phân biệt với refresh token
    "exp": datetime + 60min  # Expiry timestamp
  }
  → Ký bằng SECRET_KEY (từ .env)

Refresh Token (HS256, 7 ngày):
  payload = {
    "sub": str(user_id),
    "type": "refresh",       # type check ngăn dùng nhầm access token
    "exp": datetime + 7days
  }

Logout Blacklist:
  INSERT INTO token_blacklist (token, blacklisted_on)
  → Mọi request: kiểm tra token NOT IN blacklist
  → Đảm bảo token bị thu hồi ngay lập tức dù chưa hết hạn
```

**Password Hashing (Bcrypt):**

```python
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Lúc đăng ký: không bao giờ lưu plaintext
password_hash = pwd_context.hash(plain_password)

# Lúc đăng nhập: so sánh hash
is_valid = pwd_context.verify(plain_password, stored_hash)
```

#### 4.2.4 APScheduler Background Worker

```python
# Định nghĩa job tại thời điểm khởi tạo module
scheduler = BackgroundScheduler()
scheduler.add_job(
    process_due_subscriptions,
    'cron',          # Kiểu trigger: cron expression
    hour=0,
    minute=1         # Chạy lúc 00:01 mỗi ngày
)

# process_due_subscriptions():
#   while True:
#     subscriptions = SELECT WHERE next_due_date <= TODAY AND is_active
#     if not subscriptions: break
#     for sub in subscriptions:
#       CREATE transaction (expense type)
#       UPDATE wallet.balance -= sub.amount
#       UPDATE sub.next_due_date += frequency
#   → Vòng lặp xử lý nhiều kỳ nếu server downtime nhiều ngày
```

### 4.3 Database Layer

#### 4.3.1 PostgreSQL — Primary Relational Database

**Kết nối qua SQLAlchemy ORM:**

```python
# app/db/database.py
engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db          # Inject vào route handler
    finally:
        db.close()        # Luôn đóng session dù có exception
```

**Session per Request Pattern:** Mỗi HTTP request nhận một SQLAlchemy session độc lập, đảm bảo không xảy ra race condition giữa các request đồng thời.

**Schema Design Highlights:**

```
Danh mục phân cấp (Self-Referential):
  categories.parent_id → categories.category_id
  → Cho phép tạo cấu trúc cây không giới hạn độ sâu
  → Danh mục gốc có parent_id = NULL

Cascade Delete:
  users → [wallets, categories, transactions, debts,
           investments, subscriptions, budgets]
  → Xóa user → xóa toàn bộ dữ liệu tài chính liên quan

1-to-1 Transaction ↔ DebtRepayment:
  debt_repayments.transaction_id UNIQUE FK → transactions
  → Mỗi giao dịch trả nợ chỉ gạch đúng 1 khoản nợ cụ thể
```

**Alembic Migration:**

```bash
# Tạo migration mới khi thay đổi schema
alembic revision --autogenerate -m "add has_seen_tutorial to users"

# Áp dụng migration
alembic upgrade head

# Rollback 1 bước
alembic downgrade -1
```

#### 4.3.2 MongoDB Atlas — Chat History Database

**Lý do sử dụng MongoDB cho Chat History:**

| Tiêu chí | PostgreSQL | MongoDB |
|---------|-----------|---------|
| Schema linh hoạt | Cần migration mỗi thay đổi | Schema-free, thêm field tùy ý |
| Đọc theo session_id | JOIN phức tạp | `find({session_id: X})` đơn giản |
| Lưu trữ nested data | Cần serialize | Native BSON document |
| Scale chat history | Vertical scale | Horizontal sharding dễ dàng |

**Document Structure:**

```json
{
    "_id": ObjectId("..."),
    "session_id": "uuid-string",
    "user_id": 42,
    "sender": "user" | "assistant",
    "text": "Tháng này tôi chi bao nhiêu?",
    "timestamp": ISODate("2026-04-14T10:30:00Z")
}
```

**RAG Context Query:**

```python
# Lấy 6 tin nhắn gần nhất trong session để build context
recent_chat = chat_collection.find(
    {"session_id": session_id, "user_id": user_id}
).sort("timestamp", -1).limit(6)
```

### 4.4 AI Service Layer

#### 4.4.1 Tổng quan tích hợp AI

IFinance tích hợp **Google Gemini Flash 2.5** — mô hình multimodal nhanh, chi phí thấp — cho 4 chức năng AI:

| Chức năng | Input | Output | Kỹ thuật |
|-----------|-------|--------|---------|
| Smart Input (NLP) | Text tự nhiên tiếng Việt | JSON array giao dịch | Zero-shot prompting + JSON schema |
| OCR Hóa đơn | Ảnh biên lai (bytes) | JSON thông tin hóa đơn | Multimodal (text + image) |
| Chatbot RAG | Lịch sử chat + dữ liệu tài chính | Text tư vấn | RAG + Function Calling |
| Budget Planning | Thông tin thu nhập | Template ngân sách | Structured prompting |

#### 4.4.2 Smart Input — NLP Transaction Parsing

```
Prompt Engineering Strategy:
┌─────────────────────────────────────────────────────────────┐
│ System context:                                              │
│   - Vai trò: "trợ lý tài chính cá nhân thông minh"         │
│   - Task: "bóc tách TẤT CẢ giao dịch, trả về JSON"         │
│                                                             │
│ User context (dynamic injection):                           │
│   - Câu văn của người dùng                                  │
│   - Danh sách Wallet IDs + tên của user (từ DB)             │
│   - Danh sách Category IDs + tên + type của user (từ DB)    │
│   - Ngày hiện tại (để resolve "hôm nay", "sáng nay"...)     │
│                                                             │
│ Rules & constraints:                                        │
│   - Quy đổi "50k" → 50000, "1 củ" → 1000000               │
│   - Xác định transaction_type: expense/income               │
│   - Map category_id từ danh sách context                   │
│   - Fallback wallet_id = danh sách ví đầu tiên             │
│                                                             │
│ Output format (strict JSON schema enforcement):             │
│   {"transactions": [{amount, type, category_id,            │
│                       wallet_id, note, date}, ...]}         │
└─────────────────────────────────────────────────────────────┘

Post-processing:
  response.text → strip markdown code fences (```json...```)
                → json.loads()
                → validate structure
                → return List[TransactionCreate]
```

#### 4.4.3 OCR Receipt — Multimodal Processing

```
Flow:
  1. Frontend: upload ảnh → File bytes
  2. POST /ai/ocr với form-data (image file)
  3. Backend:
     a. PIL.Image.open(BytesIO(file_bytes)) → validate ảnh hợp lệ
     b. Gemini model.generate_content([prompt_text, img])
        → multimodal: text prompt + image object cùng 1 call
     c. Parse JSON response: merchant, total, date, items[]
  4. Return OCR data để pre-fill AddTransaction form
```

#### 4.4.4 Chatbot RAG — Retrieval-Augmented Generation

```
RAG Architecture:
┌─────────────────────────────────────────────────────────────┐
│  RETRIEVAL phase:                                            │
│  ┌─────────────────────┐    ┌──────────────────────────┐   │
│  │  PostgreSQL          │    │  MongoDB                 │   │
│  │  • 20 GD gần nhất   │    │  • 6 tin nhắn gần nhất  │   │
│  │  • Wallets của user  │    │    trong session         │   │
│  │  • Categories        │    └──────────────────────────┘   │
│  └──────────┬──────────┘              │                     │
│             └──────────────┬──────────┘                     │
│                            │ Build context string            │
│                            ▼                                │
│  AUGMENTATION phase:                                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Prompt = System role                                │   │
│  │         + Dữ liệu tài chính thực (PostgreSQL)       │   │
│  │         + Lịch sử hội thoại (MongoDB)               │   │
│  │         + Câu hỏi hiện tại của user                  │   │
│  └──────────────────────┬──────────────────────────────┘   │
│                         │                                   │
│  GENERATION phase:       ▼                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Gemini Flash (Function Calling mode)                │   │
│  │  • Trả lời câu hỏi với số liệu thực                 │   │
│  │  • Hoặc gọi tool "create_transaction" để ghi GD     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  POST-GENERATION:                                           │
│  • INSERT assistant message vào MongoDB                     │
│  • Return response text cho Frontend                        │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. LUỒNG REQUEST END-TO-END

### 5.1 Luồng đăng nhập và thiết lập session

```
[User] nhập email + password → click "Đăng nhập"
          │
          ▼ React: POST /api/v1/auth/login
          │        { username, password }
          │
          ▼ Backend Router (auth.py):
          │   Pydantic validate LoginRequest
          │
          ▼ AuthService.login():
          │   SELECT user WHERE email = username
          │   Bcrypt.verify(password, user.password_hash) → True
          │   create_access_token(user.user_id) → JWT (60min)
          │   create_refresh_token(user.user_id) → JWT (7d)
          │
          ▼ Response: { access_token, refresh_token, token_type }
          │
          ▼ Frontend:
          │   localStorage.setItem('access_token', ...)
          │   localStorage.setItem('refresh_token', ...)
          │   navigate('/') → React Router render MainLayout
          │
          ▼ UserProvider.fetchUser():
          │   GET /api/v1/users/me (với token mới)
          │   setUser(userData) → user state populated
          │
          ▼ TutorialProvider useEffect:
              user.has_seen_tutorial === false → start tutorial
```

### 5.2 Luồng tạo giao dịch với AI Smart Input

```
[User] gõ: "Sáng nay ăn phở 45k, uống cafe 30k ví tiền mặt"
          │
          ▼ React: POST /api/v1/ai/parse
          │        { "text": "Sáng nay ăn phở 45k..." }
          │        Authorization: Bearer <access_token>
          │
          ▼ Request Interceptor: tự đính kèm JWT header
          │
          ▼ Backend deps.get_current_user():
          │   Decode JWT → user_id = 42
          │   SELECT User WHERE user_id = 42 → ok
          │
          ▼ AIService.parse_natural_language():
          │   Query wallets của user_id=42
          │   Query categories của user_id=42 + system categories
          │   Build prompt với context (wallets, categories, ngày hôm nay)
          │   genai.GenerativeModel("gemini-2.5-flash").generate_content(prompt)
          │   Nhận: {"transactions": [
          │       {"amount":45000,"transaction_type":"expense",
          │        "category_id":3,"wallet_id":1,"note":"Ăn phở","date":"2026-04-14"},
          │       {"amount":30000,"transaction_type":"expense",
          │        "category_id":5,"wallet_id":1,"note":"Uống cafe","date":"2026-04-14"}
          │   ]}
          │
          ▼ Response → Frontend hiển thị preview
          │
          ▼ [User] click "Xác nhận"
          │
          ▼ React: POST /api/v1/transactions (lần lượt hoặc bulk)
          │
          ▼ TransactionService.create() × 2:
          │   Kiểm tra wallet.balance >= 45000 → ok
          │   UPDATE wallet.balance -= 45000
          │   INSERT transaction (ăn phở)
          │   db.commit() → atomic
          │
          ▼ Response: TransactionResponse × 2
          │
          ▼ Frontend: toast success + refresh transaction list
```

### 5.3 Luồng Auto Refresh Token

```
[Frontend] gọi GET /api/v1/transactions
          │
          ▼ Request Interceptor đính kèm access_token (đã hết hạn)
          │
          ▼ Backend: jwt.decode() → ExpiredSignatureError
             Return HTTP 401 Unauthorized
          │
          ▼ Response Interceptor phát hiện 401:
          │   originalRequest._retry = true (đánh dấu tránh loop)
          │
          ▼ axios.post('/auth/refresh', {refresh_token}) [axios thuần]
          │   → Không qua interceptor → tránh vòng lặp vô tận
          │
          ▼ Backend xác nhận refresh_token:
          │   Decode JWT → type = "refresh" ✓
          │   NOT IN token_blacklist ✓
          │   User still active ✓
          │   Return { new_access_token, new_refresh_token }
          │
          ▼ Frontend:
          │   localStorage.setItem('access_token', new_token)
          │   originalRequest.headers.Authorization = `Bearer ${new_token}`
          │   axiosClient(originalRequest) → retry thành công
          │
          ▼ [User] không biết gì đã xảy ra — trải nghiệm liền mạch
```

### 5.4 Luồng Smart Bulk Import

```
[User] upload file transactions.csv
          │
          ▼ Frontend: Papa Parse đọc CSV → array of rows
          │
          ▼ Fuzzy Matching: so sánh tên cột CSV với known headers
          │   "Ngày giao dịch" → date
          │   "Số tiền" → amount
          │   "Danh mục" → category_name
          │   "Ghi chú" → note
          │
          ▼ Frontend phát hiện:
          │   - Danh mục "Trà Camm" chưa tồn tại → flag new_category
          │   - Ví "BIDV" chưa tồn tại → flag new_wallet_name
          │   - "Vay anh Sơn 2tr" → flag debt_name
          │
          ▼ Frontend hiển thị preview + auto-create confirmations
          │
          ▼ POST /api/v1/transactions/bulk [{...tx_list, new_wallet_name, ...}]
          │
          ▼ TransactionService.create_bulk():
          │   wallet_cache = {} (tránh tạo trùng ví trong cùng batch)
          │   For each tx_in:
          │     IF tx_in.wallet_id < 0 AND new_wallet_name:
          │       if w_key not in wallet_cache:
          │         INSERT Wallet(name=new_wallet_name) → new wallet_id
          │         wallet_cache[w_key] = new_wallet_id
          │     IF tx_in.category_id < 0 AND new_category_name:
          │       if c_key not in category_cache:
          │         INSERT Category(name=new_category_name)
          │         category_cache[c_key] = new_cat_id
          │     IF tx_in.debt_name:
          │       debt = INSERT Debt(creditor_name=debt_name, ...)
          │       INSERT DebtRepayment linking to transaction
          │     INSERT Transaction
          │   db.commit() → atomic toàn batch
          │
          ▼ Response: {created: N, new_wallets: [...], new_categories: [...]}
```

---

## 6. CÁC DESIGN PATTERN SỬ DỤNG

### 6.1 Repository Pattern (biến thể CRUD Layer)

**Mô tả:** Tách biệt logic truy cập dữ liệu khỏi business logic. Mỗi entity có một CRUD object đóng vai trò Repository.

**Triển khai:**

```python
# Mỗi CRUD object là một singleton instance
from app.crud.crud_transaction import transaction as crud_transaction
from app.crud.crud_wallet import wallet as crud_wallet

# Service sử dụng repository không biết đến SQLAlchemy query bên trong
class TransactionService:
    def create(self, db, tx_in, user_id):
        wallet = crud_wallet.get_by_user_id(db, user_id, tx_in.wallet_id)
        # ...
        new_tx = Transaction(...)
        db.add(new_tx)
        db.commit()
```

**Lợi ích:** Dễ mock trong unit test; thay đổi database engine không ảnh hưởng service layer.

### 6.2 Template Method Pattern (CRUDBase)

**Mô tả:** `CRUDBase` định nghĩa "khung" (template) với 5 phương thức chuẩn. Các subclass kế thừa và chỉ override/thêm các method đặc thù.

```python
# CRUDBase: template với 5 phương thức chuẩn
class CRUDBase(Generic[ModelType, CreateSchemaType, UpdateSchemaType]):
    def get(...)      # Template method
    def get_multi(...)# Template method
    def create(...)   # Template method
    def update(...)   # Template method
    def remove(...)   # Template method

# CRUDTransaction: kế thừa + mở rộng
class CRUDTransaction(CRUDBase[Transaction, ...]):
    def get_multi_filtered(self, db, user_id, tx_type=None, ...):
        # Method bổ sung đặc thù — giữ nguyên 5 methods của base
        ...
```

### 6.3 Dependency Injection Pattern (FastAPI Depends)

**Mô tả:** FastAPI sử dụng IoC Container nội bộ để inject các dependency (DB session, current user) vào route handlers thay vì hardcode.

```python
# Dependency được khai báo một lần, tái sử dụng ở mọi endpoint
@router.get("/transactions")
def list_transactions(
    db: Session = Depends(get_db),              # DI: DB session
    current_user: User = Depends(get_current_user),  # DI: authenticated user
    page: int = 1,
    size: int = 20
):
    return service.get_paginated(db, current_user.user_id, page, size)
```

**Lợi ích:** Dễ test bằng cách override dependency; single source of truth cho auth logic.

### 6.4 Interceptor Pattern (Axios)

**Mô tả:** Axios interceptors hoạt động như Middleware cho HTTP client — can thiệp vào mọi request/response mà không cần sửa từng API call riêng lẻ.

```
Mọi request → [Request Interceptor: attach JWT] → Backend
Backend → [Response Interceptor: handle 401, unwrap data, toast error] → Component
```

**Lợi ích:** Cross-cutting concern (auth, error handling) tập trung một chỗ; code component sạch, chỉ lo logic nghiệp vụ.

### 6.5 Observer Pattern (React Context + useEffect)

**Mô tả:** `TutorialContext` "quan sát" sự thay đổi của `user` state từ `UserContext`. Khi `user` thay đổi từ `null` → `{has_seen_tutorial: false}`, TutorialContext tự động trigger tutorial.

```javascript
// TutorialContext.jsx
useEffect(() => {
    if (user && !user.has_seen_tutorial && !run) {
        // "Observe" user state change → auto-start tutorial
        waitForElement('.tour-sidebar').then(() => {
            setRun(true);
        });
    }
}, [user]); // Dependency array = danh sách "observable"
```

### 6.6 Strategy Pattern (Transaction Type Handling)

**Mô tả:** `TransactionService.create()` áp dụng strategy khác nhau tùy theo `transaction_type` — expense trừ ví, income cộng ví, transfer chuyển giữa ví, debt_repayment cập nhật dư nợ.

```python
def create(self, db, tx_in, user_id):
    # ...
    if tx_in.transaction_type == TransactionType.expense:
        wallet.balance -= tx_in.amount     # Strategy: expense
    elif tx_in.transaction_type == TransactionType.income:
        wallet.balance += tx_in.amount     # Strategy: income
    # debt_repayment strategy: cập nhật debt.remaining_amount
    # transfer strategy: trừ ví nguồn, cộng ví đích
```

### 6.7 Optimistic Update Pattern (UserContext.updatePreferences)

**Mô tả:** Cập nhật UI ngay lập tức trước khi server xác nhận, đồng bộ ngầm với retry.

```
1. User kết thúc tutorial
2. setUser({...user, has_seen_tutorial: true})  ← Ngay lập tức
3. localStorage.setItem('tutorial_seen_42', 'true')  ← Backup offline
4. PATCH /users/me/preferences {has_seen_tutorial: true}  ← Async, retry 3×
5. Nếu fail: state đã optimistic update, localStorage backup đảm bảo
   tutorial không hiện lại lần sau
```

### 6.8 Factory Pattern (Token Creation)

```python
# security.py — factory tạo token với type khác nhau
def create_access_token(subject, expires_delta=None) -> str:
    to_encode = {"sub": str(subject), "type": "access", "exp": ...}
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def create_refresh_token(subject, expires_delta=None) -> str:
    to_encode = {"sub": str(subject), "type": "refresh", "exp": ...}
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
```

---

## 7. ƯU ĐIỂM KIẾN TRÚC

### 7.1 Khả năng kiểm thử (Testability)

Mô hình 3-Tier cho phép test từng lớp hoàn toàn độc lập:

```
Unit Test Strategy:
  ┌─────────────────────────────────────────────────────────┐
  │  Test Target: Service Layer (Business Logic)             │
  │                                                         │
  │  Database: sqlite:///:memory:                           │
  │  • Tạo mới mỗi test case                               │
  │  • Không cần kết nối PostgreSQL thật                   │
  │  • Nhanh (< 5 giây cho toàn bộ suite)                  │
  │                                                         │
  │  AI API: Mock hoàn toàn                                 │
  │  • patch('app.services.ai_service.genai')               │
  │  • Không phát sinh chi phí Gemini API                  │
  │  • Test deterministic (không phụ thuộc network)         │
  │                                                         │
  │  Router Layer: Tested via FastAPI TestClient            │
  │  CRUD Layer: Tested implicitly qua service tests        │
  └─────────────────────────────────────────────────────────┘
```

### 7.2 Khả năng mở rộng (Scalability)

| Chiều mở rộng | Cơ chế |
|--------------|--------|
| **Thêm module mới** | Tạo router/service/crud/model/schema mới, đăng ký 1 dòng trong main.py |
| **Scale Frontend** | Vercel CDN tự động scale theo traffic — zero configuration |
| **Scale Backend** | Stateless FastAPI → horizontal scale (nhiều instance) dễ dàng |
| **Scale Database** | Supabase/Neon hỗ trợ read replicas; MongoDB Atlas auto-shard |
| **Thêm AI model** | Thay `self.primary_model_name` trong AIService — không ảnh hưởng router |

### 7.3 Tính bảo trì (Maintainability)

- **Rõ ràng trách nhiệm**: Router không biết SQL; Service không biết HTTP; CRUD không biết business — mỗi lớp có thể đọc/hiểu độc lập
- **Pydantic schemas**: Input/output typing rõ ràng, lỗi validation hiển thị chi tiết, tự sinh OpenAPI docs
- **Alembic**: Mọi thay đổi DB schema đều có lịch sử, rollback được, không manual SQL
- **Generic CRUDBase**: Thêm entity mới chỉ cần 3 dòng kế thừa, không viết lại CRUD cơ bản

### 7.4 Tính bảo mật (Security)

- **Defense in Depth**: Nhiều lớp bảo vệ độc lập (HTTPS + JWT + Bcrypt + Blacklist + Rate Limit)
- **Stateless Authentication**: JWT không lưu session server-side — scale horizontally không cần session store
- **Token Type Separation**: `"type": "access"` vs `"type": "refresh"` trong JWT payload — ngăn dùng nhầm refresh token để truy cập API
- **Zero Trust**: Mọi request đều phải xác thực lại, kể cả refresh token cũng được blacklist check

### 7.5 Trải nghiệm Developer (Developer Experience)

- **Hot Module Replacement**: Vite HMR cập nhật UI tức thì khi sửa code, không reload trang
- **Auto-generated API Docs**: FastAPI Swagger UI tại `/docs` — test endpoint ngay trên browser
- **Docker Compose**: Toàn bộ stack (FE + BE + DB) khởi động bằng 1 lệnh
- **Type Safety end-to-end**: Pydantic (BE) + TypeScript-compatible JSDoc (FE) giảm runtime errors

### 7.6 Hiệu năng (Performance)

| Khía cạnh | Giải pháp |
|-----------|----------|
| **API latency** | FastAPI async, SQLAlchemy connection pool |
| **Frontend load** | Vite code-splitting, lazy import cho react-joyride |
| **AI response** | Gemini Flash (nhanh hơn Pro ~3×), context window tối ưu |
| **DB queries** | Pagination mọi list endpoint, indexed columns (email, username, token) |
| **Token refresh** | Client-side auto-refresh tránh re-login, giảm UX friction |

---

## PHỤ LỤC A: TECHNOLOGY DECISION LOG

| Quyết định | Lựa chọn | Thay thế được xem xét | Lý do quyết định |
|-----------|----------|----------------------|-----------------|
| Backend framework | FastAPI | Django REST, Flask | Async native, Pydantic tích hợp, auto docs |
| Frontend framework | React 19 | Vue 3, Next.js | SPA thuần, không cần SSR, Vite DX |
| Primary DB | PostgreSQL | MySQL | JSON columns, DECIMAL precision, self-ref FK |
| Chat DB | MongoDB | Redis, PostgreSQL JSONB | Schema-free, horizontal scale, native arrays |
| AI Model | Gemini Flash 2.5 | GPT-4o-mini, Claude Haiku | Function Calling, chi phí thấp, tốc độ cao |
| Auth | JWT HS256 | Session-based, OAuth-only | Stateless, mobile-compatible, standard |
| Job Scheduler | APScheduler | Celery + Redis, cron system | Zero infrastructure overhead, embedded |
| CSS | Tailwind CSS | Bootstrap, styled-components | Utility-first, responsive built-in, no bloat |

---

## PHỤ LỤC B: API ENDPOINT MATRIX

| Module | GET (List) | GET (Detail) | POST (Create) | PUT/PATCH | DELETE |
|--------|-----------|-------------|--------------|----------|--------|
| Auth | — | — | /register, /login, /refresh, /google | — | /logout |
| Wallets | /wallets | /wallets/{id} | /wallets | PATCH /wallets/{id} | DELETE /wallets/{id} |
| Categories | /categories | — | /categories | — | DELETE /categories/{id} |
| Transactions | /transactions | — | /transactions, /transactions/bulk | PATCH /transactions/{id} | DELETE /transactions/{id} |
| Debts | /debts | /debts/{id} | /debts, /debts/{id}/repay | — | DELETE /debts/{id} |
| Budgets | /budgets | — | /budgets | — | DELETE /budgets/{id} |
| Investments | /investments | — | /investments | PATCH /investments/{id}/value | DELETE /investments/{id} |
| Subscriptions | /subscriptions | — | /subscriptions | PATCH /subscriptions/{id} | DELETE /subscriptions/{id} |
| AI | — | — | /ai/parse, /ai/ocr, /ai/chat, /ai/budget-template | — | — |
| Users | — | /users/me | — | PATCH /users/me, /users/me/preferences | — |

---

*Tài liệu System Architecture Document — IFinance v1.0*
*Ngày lập: 14/04/2026 | Tác giả: IFinance Development Team*
