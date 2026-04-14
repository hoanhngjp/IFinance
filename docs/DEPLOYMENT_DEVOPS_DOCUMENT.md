# DEPLOYMENT & DEVOPS DOCUMENT
## Hướng dẫn Triển khai và Vận hành — Hệ thống IFinance

**Phiên bản tài liệu:** 1.0  
**Ngày cập nhật:** 2026-04-14  
**Môi trường Production:** Vercel + Render + Supabase/Neon + MongoDB Atlas  
**Môi trường Development:** Docker Compose (all-in-one local)

---

## Mục lục

1. [Tổng quan kiến trúc triển khai](#1-tổng-quan-kiến-trúc-triển-khai)
2. [Triển khai Frontend — Vercel](#2-triển-khai-frontend--vercel)
3. [Triển khai Backend — Render](#3-triển-khai-backend--render)
4. [Cơ sở dữ liệu Cloud](#4-cơ-sở-dữ-liệu-cloud)
5. [Biến môi trường (Environment Variables)](#5-biến-môi-trường-environment-variables)
6. [Docker — Môi trường Local Development](#6-docker--môi-trường-local-development)
7. [Đề xuất CI/CD Pipeline](#7-đề-xuất-cicd-pipeline)
8. [Cấu hình CORS và Bảo mật](#8-cấu-hình-cors-và-bảo-mật)
9. [Monitoring và Vận hành](#9-monitoring-và-vận-hành)
10. [Ưu điểm kiến trúc triển khai](#10-ưu-điểm-kiến-trúc-triển-khai)

---

## 1. Tổng quan kiến trúc triển khai

### 1.1 Hai môi trường song song

IFinance vận hành hai môi trường triển khai với chiến lược hoàn toàn khác nhau:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PRODUCTION ENVIRONMENT                               │
│                     (Cloud-native, Serverless-first)                         │
│                                                                             │
│  ┌──────────────┐    HTTPS     ┌──────────────┐    TCP/SSL   ┌───────────┐  │
│  │   Vercel     │ ──────────▶ │    Render    │ ──────────▶ │ Supabase/ │  │
│  │  (Frontend)  │             │  (Backend)   │             │   Neon    │  │
│  │  React SPA   │             │  FastAPI +   │             │ PostgreSQL │  │
│  │  CDN Global  │             │  APScheduler │             └───────────┘  │
│  └──────────────┘             └──────┬───────┘                            │
│                                      │ TCP/SSL   ┌──────────────────────┐  │
│                                      └─────────▶ │   MongoDB Atlas      │  │
│                                                  │   (Chat History)     │  │
│                                                  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                     LOCAL DEVELOPMENT ENVIRONMENT                            │
│                        (Docker Compose, All-in-one)                          │
│                                                                             │
│  ┌──────────────┐    HTTP      ┌──────────────┐    Bridge   ┌───────────┐  │
│  │   Frontend   │ ──────────▶ │   Backend    │ ─────────▶ │ postgres  │  │
│  │  Nginx:80    │             │  FastAPI:8000│  Network   │ container │  │
│  │  Port: 5173  │             │              │             └───────────┘  │
│  └──────────────┘             └──────────────┘    Bridge   ┌───────────┐  │
│                                                  ─────────▶ │  mongodb  │  │
│                                                  Network   │ container │  │
│                                                             └───────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Lựa chọn nền tảng theo tier

| Tier | Production | Local Dev | Lý do tách biệt |
|------|-----------|-----------|-----------------|
| **Frontend** | Vercel | Docker + Nginx | Vercel CDN edge network, zero-config deploy |
| **Backend** | Render | Docker + uvicorn | Render free tier đủ cho prototype |
| **PostgreSQL** | Supabase / Neon | Docker postgres:15 | Managed DB, backup tự động |
| **MongoDB** | MongoDB Atlas | Docker mongo:6.0 | Atlas free tier (512MB) đủ cho chat |

---

## 2. Triển khai Frontend — Vercel

### 2.1 Tổng quan

Frontend IFinance là một **React SPA (Single Page Application)** được build bởi Vite, triển khai lên Vercel — nền tảng chuyên biệt cho Static Site / SSR với **CDN edge network toàn cầu**.

**Production URL:** `https://i-finance-eosin.vercel.app`

### 2.2 Quy trình build

Vite build React thành static assets:

```bash
# Lệnh build (định nghĩa trong package.json)
npm run build
# → Tương đương: vite build

# Output: thư mục dist/
# dist/
# ├── index.html          ← Entry point duy nhất (SPA)
# ├── assets/
# │   ├── index-[hash].js  ← Bundle JS (React + thư viện)
# │   └── index-[hash].css ← Bundle CSS (Tailwind)
# └── ...static files
```

**Tech stack Frontend:**

| Thư viện | Phiên bản | Vai trò |
|----------|-----------|---------|
| React | 19.2.4 | UI Framework |
| Vite | 8.0.1 | Build tool, dev server |
| Tailwind CSS | 4.2.2 | Utility-first CSS |
| React Router DOM | 7.13.2 | Client-side routing |
| Axios | 1.13.6 | HTTP client + interceptors |
| Recharts | 3.8.1 | Biểu đồ tài chính |
| react-joyride | 3.0.2 | Tutorial onboarding |
| papaparse | 5.5.3 | CSV parsing (Bulk Import) |
| xlsx | 0.18.5 | Excel parsing (Bulk Import) |

### 2.3 Cấu hình Vercel

Vercel tự động detect dự án Vite. Cấu hình minimal trong `vercel.json` (nếu cần):

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

> **Lý do cần rewrite rule:** React Router dùng HTML5 History API — khi user truy cập `/transactions` trực tiếp, Vercel phải serve `index.html` thay vì 404.

### 2.4 Kết nối Backend từ Frontend

Frontend giao tiếp với Render backend qua Axios:

```javascript
// frontend/src/api/axiosClient.js
const axiosClient = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1',
    // Production: VITE_API_BASE_URL = https://ifinance-backend.onrender.com/api/v1
});
```

**Environment variable Vercel:**

| Biến | Giá trị |
|------|---------|
| `VITE_API_BASE_URL` | `https://ifinance-backend.onrender.com/api/v1` |

### 2.5 Luồng deploy lên Vercel

```
Push code lên GitHub (branch: main)
        │
        ▼
Vercel webhook trigger
        │
        ▼
Vercel runner: npm install
        │
        ▼
Vercel runner: npm run build (vite build)
        │
        ▼
Upload dist/ → Vercel CDN Edge Network
        │
        ▼
Propagate đến ~100 edge locations toàn cầu
        │
        ▼
Live tại: https://i-finance-eosin.vercel.app (~30-90 giây)
```

---

## 3. Triển khai Backend — Render

### 3.1 Tổng quan

Backend FastAPI chạy trên **Render** — nền tảng PaaS hỗ trợ deploy Docker container hoặc Python app trực tiếp từ GitHub.

### 3.2 Cấu hình Render Service

**Render `render.yaml`** (khuyến nghị thêm vào repo):

```yaml
services:
  - type: web
    name: ifinance-backend
    env: python
    buildCommand: pip install -r requirements.txt
    startCommand: alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT
    envVars:
      - key: DATABASE_URL
        sync: false          # Điền thủ công trong Render dashboard
      - key: MONGO_URI
        sync: false
      - key: GEMINI_API_KEY
        sync: false
      - key: SECRET_KEY
        sync: false
      - key: ALGORITHM
        value: HS256
      - key: ACCESS_TOKEN_EXPIRE_MINUTES
        value: 1440
    healthCheckPath: /
```

### 3.3 Startup Command chi tiết

```bash
# Lệnh Render chạy khi deploy
alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT
#       ↑                         ↑
# Chạy migration DB trước       Start ASGI server
# (tự động tạo/update schema)   $PORT do Render inject
```

**Thứ tự khởi động đầy đủ:**

```
Render pull code từ GitHub
        │
        ▼
pip install -r requirements.txt
        │
        ▼
alembic upgrade head               ← Migrate schema PostgreSQL
        │
        ▼
uvicorn app.main:app start
        │
        ├── APScheduler.start()    ← Background worker bắt đầu
        ├── process_due_subscriptions()  ← Chạy ngay 1 lần lúc startup
        └── FastAPI ready → nhận request
```

### 3.4 Lifespan Management

```python
# backend/app/main.py
@asynccontextmanager
async def lifespan(app: FastAPI):
    # STARTUP
    scheduler.start()
    process_due_subscriptions()     # Chạy ngay để xử lý các subscription bị bỏ lỡ
    
    yield   # ← App chạy ở đây
    
    # SHUTDOWN (graceful)
    scheduler.shutdown()            # Dừng APScheduler sạch, không kill job đang chạy

# APScheduler: Chạy lúc 00:01 mỗi ngày
scheduler.add_job(process_due_subscriptions, 'cron', hour=0, minute=1)
```

### 3.5 API Documentation

Sau khi deploy, Swagger UI tự động có tại:
```
https://ifinance-backend.onrender.com/docs
```

---

## 4. Cơ sở dữ liệu Cloud

### 4.1 PostgreSQL — Supabase / Neon

IFinance hỗ trợ hai lựa chọn managed PostgreSQL:

| Tiêu chí | Supabase | Neon |
|----------|----------|------|
| **Free tier** | 500MB, 2 projects | 512MB, branching |
| **Connection** | Pooling (PgBouncer) | Serverless driver |
| **Standout** | Built-in Auth, Storage | Branch DB cho dev/test |
| **Phù hợp** | Production + dashboard | Developer workflow |

**Connection string format:**

```bash
# Supabase
DATABASE_URL=postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres

# Neon
DATABASE_URL=postgresql://[user]:[password]@[endpoint].neon.tech/[dbname]?sslmode=require
```

**Alembic cấu hình:**

```ini
# backend/alembic.ini
[alembic]
script_location = alembic

# Đọc DATABASE_URL từ environment (không hardcode)
sqlalchemy.url = %(DATABASE_URL)s
```

**Chú ý SSL với cloud PostgreSQL:**

```python
# backend/app/db/database.py — thêm ssl_require nếu cần
connect_args = {"sslmode": "require"} if "neon.tech" in DATABASE_URL else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)
```

### 4.2 MongoDB Atlas

MongoDB Atlas cung cấp cluster M0 (free tier, 512MB) đủ cho lưu trữ lịch sử chat AI.

```python
# backend/app/db/mongodb.py
MONGO_URI = os.getenv("MONGO_URI")
# Format: mongodb+srv://[user]:[password]@[cluster].mongodb.net/

client = MongoClient(MONGO_URI)
mongodb = client["ifinance_db"]
chat_collection = mongodb["chat_history"]
```

**Cấu trúc Atlas cluster:**

```
Atlas Cluster (M0 Free)
└── Database: ifinance_db
    └── Collection: chat_history
        ├── Index: { session_id: 1, user_id: 1 }   ← Query filter
        └── Index: { timestamp: -1 }                ← Sort order
```

**Graceful degradation:**

```python
try:
    client = MongoClient(MONGO_URI)
    chat_collection = mongodb["chat_history"]
    print("✅ Đã kết nối thành công tới MongoDB Atlas!")
except Exception as e:
    print(f"❌ Lỗi kết nối MongoDB: {e}")
    chat_collection = None   # ← App vẫn chạy, chỉ mất tính năng chatbot
```

Nếu MongoDB Atlas không kết nối được (mạng, credential), toàn bộ hệ thống vẫn hoạt động bình thường — chỉ endpoint `/ai/chat` trả về HTTP 503.

---

## 5. Biến môi trường (Environment Variables)

### 5.1 Backend — Danh sách đầy đủ

| Biến | Bắt buộc | Ví dụ giá trị | Mô tả |
|------|---------|---------------|-------|
| `DATABASE_URL` | ✅ | `postgresql://user:pass@host:5432/db` | Connection string PostgreSQL |
| `MONGO_URI` | ✅ | `mongodb+srv://user:pass@cluster.mongodb.net/` | Connection string MongoDB |
| `SECRET_KEY` | ✅ | `a-very-long-random-string-256bit` | Khóa ký JWT (giữ bí mật tuyệt đối) |
| `GEMINI_API_KEY` | ✅ | `AIzaSy...` | Google AI Studio API Key |
| `ALGORITHM` | ✅ | `HS256` | Thuật toán ký JWT |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | ✅ | `1440` | TTL access token (phút) — mặc định 24h |
| `MONGO_DB_NAME` | ❌ | `ifinance_db` | Tên MongoDB database (mặc định: ifinance_db) |
| `VNSTOCKS_API_KEY` | ❌ | `vna_...` | API Key vnstock cho giá cổ phiếu |

### 5.2 Frontend — Biến Vite

| Biến | Bắt buộc | Ví dụ giá trị | Mô tả |
|------|---------|---------------|-------|
| `VITE_API_BASE_URL` | ❌ | `https://ifinance-backend.onrender.com/api/v1` | Base URL của backend API |

> **Lưu ý Vite:** Chỉ các biến có prefix `VITE_` mới được expose ra browser bundle. Không bao giờ đặt secret key hay credential vào biến `VITE_`.

### 5.3 File `.env` cho Local Development

**`backend/.env`** (không commit vào git):

```env
# Database
DATABASE_URL=postgresql://admin:password123@localhost:5432/ifinance
MONGO_URI=mongodb://localhost:27017/
MONGO_DB_NAME=ifinance_db

# Security
SECRET_KEY=dev_secret_key_only_for_local_not_production_change_me
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# AI
GEMINI_API_KEY=your_google_gemini_api_key_here

# Optional
VNSTOCKS_API_KEY=your_vnstocks_key_here
```

**`.env` ở thư mục gốc** (dùng cho Docker Compose):

```env
# Chỉ các biến SECRET không muốn hardcode trong docker-compose.yml
GEMINI_API_KEY=your_google_gemini_api_key_here
SECRET_KEY=your_super_secret_production_key_here
```

**`.gitignore` — đảm bảo không commit credential:**

```gitignore
# Environment files
.env
.env.local
.env.production
backend/.env
*.env

# Python
__pycache__/
.venv/
*.pyc
```

### 5.4 Cách sinh SECRET_KEY an toàn

```bash
# Python — sinh 32 bytes random hex
python -c "import secrets; print(secrets.token_hex(32))"
# Output: a3f8b2c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0

# OpenSSL
openssl rand -hex 32
```

> **Yêu cầu bảo mật:** SECRET_KEY production phải tối thiểu 256-bit entropy (64 hex chars). Không bao giờ dùng giá trị mặc định như `"secret"` hay `"change_me"` trên môi trường production.

---

## 6. Docker — Môi trường Local Development

### 6.1 Backend Dockerfile

```dockerfile
# backend/Dockerfile

# Base image: Python 3.12 slim (không có GUI, không có pip debug tools)
FROM python:3.12-slim

WORKDIR /app

# Cài dependencies hệ thống cho psycopg2 (PostgreSQL adapter)
# libpq-dev: PostgreSQL client library headers
# gcc: Compile C extensions
# rm -rf /var/lib/apt/lists/*: Xóa apt cache → giảm image size
RUN apt-get update && apt-get install -y libpq-dev gcc && rm -rf /var/lib/apt/lists/*

# Tách riêng COPY requirements trước để tận dụng Docker layer cache
# Layer này chỉ rebuild khi requirements.txt thay đổi (không phải mỗi lần code thay đổi)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code (layer này rebuild thường xuyên hơn)
COPY . .

EXPOSE 8000

# Lệnh mặc định — docker-compose override bằng 'command' để thêm alembic
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Kỹ thuật tối ưu Dockerfile:**

| Kỹ thuật | Mô tả |
|----------|-------|
| `python:3.12-slim` | Image nhẹ (~150MB) thay vì `python:3.12` (~900MB) |
| COPY requirements trước | Layer caching — `pip install` không chạy lại khi chỉ sửa code |
| `--no-cache-dir` | Không lưu pip cache vào image → giảm size |
| `rm -rf /var/lib/apt/lists/*` | Xóa apt cache ngay trong cùng RUN → không tạo layer thừa |

### 6.2 Frontend Dockerfile — Multi-stage Build

```dockerfile
# frontend/Dockerfile

# ══════════════════════════════════════
# STAGE 1: Build (Node.js 20 Alpine)
# ══════════════════════════════════════
FROM node:20-alpine as build
WORKDIR /app

# Layer cache: chỉ npm install lại khi package.json thay đổi
COPY package*.json ./
RUN npm install

# Copy source và build
COPY . .
RUN npm run build
# → Output: /app/dist/ (static HTML/JS/CSS)

# ══════════════════════════════════════
# STAGE 2: Serve (Nginx Alpine)
# ══════════════════════════════════════
FROM nginx:alpine

# Chỉ copy artifact từ Stage 1 — Node.js và node_modules KHÔNG có trong final image
COPY --from=build /app/dist /usr/share/nginx/html

# Custom nginx config để fix React Router (SPA routing)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

**Lợi ích Multi-stage build:**

```
Stage 1 image (build): ~500MB (Node.js + node_modules + source)
                                    ↓ Chỉ copy dist/
Stage 2 image (final): ~25MB (Nginx + static files)
```

Image production chỉ **25MB** — không chứa Node.js runtime, không chứa source code gốc, không chứa dev dependencies.

### 6.3 Nginx Configuration — SPA Fix

```nginx
# frontend/nginx.conf
server {
    listen 80;

    location / {
        root /usr/share/nginx/html;
        index index.html index.htm;
        
        # Quan trọng: try_files giải quyết vấn đề React Router
        # Khi user vào /transactions, /budgets, /debts...
        # Nginx serve index.html → React Router handle routing phía client
        try_files $uri $uri/ /index.html;
    }
}
```

Không có dòng `try_files $uri $uri/ /index.html`, Nginx sẽ trả về **404** khi user refresh trang hoặc truy cập deep link (ví dụ: `http://localhost:5173/transactions`).

### 6.4 Docker Compose — Full Stack Local

```yaml
# docker-compose.yml
version: '3.8'

services:

  # ── 1. PostgreSQL ──────────────────────────────
  postgres:
    image: postgres:15-alpine
    container_name: ifinance_postgres
    environment:
      POSTGRES_USER: admin
      POSTGRES_PASSWORD: password123
      POSTGRES_DB: ifinance
    ports:
      - "5432:5432"         # Expose ra host để có thể dùng pgAdmin/DBeaver
    volumes:
      - postgres_data:/var/lib/postgresql/data   # Persist data khi container restart
    networks:
      - ifinance_net

  # ── 2. MongoDB ─────────────────────────────────
  mongodb:
    image: mongo:6.0
    container_name: ifinance_mongodb
    ports:
      - "27017:27017"       # Expose để dùng MongoDB Compass
    volumes:
      - mongodb_data:/data/db
    networks:
      - ifinance_net

  # ── 3. Backend FastAPI ─────────────────────────
  backend:
    build: ./backend        # Build từ backend/Dockerfile
    container_name: ifinance_backend
    ports:
      - "8000:8000"
    environment:
      # Dùng tên service (postgres, mongodb) thay vì localhost
      # Docker DNS tự resolve tên service → IP container
      - DATABASE_URL=postgresql://admin:password123@postgres:5432/ifinance
      - MONGO_URI=mongodb://mongodb:27017/
      # Inject từ file .env ngoài (không hardcode secrets)
      - GEMINI_API_KEY=${GEMINI_API_KEY}
      - SECRET_KEY=${SECRET_KEY:-default_secret_key_change_me_in_production}
      - ALGORITHM=HS256
      - ACCESS_TOKEN_EXPIRE_MINUTES=1440
    depends_on:
      - postgres             # Đảm bảo postgres khởi động trước backend
      - mongodb
    # Override CMD trong Dockerfile: chạy migration trước khi start server
    command: sh -c "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"
    networks:
      - ifinance_net

  # ── 4. Frontend React + Nginx ──────────────────
  frontend:
    build: ./frontend       # Build từ frontend/Dockerfile (multi-stage)
    container_name: ifinance_frontend
    ports:
      - "5173:80"           # Map 5173 (host) → 80 (Nginx trong container)
    depends_on:
      - backend
    networks:
      - ifinance_net

# Volumes: Dữ liệu được giữ lại khi `docker-compose stop` (chỉ mất khi `down -v`)
volumes:
  postgres_data:
  mongodb_data:

# Network bridge riêng: cô lập khỏi các Docker project khác
networks:
  ifinance_net:
    driver: bridge
```

### 6.5 Các lệnh Docker thường dùng

```bash
# ──────────────────────────────────────────
# KHỞI ĐỘNG
# ──────────────────────────────────────────

# Lần đầu tiên hoặc sau khi thay đổi Dockerfile
docker-compose up -d --build

# Khởi động bình thường (không rebuild)
docker-compose up -d

# Khởi động và xem log trực tiếp (không detach)
docker-compose up

# ──────────────────────────────────────────
# QUẢN LÝ
# ──────────────────────────────────────────

# Xem log backend realtime
docker logs -f ifinance_backend

# Xem log tất cả services
docker-compose logs -f

# Vào terminal của backend container
docker exec -it ifinance_backend bash

# Nạp seed data (sau khi containers đang chạy)
docker exec -it ifinance_backend python seed.py

# Chạy test trong container
docker exec -it ifinance_backend pytest -v

# ──────────────────────────────────────────
# DỪNG
# ──────────────────────────────────────────

# Dừng tất cả (giữ data trong volumes)
docker-compose stop

# Dừng và xóa containers (giữ volumes)
docker-compose down

# Dừng, xóa containers VÀ xóa volumes (reset hoàn toàn)
docker-compose down -v

# ──────────────────────────────────────────
# DEBUG
# ──────────────────────────────────────────

# Xem trạng thái các containers
docker-compose ps

# Rebuild một service cụ thể
docker-compose up -d --build backend

# Chạy migration thủ công
docker exec -it ifinance_backend alembic upgrade head

# Rollback migration 1 bước
docker exec -it ifinance_backend alembic downgrade -1
```

### 6.6 Lưu ý về `depends_on`

```yaml
backend:
  depends_on:
    - postgres
    - mongodb
```

`depends_on` đảm bảo **container khởi động trước** — nhưng **không đảm bảo service sẵn sàng nhận kết nối**. PostgreSQL có thể mất 2-5 giây để khởi tạo sau khi container chạy. Lệnh `alembic upgrade head` sẽ retry tự động nếu DB chưa sẵn sàng. Trong production, nên dùng `healthcheck`:

```yaml
postgres:
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U admin -d ifinance"]
    interval: 5s
    timeout: 5s
    retries: 5

backend:
  depends_on:
    postgres:
      condition: service_healthy   # Chờ đến khi healthcheck pass
```

---

## 7. Đề xuất CI/CD Pipeline

> **Hiện trạng:** Dự án chưa có CI/CD tự động. Phần này đề xuất pipeline GitHub Actions phù hợp với kiến trúc hiện tại.

### 7.1 Chiến lược CI/CD tổng thể

```
Developer push/PR
        │
        ▼
┌───────────────────────────────────────────────────────┐
│                  GitHub Actions                        │
│                                                       │
│  CI (Pull Request)          CD (main branch)          │
│  ─────────────────          ─────────────────         │
│  1. Lint code               1. Run CI pipeline        │
│  2. Run pytest              2. Deploy Backend → Render │
│  3. Check coverage          3. Deploy Frontend → Vercel│
└───────────────────────────────────────────────────────┘
```

### 7.2 Workflow CI — Kiểm thử tự động

```yaml
# .github/workflows/ci.yml

name: CI — Test & Lint

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:

  # ── Backend Test ─────────────────────────────────────
  backend-test:
    name: Backend Tests (pytest)
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Python 3.12
        uses: actions/setup-python@v5
        with:
          python-version: '3.12'

      - name: Cache pip dependencies
        uses: actions/cache@v4
        with:
          path: ~/.cache/pip
          key: ${{ runner.os }}-pip-${{ hashFiles('backend/requirements.txt') }}

      - name: Install dependencies
        working-directory: backend
        run: pip install -r requirements.txt

      - name: Run pytest with coverage
        working-directory: backend
        env:
          # Tests dùng SQLite in-memory, không cần DB thật
          # Gemini bị mock, không cần API key thật
          GEMINI_API_KEY: "mock-key-for-testing"
          SECRET_KEY: "test-secret-key-ci"
        run: |
          pytest -v --cov=app.services --cov-report=term-missing
          pytest --cov=app.services --cov-report=xml

      - name: Upload coverage report
        uses: codecov/codecov-action@v4
        with:
          file: backend/coverage.xml
          flags: backend

  # ── Frontend Lint & Build ────────────────────────────
  frontend-build:
    name: Frontend Build Check
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js 20
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json

      - name: Install dependencies
        working-directory: frontend
        run: npm ci

      - name: Lint
        working-directory: frontend
        run: npm run lint

      - name: Build (kiểm tra không có lỗi compile)
        working-directory: frontend
        env:
          VITE_API_BASE_URL: https://ifinance-backend.onrender.com/api/v1
        run: npm run build
```

### 7.3 Workflow CD — Deploy tự động

```yaml
# .github/workflows/cd.yml

name: CD — Deploy to Production

on:
  push:
    branches: [main]

jobs:

  # ── Deploy Backend → Render ──────────────────────────
  deploy-backend:
    name: Deploy Backend to Render
    runs-on: ubuntu-latest
    needs: [backend-test, frontend-build]  # Chỉ deploy sau khi CI pass

    steps:
      - name: Trigger Render Deploy Hook
        run: |
          curl -X POST ${{ secrets.RENDER_DEPLOY_HOOK_URL }}
        # Render cung cấp Deploy Hook URL trong dashboard
        # Gọi URL này → Render pull code mới và redeploy

  # ── Deploy Frontend → Vercel ─────────────────────────
  deploy-frontend:
    name: Deploy Frontend to Vercel
    runs-on: ubuntu-latest
    needs: [backend-test, frontend-build]

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          working-directory: frontend
          vercel-args: '--prod'
```

### 7.4 GitHub Secrets cần cấu hình

| Secret name | Mô tả | Lấy từ đâu |
|-------------|-------|------------|
| `RENDER_DEPLOY_HOOK_URL` | Webhook URL kích hoạt deploy | Render Dashboard → Deploy Hooks |
| `VERCEL_TOKEN` | Personal Access Token | vercel.com → Settings → Tokens |
| `VERCEL_ORG_ID` | Organization/Team ID | Vercel dashboard |
| `VERCEL_PROJECT_ID` | Project ID | Vercel Project Settings |

### 7.5 Luồng CI/CD hoàn chỉnh

```
Developer: git push origin main
        │
        ▼
GitHub Actions trigger: ci.yml + cd.yml
        │
        ├── [Parallel] backend-test
        │       ├── pip install (từ cache nếu có)
        │       ├── pytest -v (SQLite in-memory, Gemini mocked)
        │       └── upload coverage → Codecov
        │
        └── [Parallel] frontend-build
                ├── npm ci (từ cache nếu có)
                ├── npm run lint
                └── npm run build (xác nhận không có compile error)
        │
        ▼ (Cả hai CI jobs pass)
        │
        ├── deploy-backend
        │       └── curl Render Deploy Hook → Render redeploy (~2-3 phút)
        │
        └── deploy-frontend
                └── Vercel action deploy → CDN propagate (~30-60 giây)
        │
        ▼
Production updated ✅
Tổng thời gian: ~5-7 phút từ push đến live
```

---

## 8. Cấu hình CORS và Bảo mật

### 8.1 CORS Configuration

```python
# backend/app/main.py
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",           # Local Vite dev server
        "http://127.0.0.1:5173",          # Alt localhost
        "https://i-finance-eosin.vercel.app"  # Production Vercel URL (hardcoded)
    ],
    allow_origin_regex=r"https://.*\.vercel\.app",  # Wildcard: mọi preview deployments
    allow_credentials=True,    # Cho phép gửi cookies (nếu dùng)
    allow_methods=["*"],       # GET, POST, PUT, PATCH, DELETE, OPTIONS
    allow_headers=["*"],       # Authorization, Content-Type, ...
)
```

**Lý do dùng `allow_origin_regex`:**  
Vercel tạo URL preview riêng cho mỗi PR/commit (ví dụ: `i-finance-git-feature-xyz.vercel.app`). Regex `https://.*\.vercel\.app` cho phép tất cả preview URLs mà không cần whitelist từng cái.

### 8.2 Rate Limiting

```python
# backend/app/main.py
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Áp dụng trên AI endpoints
@limiter.limit("5/minute")   # /ai/parse
@limiter.limit("3/minute")   # /ai/ocr  
@limiter.limit("10/minute")  # /ai/chat
```

Rate limit bảo vệ khỏi:
- Spam API calls (accidental infinite loop từ frontend)
- Lạm dụng AI API gây chi phí đột biến
- DDoS nhẹ vào các endpoint tính toán nặng

---

## 9. Monitoring và Vận hành

### 9.1 Health Check Endpoint

```python
# backend/app/main.py
@app.get("/")
def read_root():
    return {"message": "Server IFinance Backend đang chạy thành công!"}
```

Endpoint `/` dùng làm health check:
- **Render**: Tự động ping endpoint này để xác định service healthy
- **Uptime monitoring**: Dịch vụ như UptimeRobot ping `/` mỗi 5 phút để cảnh báo downtime
- **CI/CD**: Có thể thêm smoke test sau deploy

### 9.2 Logging

```bash
# Xem log Backend trên Render
# → Render Dashboard → Service → Logs tab

# Xem log Backend local
docker logs -f ifinance_backend

# Log APScheduler (subscription worker)
# Output: "⏳ [APScheduler] Đã khởi động Background Worker!"
# Output: "🛑 [APScheduler] Đã tắt Background Worker!"
```

### 9.3 Database Migrations trong Production

```bash
# Chạy migration khi deploy (tự động trong Render startup command)
alembic upgrade head

# Xem lịch sử migration
alembic history

# Rollback khẩn cấp (nếu migration có vấn đề)
alembic downgrade -1

# Xem migration hiện tại đang apply
alembic current
```

**Quy trình thêm migration mới:**

```bash
# 1. Sửa model trong models/
# 2. Tạo migration file tự động
alembic revision --autogenerate -m "add_new_column_to_users"

# 3. Kiểm tra migration file được tạo trong alembic/versions/
# 4. Commit migration file cùng với model changes
# 5. Khi deploy, Render tự chạy: alembic upgrade head
```

### 9.4 Seed Data

```bash
# Nạp dữ liệu mẫu (User, Categories, Wallets, Transactions)
docker exec -it ifinance_backend python seed.py

# Tài khoản test sau khi seed:
# Email: test@ifinance.com
# Password: 123456
```

---

## 10. Ưu điểm kiến trúc triển khai

### 10.1 Zero Infrastructure Cost — Free Tier Stack

Toàn bộ stack production của IFinance chạy **miễn phí** trên free tier của các dịch vụ:

| Dịch vụ | Free Tier | Giới hạn |
|---------|-----------|---------|
| Vercel | ✅ Free | 100GB bandwidth/tháng |
| Render | ✅ Free | 750 giờ/tháng, sleep sau 15 phút inactive |
| Supabase/Neon | ✅ Free | 500MB PostgreSQL |
| MongoDB Atlas | ✅ Free M0 | 512MB |

Đây là lợi thế quan trọng cho giai đoạn prototype/MVP — có thể deploy và demo hệ thống hoàn chỉnh mà không tốn chi phí infrastructure.

### 10.2 Tách biệt hoàn toàn Frontend và Backend

Frontend Vercel và Backend Render hoạt động **hoàn toàn độc lập**:

- Deploy Frontend mà không restart Backend → zero downtime cho API
- Deploy Backend mà không build lại Frontend → Frontend vẫn phục vụ user
- Scale từng tier độc lập theo nhu cầu thực tế
- Lỗi ở một tier không kéo sập tier kia

### 10.3 Docker Compose — Developer Experience xuất sắc

Local development với Docker Compose giải quyết bài toán "works on my machine":

```bash
# Toàn bộ stack (Frontend + Backend + PostgreSQL + MongoDB) chỉ cần 1 lệnh
docker-compose up -d --build
```

- **Onboarding nhanh:** Developer mới không cần cài PostgreSQL, MongoDB, cấu hình database — chỉ cần Docker
- **Môi trường giống Production:** Cùng OS (Linux), cùng Python version, cùng Nginx config
- **Data persistence:** Volume đảm bảo data không mất khi restart container
- **Network isolation:** Bridge network `ifinance_net` tránh xung đột với project Docker khác trên cùng máy

### 10.4 Multi-stage Docker Build — Image tối ưu

Frontend image chỉ ~25MB (Nginx + static files) thay vì ~500MB nếu giữ Node.js:
- **Deployment nhanh hơn** — upload image nhỏ hơn lên registry
- **Security surface nhỏ hơn** — không có Node.js runtime, không có npm, không có source code
- **Startup time nhanh hơn** — Nginx khởi động trong milliseconds

### 10.5 Alembic Migration — Database Version Control

Schema database được quản lý như source code:

```
alembic/versions/
├── a1b2c3d4_initial_schema.py
├── b2c3d4e5_add_budget_table.py
├── ...
└── c9d1e2f3_add_has_seen_tutorial.py
```

- Mọi thay đổi schema đều có lịch sử rõ ràng
- Deploy mới **tự động** chạy `alembic upgrade head` — không cần DBA can thiệp thủ công
- Rollback schema nếu cần: `alembic downgrade -1`
- Môi trường dev/staging/production đều có cùng schema nhờ migrate cùng file

### 10.6 Graceful Degradation

Hệ thống được thiết kế để **degradation có kiểm soát**:

| Thành phần fail | Impact | Còn hoạt động |
|----------------|--------|---------------|
| MongoDB Atlas | Chatbot AI mất | Tất cả tính năng khác |
| Render (Backend) | Toàn bộ frontend mất data | Static page vẫn load |
| Vercel (Frontend) | UI không hiển thị | API vẫn nhận request |
| Gemini API | AI features mất | Core finance features |

Mỗi dependency failure được handle bằng try/except riêng biệt, không propagate crash lên toàn hệ thống.

### 10.7 Đề xuất nâng cấp Production

Khi dự án scale lên, có thể nâng cấp từng thành phần:

| Hiện tại | Nâng cấp | Khi nào |
|----------|----------|---------|
| Render Free | Render Paid / AWS ECS | > 1,000 DAU |
| Supabase Free | Supabase Pro | > 500MB data |
| MongoDB Atlas M0 | Atlas M10+ | > 512MB chat history |
| GitHub Actions | Không đổi | Scale tốt |
| Vercel Free | Vercel Pro | > 100GB bandwidth/tháng |

---

## Phụ lục A: Checklist Deploy Production

```
PRE-DEPLOY:
□ Đã generate SECRET_KEY production (32 bytes random)
□ Đã tạo PostgreSQL database trên Supabase/Neon
□ Đã tạo MongoDB Atlas cluster + user
□ Đã lấy GEMINI_API_KEY từ Google AI Studio
□ Đã điền đủ Environment Variables trên Render
□ Đã điền VITE_API_BASE_URL trên Vercel

DEPLOY BACKEND (Render):
□ Kết nối GitHub repo với Render
□ Set Build Command: pip install -r requirements.txt
□ Set Start Command: alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT
□ Set Root Directory: backend
□ Verify log: "Server IFinance Backend đang chạy thành công!"

DEPLOY FRONTEND (Vercel):
□ Import GitHub repo vào Vercel
□ Set Root Directory: frontend
□ Set Build Command: npm run build
□ Set Output Directory: dist
□ Set VITE_API_BASE_URL environment variable
□ Verify: https://i-finance-eosin.vercel.app hiển thị đúng

POST-DEPLOY:
□ Test đăng ký tài khoản mới
□ Test đăng nhập
□ Test tạo giao dịch (Manual)
□ Test AI Smart Input
□ Test OCR (upload ảnh hóa đơn)
□ Test Chatbot
□ Kiểm tra log Render không có ERROR
```

## Phụ lục B: Troubleshooting thường gặp

| Vấn đề | Triệu chứng | Giải pháp |
|--------|------------|-----------|
| Backend sleep (Render Free) | API timeout sau 15 phút không dùng | Cold start ~30s, thêm UptimeRobot ping mỗi 10 phút |
| CORS error | Browser console: "blocked by CORS" | Kiểm tra `allow_origins` trong `main.py` có chứa Vercel URL |
| Migration fail | Render log: "alembic.exc.ProgrammingError" | Kiểm tra DATABASE_URL đúng format, DB đã tồn tại |
| MongoDB timeout | Backend log: "❌ Lỗi kết nối MongoDB" | Kiểm tra MONGO_URI, Atlas IP whitelist (0.0.0.0/0) |
| Vite build fail | Vercel build error | Kiểm tra VITE_API_BASE_URL đã set, npm ci thành công |
| Docker port conflict | "port is already allocated" | Đổi host port: `5433:5432` hoặc kill process giữ port |

---

*Tài liệu này được viết dựa trên phân tích trực tiếp `docker-compose.yml`, `backend/Dockerfile`, `frontend/Dockerfile`, `frontend/nginx.conf`, `backend/app/main.py`, và `frontend/package.json` của dự án IFinance.*
