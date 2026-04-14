# AI DESIGN DOCUMENT
## Thiết kế Tích hợp Trí tuệ Nhân tạo — Hệ thống IFinance

**Phiên bản tài liệu:** 1.0  
**Ngày cập nhật:** 2026-04-14  
**AI Model:** Google Gemini 2.5 Flash (`models/gemini-2.5-flash`)  
**SDK:** `google-generativeai` Python SDK  

---

## Mục lục

1. [Vai trò AI trong hệ thống IFinance](#1-vai-trò-ai-trong-hệ-thống-ifinance)
2. [Kiến trúc tích hợp AI](#2-kiến-trúc-tích-hợp-ai)
3. [Chức năng Smart Input — Nhập liệu Ngôn ngữ tự nhiên](#3-chức-năng-smart-input--nhập-liệu-ngôn-ngữ-tự-nhiên)
4. [Chức năng OCR — Nhận dạng Hóa đơn](#4-chức-năng-ocr--nhận-dạng-hóa-đơn)
5. [Chức năng RAG Chatbot — Tư vấn Tài chính](#5-chức-năng-rag-chatbot--tư-vấn-tài-chính)
6. [Cơ chế Function Calling](#6-cơ-chế-function-calling)
7. [Chức năng AI Budget Template](#7-chức-năng-ai-budget-template)
8. [Chiến lược tối ưu chi phí API](#8-chiến-lược-tối-ưu-chi-phí-api)
9. [Chiến lược Mock AI trong kiểm thử](#9-chiến-lược-mock-ai-trong-kiểm-thử)
10. [Ưu điểm tích hợp AI trong IFinance](#10-ưu-điểm-tích-hợp-ai-trong-ifinance)

---

## 1. Vai trò AI trong hệ thống IFinance

### 1.1 Vị trí chiến lược

AI không phải tính năng phụ trợ trong IFinance — đây là **thành phần cốt lõi** tạo ra lợi thế cạnh tranh so với các ứng dụng quản lý tài chính truyền thống. Trong khi các giải pháp thông thường yêu cầu người dùng nhập liệu thủ công từng trường (số tiền, danh mục, ví, ngày), IFinance cho phép người dùng **diễn đạt bằng ngôn ngữ tự nhiên** hoặc **chụp ảnh hóa đơn** để hệ thống tự động xử lý toàn bộ.

### 1.2 Bốn nhóm chức năng AI

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    AI LAYER — Google Gemini 2.5 Flash                    │
│                                                                         │
│  ┌─────────────────┐  ┌──────────────────┐  ┌──────────────────────┐   │
│  │  Smart Input    │  │   OCR Receipt    │  │    RAG Chatbot       │   │
│  │  (NLP Parsing)  │  │  (Multimodal)    │  │  + Function Calling  │   │
│  └────────┬────────┘  └────────┬─────────┘  └──────────┬───────────┘   │
│           │                   │                        │               │
│  ┌────────▼───────────────────▼────────────────────────▼───────────┐   │
│  │               Budget Template Generator (AI-Advised)            │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
         │                    │                     │
         ▼                    ▼                     ▼
  PostgreSQL DB          PIL Image           MongoDB Atlas
  (wallets, cats)        (file bytes)        (chat history)
```

### 1.3 Lựa chọn model: Gemini 2.5 Flash

| Tiêu chí | Gemini 2.5 Flash | Lý do chọn |
|----------|-----------------|------------|
| **Tốc độ** | Rất nhanh (< 2s/request) | UX yêu cầu phản hồi tức thì |
| **Chi phí** | Thấp hơn Pro/Ultra | Phù hợp cho startup, nhiều API call |
| **Multimodal** | Hỗ trợ text + image | Cần thiết cho tính năng OCR |
| **JSON Output** | Ổn định với instruction | Structured output cho financial data |
| **Ngôn ngữ** | Tiếng Việt tốt | Target user là người Việt |
| **Context window** | 1M tokens | Đủ cho RAG prompt + chat history |

---

## 2. Kiến trúc tích hợp AI

### 2.1 Cấu trúc AIService

Toàn bộ logic AI được đóng gói trong lớp `AIService` theo pattern **Singleton**:

```python
# backend/app/services/ai_service.py

import google.generativeai as genai
from PIL import Image
from app.db.mongodb import chat_collection

class AIService:
    def __init__(self):
        self.primary_model_name = 'models/gemini-2.5-flash'

    def _get_model(self) -> genai.GenerativeModel:
        """
        Factory method — tạo model instance.
        Tách biệt khỏi __init__ để dễ mock trong test:
            patch('AIService._get_model') → inject MagicMock
        """
        return genai.GenerativeModel(self.primary_model_name)

    def parse_natural_language(self, db, text, user_id): ...
    def ocr_receipt(self, file_bytes): ...
    def chat_rag(self, db, message, session_id, user_id): ...
    def get_chat_history(self, session_id, user_id): ...
    def generate_budget_template(self, db, income, template_type, user_id): ...

# Singleton instance — import và dùng trực tiếp
ai_service = AIService()
```

**Điểm thiết kế then chốt — `_get_model()`:**  
Model instance được tạo mới mỗi lần gọi thay vì lưu vào `self.model`. Điều này:
1. Tránh giữ connection lâu dài với Google API.
2. Tạo điểm mock duy nhất, dễ kiểm soát trong unit test.
3. Đảm bảo mỗi request nhận model state sạch.

### 2.2 Khởi tạo API Key

```python
load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")
if api_key:
    genai.configure(api_key=api_key)   # Configure global SDK một lần duy nhất
```

SDK được cấu hình ở **module level** — thực thi một lần khi module được import. Nếu `GEMINI_API_KEY` không tồn tại trong môi trường (ví dụ: môi trường test), `configure()` bị bỏ qua và mock có thể thay thế hoàn toàn.

### 2.3 API Endpoints và Rate Limiting

```python
# backend/app/api/v1/routers/ai.py
from slowapi.extension import Limiter
limiter = Limiter(key_func=get_remote_address)   # Rate limit theo IP

@router.post("/parse")
@limiter.limit("5/minute")     # Smart Input: 5 req/phút/IP
def parse_natural_language(...): ...

@router.post("/ocr")
@limiter.limit("3/minute")     # OCR: 3 req/phút/IP (nặng hơn)
async def ocr_receipt(...): ...

@router.post("/chat")
@limiter.limit("10/minute")    # Chat: 10 req/phút/IP
def chat_with_ai(...): ...
```

Tất cả AI endpoints đều yêu cầu JWT authentication (`get_current_user` dependency) trước khi xử lý — không có anonymous AI call.

### 2.4 Phân loại lỗi AI có cấu trúc

```python
# Pattern xử lý lỗi nhất quán trong mọi AI endpoint
try:
    result = ai_service.parse_natural_language(db, data.text, user_id)
    return {"status": "success", "data": result}
except ValueError as ve:
    raise HTTPException(status_code=400, detail=str(ve))   # Lỗi input (ảnh hỏng, ví chưa tạo...)
except RuntimeError as re:
    raise HTTPException(status_code=503, detail=str(re))   # Lỗi AI tạm thời
except Exception as e:
    raise HTTPException(status_code=500, detail=...)       # Lỗi không xác định
```

---

## 3. Chức năng Smart Input — Nhập liệu Ngôn ngữ tự nhiên

### 3.1 Mô tả chức năng

Smart Input cho phép người dùng nhập liệu giao dịch bằng **câu văn tự nhiên tiếng Việt** thay vì điền form thủ công. Ví dụ: `"Sáng nay ăn phở 50k bằng tiền mặt, chiều uống cafe 35k thẻ VISA"` → hệ thống tự động trích xuất 2 giao dịch với đầy đủ thông tin.

### 3.2 Luồng xử lý chi tiết

```
Người dùng nhập text
        │
        ▼
[Frontend: AddTransaction.jsx]
POST /ai/parse { text: "Sáng nay ăn phở 50k..." }
        │
        ▼
[Router: /ai/parse — Rate limit: 5/min]
        │
        ▼
[AIService.parse_natural_language(db, text, user_id)]
        │
        ├── 1. Query PostgreSQL: wallets WHERE user_id = X
        │      → [{"id": 1, "name": "Ví tiền mặt"}, {"id": 2, "name": "Thẻ VISA"}]
        │
        ├── 2. Query PostgreSQL: categories WHERE user_id = X OR user_id IS NULL
        │      → [{"id": 3, "name": "Ăn uống", "type": "expense"}, ...]
        │
        ├── 3. Build Context-Aware Prompt (xem §3.3)
        │
        ├── 4. model.generate_content(prompt) → raw response text
        │
        ├── 5. Strip markdown fences (```json ... ```)
        │
        └── 6. json.loads(cleaned_text) → {"transactions": [...]}
                │
                ▼
[Frontend] Điền form với giao dịch đầu tiên
           Nếu > 1 giao dịch → alert thông báo
```

### 3.3 Kỹ thuật Prompt Engineering

Prompt được thiết kế theo nguyên tắc **Context Injection** — nhúng dữ liệu thực tế của người dùng (danh sách ví, danh mục) vào prompt để Gemini ánh xạ đúng ID:

```python
prompt = f"""
Bạn là một trợ lý tài chính cá nhân thông minh. Nhiệm vụ của bạn là phân tích câu văn 
của người dùng, bóc tách TẤT CẢ các giao dịch có trong câu và trả về định dạng JSON 
nghiêm ngặt. KHÔNG trả về bất kỳ văn bản nào khác ngoài JSON.

Câu của người dùng: "{text}"

Danh sách Ví (Wallet) của người dùng:
{json.dumps(wallet_list, ensure_ascii=False)}
# → [{"id": 1, "name": "Ví tiền mặt"}, {"id": 2, "name": "Thẻ VISA"}]

Danh sách Danh mục (Category) của người dùng:
{json.dumps(category_list, ensure_ascii=False)}
# → [{"id": 3, "name": "Ăn uống", "type": "expense"}, ...]

Quy tắc phân tích:
1. amount: Quy đổi ra số nguyên (VD: "50k" -> 50000, "1 củ" -> 1000000).
2. transaction_type: "expense" hoặc "income" dựa trên ngữ nghĩa.
3. category_id: Tìm ID phù hợp nhất trong danh sách trên.
4. wallet_id: Tìm ID ví được nhắc đến. Nếu không nhắc, lấy ví đầu tiên.
5. note: Tóm tắt ghi chú ngắn gọn.
6. date: YYYY-MM-DD. Nếu không nhắc thời gian, dùng hôm nay: {datetime.utcnow().date()}.

Định dạng JSON trả về (luôn chứa mảng "transactions"):
{{ "transactions": [{{ "amount": 50000, "transaction_type": "expense",
   "category_id": 3, "wallet_id": 1, "note": "Ăn phở", "date": "..." }}] }}
"""
```

**Các kỹ thuật tối ưu trong prompt:**
- **Vietnamese slang normalization:** Chỉ dẫn rõ quy tắc chuyển đổi đơn vị ("50k", "1 củ", "2 lít") thành số nguyên.
- **Relative date resolution:** Inject ngày hiện tại (`datetime.utcnow().date()`) và năm hiện tại để Gemini giải quyết "hôm nay", "tuần trước", "12/3".
- **Grounded category mapping:** Thay vì để Gemini tự bịa ID, cung cấp toàn bộ danh sách thực tế — Gemini chỉ cần chọn ID có sẵn.
- **Strict JSON instruction:** `"KHÔNG trả về bất kỳ văn bản nào khác ngoài JSON"` — giảm thiểu markdown noise.

### 3.4 Xử lý Markdown Fence

Gemini thường bọc JSON trong markdown code block. Hệ thống xử lý cả hai dạng:

```python
res_text = response.text.strip()

if res_text.startswith("```json"):
    res_text = res_text[7:-3].strip()    # Cắt ```json và ```
elif res_text.startswith("```"):
    res_text = res_text[3:-3].strip()    # Cắt ``` và ```

result_json = json.loads(res_text)

# Safety fallback: nếu Gemini trả về object thay vì array
if "transactions" not in result_json:
    result_json = {"transactions": [result_json]}
```

### 3.5 Tích hợp Frontend

```javascript
// frontend/src/pages/Transactions/AddTransaction.jsx
const handleAiSubmit = async () => {
    const response = await axiosClient.post('/ai/parse', { text: aiText });
    const aiResult = response.data?.data;

    if (aiResult?.transactions?.length > 0) {
        const tx = aiResult.transactions[0];
        
        // Điền form với dữ liệu từ AI
        setFormData(prev => ({
            ...prev,
            amount: tx.amount || '',
            transaction_type: tx.transaction_type || 'expense',
            category_id: tx.category_id || prev.category_id,
            wallet_id: tx.wallet_id || prev.wallet_id,
            note: tx.note || ''
        }));

        setInputType('manual');   // Chuyển sang tab form để user kiểm tra
    }
};
```

**UX Pattern:** AI điền sẵn form → người dùng **kiểm tra và xác nhận** trước khi lưu. Đây là thiết kế **Human-in-the-Loop** — AI hỗ trợ, người dùng kiểm soát cuối cùng.

---

## 4. Chức năng OCR — Nhận dạng Hóa đơn

### 4.1 Mô tả chức năng

OCR (Optical Character Recognition) cho phép người dùng **chụp ảnh hóa đơn/biên lai** và hệ thống tự động trích xuất: tên cửa hàng, tổng tiền, ngày giao dịch, và danh sách mặt hàng.

### 4.2 Đặc điểm kỹ thuật: Multimodal AI

Đây là điểm phân biệt OCR của IFinance với OCR truyền thống (Tesseract, EasyOCR): thay vì xử lý ảnh → text → parse, IFinance dùng **Gemini Vision** — model hiểu đồng thời cả hình ảnh lẫn ngôn ngữ, cho phép hiểu **ngữ nghĩa** hóa đơn, không chỉ đọc ký tự.

```python
def ocr_receipt(self, file_bytes: bytes):
    # Bước 1: Decode bytes → PIL Image object
    img = Image.open(io.BytesIO(file_bytes))
    
    # Bước 2: Build structured extraction prompt
    prompt = f"""
    Bạn là chuyên gia AI về bóc tách dữ liệu hóa đơn.
    Hãy nhìn vào bức ảnh và trích xuất thành JSON NGHIÊM NGẶT.
    
    Quy tắc:
    1. merchant: Tên cửa hàng (VD: Highlands Coffee, Circle K...)
    2. total: Tổng tiền cuối (số nguyên, VD: 59000)
    3. date: Ngày trên hóa đơn (YYYY-MM-DD). Không có → dùng: {datetime.utcnow().date()}
    4. items: Danh sách mặt hàng (tên, số lượng, đơn giá)
    
    Cấu trúc JSON:
    {{ "merchant": "...", "total": 59000, "date": "...",
       "items": [{{"name": "...", "quantity": 1, "price": 29000}}],
       "ocr_data": {{"raw_text": "Trích 1-2 dòng text nổi bật"}} }}
    """
    
    # Bước 3: Multimodal call — truyền cả text prompt VÀ image object
    model = self._get_model()
    response = model.generate_content([prompt, img])   # ← List chứa cả hai
    
    # Bước 4: Extract JSON bằng regex (chính xác hơn string slicing)
    res_text = response.text.strip()
    json_match = re.search(r'```json\n(.*?)\n```', res_text, re.DOTALL)
    if json_match:
        res_text = json_match.group(1).strip()
    
    return json.loads(res_text)
```

### 4.3 Luồng xử lý end-to-end

```
[Frontend] User chọn file ảnh (JPG/PNG/WEBP)
        │
        ▼
[Router] Validate content_type trước khi xử lý
        │  valid_extensions = ["image/jpeg", "image/png", "image/jpg", "image/webp"]
        │  if file.content_type not in valid_extensions → HTTP 400
        │
        ▼
file_bytes = await file.read()   ← async đọc file upload
        │
        ▼
[AIService.ocr_receipt(file_bytes)]
        │
        ├── img = Image.open(io.BytesIO(file_bytes))    ← PIL decode
        │
        ├── model.generate_content([prompt, img])       ← Gemini Vision
        │         ↑ Multimodal: 1 text + 1 image
        │
        ├── re.search(r'```json\n(.*?)\n```', res, DOTALL)  ← Regex extract
        │
        └── json.loads(cleaned_text) → {merchant, total, date, items}
                │
                ▼
[Frontend] Điền form:
           amount ← total
           note   ← "Thanh toán tại {merchant} ({item1}, {item2}...)"
           date   ← date từ hóa đơn
```

### 4.4 So sánh với OCR truyền thống

| Tiêu chí | OCR truyền thống (Tesseract) | Gemini Vision OCR |
|----------|------------------------------|-------------------|
| **Phương pháp** | Character recognition → text → regex parse | Hiểu ngữ nghĩa toàn bộ ảnh |
| **Hóa đơn mờ/nghiêng** | Độ chính xác thấp | Xử lý tốt hơn nhờ AI comprehension |
| **Nhiều ngôn ngữ** | Cần cấu hình ngôn ngữ | Hỗ trợ tự động |
| **Cấu trúc output** | Raw text, cần parse thêm | Trực tiếp JSON có cấu trúc |
| **Tích hợp** | Cần cài đặt binary (tesseract-ocr) | API call, không cần runtime |
| **Chi phí** | Thấp (local) | Tính theo token (API) |

### 4.5 Xử lý lỗi OCR có phân loại

```python
try:
    img = Image.open(io.BytesIO(file_bytes))
except Exception:
    raise ValueError("Không thể đọc được ảnh. File có thể bị hỏng.")
    # → HTTP 400: Lỗi phía client

try:
    response = model.generate_content([prompt, img])
    result_json = json.loads(cleaned_text)
    return result_json
except json.JSONDecodeError:
    raise ValueError("AI phân tích thành công nhưng định dạng dữ liệu không chuẩn.")
    # → HTTP 400: Gemini trả về non-JSON
except Exception as e:
    raise RuntimeError("Không thể quét hóa đơn này. Vui lòng thử chụp lại rõ nét hơn.")
    # → HTTP 503: Lỗi AI tạm thời
```

---

## 5. Chức năng RAG Chatbot — Tư vấn Tài chính

### 5.1 Kiến trúc RAG (Retrieval-Augmented Generation)

RAG là kỹ thuật cải thiện độ chính xác của LLM bằng cách **inject dữ liệu thực tế** vào context window trước khi gọi AI. Thay vì Gemini chỉ dựa vào kiến thức huấn luyện, nó được cung cấp **dữ liệu tài chính thực tế của người dùng** để đưa ra tư vấn có căn cứ.

```
┌─────────────────────────────────────────────────────────────────┐
│                    RAG Architecture — IFinance                   │
│                                                                 │
│  User Message                                                   │
│       │                                                         │
│       ▼                                                         │
│  [Retrieval Phase]                                              │
│       ├── PostgreSQL: 20 giao dịch gần nhất (Financial context) │
│       ├── PostgreSQL: wallets + categories (User's data schema) │
│       └── MongoDB: 6 tin nhắn gần nhất (Conversation context)  │
│       │                                                         │
│       ▼                                                         │
│  [Augmentation Phase]                                           │
│       └── Build Prompt = System Role + Retrieved Data + Message │
│       │                                                         │
│       ▼                                                         │
│  [Generation Phase]                                             │
│       └── Gemini 2.5 Flash → Response (text OR JSON action)    │
│       │                                                         │
│       ▼                                                         │
│  [Storage Phase]                                                │
│       └── MongoDB: Lưu cả user message và bot response         │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Luồng xử lý chi tiết

```python
def chat_rag(self, db: Session, message: str, session_id: str, user_id: int):
    
    # ═══════════════════════════════════════════════
    # BƯỚC 1: LƯU USER MESSAGE VÀO MONGODB
    # ═══════════════════════════════════════════════
    session_id = session_id or str(uuid.uuid4())   # Tạo session mới nếu cần
    user_msg = {
        "session_id": session_id,
        "user_id": user_id,
        "sender": "user",
        "text": message,
        "timestamp": datetime.utcnow()
    }
    chat_collection.insert_one(user_msg)
    
    # ═══════════════════════════════════════════════
    # BƯỚC 2: RETRIEVAL — LẤY FINANCIAL CONTEXT
    # ═══════════════════════════════════════════════
    
    # 2a. PostgreSQL: 20 giao dịch gần nhất (sắp xếp DESC theo ngày)
    recent_txs = db.query(Transaction)\
        .filter(Transaction.user_id == user_id)\
        .order_by(Transaction.date.desc())\
        .limit(20).all()
    
    tx_data_str = "\n".join([
        f"- Ngày {tx.date}: {'Chi phí' if tx.transaction_type == 'expense' else 'Thu nhập'} "
        f"{tx.amount}đ cho {tx.category.name if tx.category else 'Khác'} (Note: {tx.note})"
        for tx in recent_txs
    ]) if recent_txs else "Chưa có giao dịch."
    
    # 2b. MongoDB: 6 tin nhắn gần nhất trong session (conversation history)
    recent_chat_cursor = chat_collection.find(
        {"session_id": session_id, "user_id": user_id}
    ).sort("timestamp", -1).limit(6)
    
    chat_history_str = "\n".join([
        f"{'Người dùng' if msg['sender'] == 'user' else 'IFinance'}: {msg['text']}"
        for msg in reversed(list(recent_chat_cursor))
    ])
    
    # 2c. PostgreSQL: Schema data (wallets + categories) để map ID
    wallets = db.query(Wallet).filter(Wallet.user_id == user_id).all()
    categories = db.query(Category).filter(
        (Category.user_id == user_id) | (Category.user_id == None)
    ).all()
    
    # ═══════════════════════════════════════════════
    # BƯỚC 3: AUGMENTATION — BUILD PROMPT
    # ═══════════════════════════════════════════════
    prompt = f"""
        Bạn là IFinance, trợ lý tài chính thông minh.
        
        [DỮ LIỆU HIỆN TẠI]
        - Giao dịch gần đây: {tx_data_str}
        - Danh sách Ví: {json.dumps(wallet_list, ensure_ascii=False)}
        - Danh sách Danh mục: {json.dumps(category_list, ensure_ascii=False)}
        - Lịch sử chat: {chat_history_str}
        
        [QUY TẮC PHẢN HỒI] ...
        
        Người dùng vừa nói: "{message}"
    """
    
    # ═══════════════════════════════════════════════
    # BƯỚC 4: GENERATION — GỌI GEMINI
    # ═══════════════════════════════════════════════
    model = self._get_model()
    response = model.generate_content(prompt)
    
    # ═══════════════════════════════════════════════
    # BƯỚC 5: PARSE RESPONSE (text OR action JSON)
    # Xem §6 — Function Calling
    # ═══════════════════════════════════════════════
    
    # ═══════════════════════════════════════════════
    # BƯỚC 6: LƯU BOT RESPONSE VÀO MONGODB
    # ═══════════════════════════════════════════════
    bot_msg = {"session_id": session_id, "user_id": user_id,
               "sender": "bot", "text": bot_reply, "timestamp": datetime.utcnow()}
    chat_collection.insert_one(bot_msg)
    
    return {"reply": bot_reply, "session_id": session_id,
            "action": action_type, "action_data": extracted_txs}
```

### 5.3 Thiết kế MongoDB Schema cho Chat History

```javascript
// Collection: chat_history
{
    "_id": ObjectId("..."),              // MongoDB auto-generated
    "session_id": "uuid-v4-string",      // Phiên hội thoại (1 browser tab = 1 session)
    "user_id": 42,                       // Link về PostgreSQL users.user_id
    "sender": "user" | "bot",           // Phân biệt người gửi
    "text": "Sáng nay ăn phở 50k",      // Nội dung tin nhắn
    "timestamp": ISODate("2026-04-14T08:30:00Z")  // Thứ tự hiển thị
}
```

**Lý do dùng MongoDB thay PostgreSQL cho chat history:**
- Schema-less: tin nhắn không có cấu trúc cố định (có thể thêm metadata sau)
- High write throughput: mỗi turn chat = 2 insert (user + bot) không ảnh hưởng transaction DB
- TTL index tiềm năng: có thể expire tin nhắn cũ tự động
- Horizontal scaling: chat volume tăng không ảnh hưởng database tài chính

### 5.4 Session Management

```javascript
// frontend/src/pages/AIChat/AIChat.jsx

// Session ID được persist trong localStorage
const [sessionId, setSessionId] = useState(
    localStorage.getItem('ai_session_id') || null
);

// Session mới được tạo từ UUID trả về bởi backend
if (!sessionId && responseData.session_id) {
    setSessionId(responseData.session_id);
    localStorage.setItem('ai_session_id', responseData.session_id);
}

// Xóa session → bắt đầu cuộc trò chuyện mới
const handleClearChat = () => {
    localStorage.removeItem('ai_session_id');
    setSessionId(null);
};
```

---

## 6. Cơ chế Function Calling

### 6.1 Khái niệm Function Calling trong IFinance

**Function Calling** là pattern trong đó AI không chỉ trả về text mà còn **ra lệnh thực thi hành động** bằng cách trả về JSON có cấu trúc xác định. Khác với Function Calling API chính thức của Google (tool_declarations), IFinance implement một cơ chế **prompt-based conditional output** — hướng dẫn Gemini chọn giữa hai chế độ phản hồi:

```
Input: "Hôm nay ăn phở 50k"
         │
         ▼
Gemini phân loại: Ra lệnh thêm giao dịch?
         │
    YES──┤──NO
         │       │
         ▼       ▼
    JSON Action  Text Answer
```

### 6.2 Conditional Output Prompt Design

```python
prompt = f"""
    [QUY TẮC PHẢN HỒI BẮT BUỘC]
    
    TRƯỜNG HỢP 1 - HỎI ĐÁP:
    Nếu người dùng hỏi thông tin, phân tích, tư vấn
    → Trả lời bằng văn bản Markdown bình thường.
    
    TRƯỜNG HỢP 2 - RA LỆNH THÊM GIAO DỊCH (FUNCTION CALLING):
    Nếu người dùng yêu cầu THÊM, GHI, NHẬP giao dịch
    → KHÔNG trả lời văn bản, BẮT BUỘC chỉ trả về 1 khối JSON:
    
    ```json
    {{
        "action": "add_transaction",
        "data": [
            {{
                "amount": 50000,
                "transaction_type": "expense",
                "category_id": 1,
                "wallet_id": 1,
                "note": "Ăn phở"
            }}
        ],
        "reply": "Tuyệt vời! Mình đã ghi nhận khoản chi..."
    }}
    ```
    
    LƯU Ý: NẾU NHẮC NHIỀU GIAO DỊCH, BẮT BUỘC TRẢ VỀ TẤT CẢ TRONG MẢNG `data`.
    
    Người dùng vừa nói: "{message}"
"""
```

### 6.3 Parsing và Dispatch Logic

```python
# Backend: Phân tích response để phát hiện action
res_text = response.text.strip()
bot_reply = res_text      # Default: text response
action_type = None
extracted_txs = []

json_match = re.search(r'```json\n(.*?)\n```', res_text, re.DOTALL)
if json_match:
    try:
        action_data = json.loads(json_match.group(1).strip())
        
        if action_data.get("action") == "add_transaction":
            raw_data = action_data.get("data")
            
            # Handle cả dict (1 tx) và list (nhiều tx)
            if isinstance(raw_data, dict):
                extracted_txs = [raw_data]
            elif isinstance(raw_data, list):
                extracted_txs = raw_data
            
            # Lấy reply text từ trong JSON
            bot_reply = action_data.get("reply", "Mình đã phân tích được các giao dịch...")
            action_type = "add_transaction"
    except Exception:
        bot_reply = "Mình hiểu bạn muốn thêm giao dịch, nhưng có lỗi xảy ra..."
```

### 6.4 Frontend Action Handling

```javascript
// frontend/src/pages/AIChat/AIChat.jsx

const responseData = response.data?.data;

// Hiển thị tin nhắn chat bình thường
setMessages(prev => [...prev, { sender: 'bot', text: responseData.reply }]);

// KIỂM TRA ACTION → MỞ CONFIRM MODAL
if (responseData.action === 'add_transaction' && responseData.action_data?.length > 0) {
    setPendingTxs(responseData.action_data);
    setIsConfirmModalOpen(true);   // Hiện popup xác nhận
}

// Khi user bấm "Lưu X giao dịch":
const handleConfirmTransactions = async () => {
    for (const tx of pendingTxs) {
        await axiosClient.post('/transactions/', {
            amount: tx.amount,
            transaction_type: tx.transaction_type,
            category_id: tx.category_id,
            wallet_id: tx.wallet_id,
            note: tx.note || 'AI tự động ghi nhận',
            date: new Date().toISOString().split('T')[0]
        });
    }
    toast.success(`Đã lưu thành công ${pendingTxs.length} giao dịch!`);
};
```

### 6.5 Luồng Function Calling đầy đủ

```
User: "Hôm nay ăn phở 50k bằng tiền mặt, cafe 35k thẻ VISA"
        │
        ▼
[POST /ai/chat] → chat_rag(...)
        │
        ├── RAG: Load 20 txs + 6 chat messages + wallets/categories
        │
        ├── Gemini phân loại → TRƯỜNG HỢP 2 (ra lệnh giao dịch)
        │
        ├── Response: ```json { "action": "add_transaction",
        │                       "data": [{...phở 50k...}, {...cafe 35k...}],
        │                       "reply": "Đã nhận..." }```
        │
        ├── regex extract JSON → parse action_data (list 2 items)
        │
        ├── Lưu bot_msg vào MongoDB
        │
        └── Return: { reply, session_id, action: "add_transaction",
                      action_data: [{phở}, {cafe}] }
                │
                ▼
        [Frontend]
        setMessages(bot reply text)
        setPendingTxs([{phở}, {cafe}])
        setIsConfirmModalOpen(true)
                │
                ▼
        [Confirm Modal]
        User thấy preview: "-50,000đ Ăn uống • Ví tiền mặt"
                           "-35,000đ Cafe • Thẻ VISA"
        Bấm "Lưu 2 giao dịch"
                │
                ▼
        [Loop] POST /transactions/ × 2
        toast.success("Đã lưu thành công 2 giao dịch!")
```

---

## 7. Chức năng AI Budget Template

### 7.1 Mô tả chức năng

Người dùng nhập thu nhập tháng và chọn quy tắc phân bổ tài chính (50/30/20, 60/20/20...), hệ thống tự động tính toán hạn mức ngân sách cho từng danh mục chi tiêu.

### 7.2 Đặc điểm kỹ thuật: JSON Mode và Temperature Control

Đây là hàm AI duy nhất trong IFinance sử dụng **`GenerationConfig`** để điều chỉnh tham số model:

```python
def generate_budget_template(self, db, income, template_type, user_id):
    # Lấy danh mục expense của user (để map ID thực tế)
    categories = db.query(Category).filter(
        Category.type == "expense",
        (Category.user_id == user_id) | (Category.user_id == None)
    ).all()
    cat_list = [{"id": c.category_id, "name": c.name} for c in categories]
    
    prompt = f"""
    Bạn là chuyên gia tài chính cá nhân. Thu nhập: {income:,.0f} VND.
    Quy tắc phân bổ: '{template_type}'.
    
    Danh mục chi tiêu: {json.dumps(cat_list, ensure_ascii=False)}
    
    Nhiệm vụ: Tính số tiền cụ thể cho mỗi nhóm và CHỌN category_id phù hợp.
    
    YÊU CẦU: Chỉ trả về 1 mảng JSON, KHÔNG markdown, KHÔNG text thừa.
    [ {{"category_id": int, "category_name": str,
        "amount_limit": float, "description": "Lý do"}} ]
    """
    
    model = self._get_model()
    response = model.generate_content(
        prompt,
        generation_config=genai.GenerationConfig(
            response_mime_type="application/json",  # ← JSON Mode
            temperature=0.2                          # ← Near-deterministic
        )
    )
    
    # Không cần strip markdown — JSON Mode đảm bảo pure JSON
    suggested_budgets = json.loads(response.text.strip())
    return suggested_budgets
```

**Hai tham số tối ưu:**

| Tham số | Giá trị | Ý nghĩa |
|---------|---------|---------|
| `response_mime_type="application/json"` | JSON Mode | Gemini đảm bảo output là valid JSON, không có markdown fence |
| `temperature=0.2` | Gần 0 | Output gần như deterministic — phù hợp tính toán tài chính cần nhất quán |

**So sánh với các hàm khác:**
- Smart Input, OCR, RAG Chatbot: Không dùng `GenerationConfig` → dùng temperature mặc định (~1.0) → output có sáng tạo hơn, phù hợp NLP/conversation
- Budget Template: `temperature=0.2` → kết quả tính toán ổn định, không "sáng tạo" số liệu tài chính

---

## 8. Chiến lược tối ưu chi phí API

### 8.1 Rate Limiting — Bảo vệ phía Server

Hệ thống dùng `slowapi` (dựa trên `limits` library) để giới hạn số lần gọi AI theo IP:

```
POST /ai/parse   → 5 request/minute/IP    (Smart Input — gọi nhiều nhất)
POST /ai/ocr     → 3 request/minute/IP    (OCR — đắt tiền nhất do ảnh)
POST /ai/chat    → 10 request/minute/IP   (Chat — cần nhiều turn nhất)
POST /ai/budget-template → không giới hạn (ít dùng, không cần throttle)
```

Rate limit được tính theo địa chỉ IP (`get_remote_address`) — không phải per-user. Điều này đảm bảo ngay cả khi user thay đổi account, lưu lượng vẫn được kiểm soát theo thiết bị.

### 8.2 Context Window Optimization trong RAG

Thay vì load toàn bộ lịch sử giao dịch (có thể hàng nghìn dòng), hệ thống giới hạn chặt chẽ:

```python
# Chỉ lấy 20 giao dịch gần nhất — đủ để AI hiểu pattern chi tiêu
recent_txs = db.query(Transaction)\
    .filter(Transaction.user_id == user_id)\
    .order_by(Transaction.date.desc())\
    .limit(20).all()

# Chỉ lấy 6 tin nhắn gần nhất — đủ để maintain conversation context
recent_chat_cursor = chat_collection.find(...).sort("timestamp", -1).limit(6)
```

**Tính toán token impact:**
- 20 giao dịch × ~30 tokens/tx = ~600 tokens
- 6 chat messages × ~50 tokens/msg = ~300 tokens
- Wallets + Categories = ~200 tokens
- System prompt = ~800 tokens
- **Tổng: ~1,900 tokens/RAG request** — cực kỳ tiết kiệm so với context window 1M tokens

### 8.3 JSON Mode cho Budget Template

Dùng `response_mime_type="application/json"` có hai lợi ích tối ưu chi phí:
1. **Giảm output tokens:** Gemini không sinh ra markdown fences, chú thích thừa
2. **Tránh retry do parse error:** Output luôn là valid JSON → không cần gọi lại khi JSONDecodeError

### 8.4 Lazy Model Initialization

```python
def _get_model(self):
    return genai.GenerativeModel(self.primary_model_name)
```

Model không được khởi tạo khi server start — chỉ được tạo khi có request thực sự. Điều này:
- Không giữ connection với Google API ở trạng thái idle
- Không ảnh hưởng server startup time
- Dễ thay đổi model name tại runtime nếu cần

### 8.5 Graceful Degradation khi MongoDB không kết nối được

```python
# backend/app/db/mongodb.py
try:
    client = MongoClient(MONGO_URI)
    mongodb = client[MONGO_DB_NAME]
    chat_collection = mongodb["chat_history"]
except Exception as e:
    print(f"❌ Lỗi kết nối MongoDB: {e}")
    chat_collection = None   # ← None thay vì crash
```

```python
# backend/app/services/ai_service.py
def chat_rag(self, db, message, session_id, user_id):
    if chat_collection is None:
        raise RuntimeError("Chưa kết nối được MongoDB")
    # ...
```

Nếu MongoDB không kết nối được, chỉ tính năng chatbot bị ảnh hưởng — toàn bộ các tính năng khác (Smart Input, OCR, Budget) vẫn hoạt động bình thường.

### 8.6 Input Validation trước khi gọi AI

```python
# Validate file type TRƯỚC KHI đọc bytes và gọi Gemini
valid_extensions = ["image/jpeg", "image/png", "image/jpg", "image/webp"]
if file.content_type not in valid_extensions:
    raise HTTPException(status_code=400, detail="Chỉ hỗ trợ JPG, PNG, WEBP.")

# Validate income TRƯỚC KHI gọi budget template
if data.income <= 0:
    raise HTTPException(status_code=400, detail="Thu nhập không hợp lệ.")

# Validate user có ít nhất 1 ví TRƯỚC KHI gọi Smart Input
if not wallets:
    raise ValueError("Bạn cần tạo ít nhất 1 ví tiền trước khi dùng AI.")
```

Mọi validation thất bại đều return HTTP error ngay lập tức mà không tốn bất kỳ API token nào.

---

## 9. Chiến lược Mock AI trong kiểm thử

### 9.1 Vấn đề khi test AI

Nếu test gọi Gemini API thực tế:
- **Chi phí:** Mỗi test run tốn token
- **Tốc độ:** Mỗi call ~1-3s → 15 AI test cases = 15-45s chờ mạng
- **Determinism:** Response AI có thể thay đổi → flaky tests
- **Network dependency:** CI/CD không có GEMINI_API_KEY sẽ fail hoàn toàn

### 9.2 MockGeminiResponse — Lớp giả lập Response

```python
# backend/tests/test_ai_service.py

class MockGeminiResponse:
    """
    Giả lập chính xác cấu trúc response object của google-generativeai SDK.
    AIService chỉ đọc response.text → chỉ cần mock trường này.
    """
    def __init__(self, text: str):
        self.text = text
```

Tại sao không mock toàn bộ `generate_content`? Vì mock chỉ trường `.text` đảm bảo toàn bộ **logic xử lý response** vẫn chạy thực tế — strip markdown fences, json.loads, field validation.

### 9.3 Cơ chế patch `_get_model`

```python
# Patch tại điểm tạo model instance — điểm duy nhất trong toàn bộ AIService
with patch('app.services.ai_service.AIService._get_model') as mock_get_model:
    
    # Tạo model giả hoàn toàn
    mock_model_instance = MagicMock()
    
    # Khi service gọi model.generate_content(prompt) → trả về response giả
    mock_model_instance.generate_content.return_value = MockGeminiResponse(
        mock_json_string   # JSON string y như Gemini thực tế sẽ trả về
    )
    mock_get_model.return_value = mock_model_instance
    
    # Gọi service bình thường — service không biết đang dùng mock
    result = ai_service.parse_natural_language(db_session, "ăn phở 50k", user_id)
```

### 9.4 Mock Data có cấu trúc thực tế

Mock data được thiết kế để **phản ánh chính xác output thực của Gemini** — bao gồm cả markdown fences:

```python
# Smart Input mock — có markdown fence để test strip logic
mock_json_parse = """
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
```
"""

# RAG Chatbot mock — mixed text + JSON (Function Calling)
mock_chat_fc_response = """Tuyệt vời, mình giúp bạn thêm nha
```json
{
    "action": "add_transaction",
    "data": [{"amount": 30000, "transaction_type": "expense",
              "category_id": 1, "wallet_id": 1, "note": "Cà phê"}],
    "reply": "Đã thêm giao dịch vào hệ thống."
}
```"""

# Budget Template mock — pure JSON array (không có fence — simulate JSON Mode)
mock_budget = """
[
    {"category_id": 1, "category_name": "Ăn uống", "amount_limit": 5000000, "description": "Needs 50%"},
    {"category_id": 2, "category_name": "Giải trí", "amount_limit": 3000000, "description": "Wants 30%"},
    {"category_id": 3, "category_name": "Tiết kiệm", "amount_limit": 2000000, "description": "Savings 20%"}
]
"""
```

### 9.5 Multi-layer Mock cho RAG Chatbot

RAG Chatbot cần mock **hai hệ thống ngoài** cùng lúc:

```python
def test_chat_rag(db_session, test_user):
    
    # ── LAYER 1: Mock MongoDB ─────────────────────────────────────────
    with patch('app.services.ai_service.chat_collection') as mock_mongo:
        mock_mongo.insert_one = MagicMock()          # Mock write (lưu message)
        mock_mongo.find.return_value\
            .sort.return_value\
            .limit.return_value = []                  # Mock read (lịch sử rỗng)
        
        # ── LAYER 2: Mock Gemini ──────────────────────────────────────
        with patch('app.services.ai_service.AIService._get_model') as mock_get_model:
            mock_model_instance = MagicMock()
            mock_model_instance.generate_content.return_value = \
                MockGeminiResponse(mock_chat_fc_response)
            mock_get_model.return_value = mock_model_instance
            
            # Gọi service — cả MongoDB và Gemini đều bị mock
            res = ai_service.chat_rag(db_session, "Nhớ thêm 30k cafe", "req-123", user_id)
        
        # Assertions sau khi cả hai context manager đóng
        assert res["action"] == "add_transaction"
        assert res["action_data"][0]["amount"] == 30000
        assert res["session_id"] == "req-123"
        
        # Verify MongoDB được gọi để lưu messages
        assert mock_mongo.insert_one.call_count == 2  # user msg + bot msg
```

### 9.6 OCR Mock — Ba lớp

```python
def test_ocr_receipt():
    
    # ── LAYER 1: Mock PIL Image.open ─────────────────────────────────
    with patch('app.services.ai_service.Image.open'):
        # Không cần file ảnh thực — Image.open không được gọi thực tế
        
        # ── LAYER 2: Mock Gemini ──────────────────────────────────────
        with patch('app.services.ai_service.AIService._get_model') as mock_get_model:
            mock_model_instance = MagicMock()
            mock_model_instance.generate_content.return_value = \
                MockGeminiResponse(mock_ocr_response)
            mock_get_model.return_value = mock_model_instance
            
            # Truyền bytes giả — không có ảnh thực
            res = ai_service.ocr_receipt(b"fake_image_bytes")
            
            assert res["merchant"] == "Highlands Coffee"
            assert res["total"] == 59000
```

### 9.7 Kết quả đạt được với Mock Strategy

| Tiêu chí | Không Mock | Với Mock Strategy |
|----------|-----------|-------------------|
| Thời gian chạy 4 AI test | ~20-60s | < 0.5s |
| Chi phí API | ~$0.001/run | $0.00 |
| Determinism | Không đảm bảo | 100% deterministic |
| CI/CD dependency | Cần GEMINI_API_KEY | Không cần |
| Phạm vi test | Chỉ integration | Business logic đầy đủ |

---

## 10. Ưu điểm tích hợp AI trong IFinance

### 10.1 Giảm Friction trong nhập liệu — Đột phá UX

Nhập liệu là **điểm nghẽn lớn nhất** khiến người dùng bỏ ứng dụng quản lý tài chính. IFinance giải quyết triệt để:

| Phương pháp | Số thao tác | Thời gian ước tính |
|-------------|-------------|-------------------|
| Form thủ công | 6 field × tap/type | ~30-60 giây/giao dịch |
| Smart Input (AI) | Gõ 1 câu | ~5-10 giây |
| OCR (AI) | Chụp 1 ảnh | ~8-15 giây |
| RAG Chat (AI) | Chat tự nhiên | ~10-20 giây |

Với người dùng ghi nhận 5-10 giao dịch/ngày, AI tiết kiệm 3-7 phút nhập liệu mỗi ngày — tương đương ~90 phút/tháng.

### 10.2 Intelligent Category Mapping

Smart Input không yêu cầu người dùng biết tên chính xác danh mục — Gemini tự hiểu semantic và map đúng:

```
"đổ xăng" → Danh mục "Đi lại & Xăng xe"
"lương tháng" → Danh mục "Thu nhập" (income type)
"trả góp xe" → Danh mục "Trả nợ"
"ăn bún bò" → Danh mục "Ăn uống & Nhà hàng"
```

### 10.3 Xử lý Tiếng Việt tự nhiên và Slang tài chính

Gemini 2.5 Flash xử lý tốt đặc thù ngôn ngữ tài chính Việt Nam mà rule-based parsing không làm được:

```
"50k"       → 50,000 VND
"1 củ"      → 1,000,000 VND
"1 chai"    → 100,000 VND (ngữ cảnh tài chính)
"2 tờ"      → 200,000 VND
"tuần trước thứ tư" → date calculation
"hôm qua"   → yesterday's date
```

### 10.4 Contextual Financial Advice

RAG Chatbot không tư vấn generic — mọi câu trả lời đều dựa trên **dữ liệu tài chính thực tế của người dùng**:

```
User: "Tháng này mình tiêu nhiều không?"
Bot: Dựa trên 20 giao dịch gần nhất:
     "Tháng này bạn đã chi 3,450,000đ trong đó: Ăn uống 1,200,000đ (35%),
     Đi lại 800,000đ (23%), Giải trí 650,000đ (19%)..."
```

Đây là tư vấn cá nhân hóa 100% — không có ứng dụng tài chính truyền thống nào làm được mà không cần AI.

### 10.5 Thiết kế Human-in-the-Loop

IFinance không để AI tự động thực hiện giao dịch — luôn có bước xác nhận của người dùng:

```
Smart Input → AI điền form → User kiểm tra → User submit
OCR         → AI đề xuất data → User chỉnh sửa → User submit
RAG Chat    → AI đề xuất txs → Popup xác nhận → User bấm Lưu
```

Pattern này đảm bảo: **AI tăng tốc, người dùng kiểm soát** — không có rủi ro AI ghi sai giao dịch mà không có cách phát hiện.

### 10.6 Kiến trúc AI dễ mở rộng

Toàn bộ AI logic tập trung trong một lớp `AIService` với phương thức `_get_model()` có thể swap:

```python
# Hiện tại
self.primary_model_name = 'models/gemini-2.5-flash'

# Trong tương lai — chỉ cần đổi 1 dòng:
self.primary_model_name = 'models/gemini-2.0-pro'
# hoặc implement multi-model routing
# hoặc thêm fallback model khi primary quota exceeded
```

Tương tự, thêm tính năng AI mới (phân tích đầu tư, dự báo chi tiêu) chỉ cần thêm method vào `AIService` — không ảnh hưởng các module khác.

### 10.7 Tổng hợp: AI làm tăng giá trị cho toàn bộ hệ thống

```
                    GIÁ TRỊ AI TRONG IFINANCE
                    
    Data Entry          Analysis            Automation
    ──────────          ────────            ──────────
    Smart Input    →    RAG Chatbot    →    Function Calling
    OCR Receipt    →    Budget AI      →    Auto Transaction Save
    
         ▲                  ▲                    ▲
         │                  │                    │
    Giảm friction      Tư vấn cá nhân      Hành động thực tế
    (5x nhanh hơn)     (context-aware)     (human-confirmed)
```

---

## Phụ lục A: Bảng tổng hợp kỹ thuật AI

| Chức năng | Method | Gemini Input | Output Format | DB Read | DB Write | Rate Limit |
|-----------|--------|-------------|---------------|---------|----------|------------|
| Smart Input | `parse_natural_language` | Text only | JSON (transactions[]) | PostgreSQL | — | 5/min |
| OCR | `ocr_receipt` | Text + Image | JSON (merchant, total...) | — | — | 3/min |
| RAG Chatbot | `chat_rag` | Text (RAG prompt) | Text OR JSON action | PostgreSQL + MongoDB | MongoDB | 10/min |
| Budget AI | `generate_budget_template` | Text (JSON Mode) | JSON array (budgets[]) | PostgreSQL | — | — |

---

## Phụ lục B: Cấu trúc Prompt của từng chức năng

| Chức năng | Cấu trúc Prompt | GenerationConfig |
|-----------|----------------|-----------------|
| Smart Input | Role + User wallets + Categories + Rules + JSON schema | Default |
| OCR | Role + Extraction rules + JSON schema | Default |
| RAG Chatbot | Role + 20 txs + Wallets + Categories + 6 chat msgs + Conditional rules | Default |
| Budget AI | Role + Income + Template type + Categories + JSON requirement | `response_mime_type="application/json"`, `temperature=0.2` |

---

*Tài liệu này được viết dựa trên phân tích trực tiếp mã nguồn `backend/app/services/ai_service.py`, `backend/app/api/v1/routers/ai.py`, `frontend/src/pages/AIChat/AIChat.jsx`, và `frontend/src/pages/Transactions/AddTransaction.jsx`.*
