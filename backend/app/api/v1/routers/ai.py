import os
import json
import re
import io
from PIL import Image
import google.generativeai as genai
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from dotenv import load_dotenv

from app.db.database import get_db
from app.models.user import User
from app.models.wallet_category import Wallet, Category
from app.api.deps import get_current_user
from app.models.transaction import Transaction

import uuid
from datetime import datetime
from app.db.mongodb import chat_collection

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Request
from slowapi import Limiter
from slowapi.util import get_remote_address

# Load file .env và cấu hình API Key cho Gemini
load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    raise RuntimeError("Chưa cấu hình GEMINI_API_KEY trong file .env")

genai.configure(api_key=api_key)

limiter = Limiter(key_func=get_remote_address)

router = APIRouter()

# ==========================================
# SCHEMAS (Đầu vào từ Frontend)
# ==========================================
class AIParseRequest(BaseModel):
    text: str

class AIChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None

class AIBudgetTemplateRequest(BaseModel):
    income: float
    template_type: str  # Ví dụ: "50/30/20" hoặc "6_jars" (6 chiếc lọ)


# ==========================================
# 1. TÍNH NĂNG SMART INPUT (Hỗ trợ câu phức)
# Endpoint thực tế: POST /api/v1/ai/parse
# ==========================================
@router.post("/parse")
@limiter.limit("10/minute")
def parse_natural_language(
        request: Request,
        req: AIParseRequest,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    try:
        # 1. Rút trích Ngữ cảnh (Context) của User từ Database
        wallets = db.query(Wallet).filter(Wallet.user_id == current_user.user_id).all()
        categories = db.query(Category).filter(
            (Category.user_id == current_user.user_id) | (Category.user_id == None)
        ).all()

        if not wallets:
            raise HTTPException(status_code=400, detail="Bạn cần tạo ít nhất 1 ví tiền trước khi dùng AI.")

        wallet_list = [{"id": w.wallet_id, "name": w.name} for w in wallets]
        category_list = [{"id": c.category_id, "name": c.name, "type": c.type.name} for c in categories]

        # 2. Xây dựng Prompt (Bắt buộc trả về MẢNG transactions)
        prompt = f"""
        Bạn là một trợ lý tài chính cá nhân thông minh. Nhiệm vụ của bạn là phân tích câu văn của người dùng, 
        bóc tách TẤT CẢ các giao dịch có trong câu và trả về định dạng JSON nghiêm ngặt.
        KHÔNG trả về bất kỳ văn bản nào khác ngoài JSON.

        Câu của người dùng: "{req.text}"

        Danh sách Ví (Wallet) của người dùng:
        {json.dumps(wallet_list, ensure_ascii=False)}

        Danh sách Danh mục (Category) của người dùng:
        {json.dumps(category_list, ensure_ascii=False)}

        Quy tắc phân tích:
        1. amount: Quy đổi ra số nguyên (VD: "50k" -> 50000, "1 củ" -> 1000000).
        2. transaction_type: Trả về "expense" (chi phí) hoặc "income" (thu nhập) dựa trên ngữ nghĩa.
        3. category_id: Tìm ID của danh mục phù hợp nhất trong danh sách trên.
        4. wallet_id: Tìm ID của ví được nhắc đến. Nếu người dùng không nhắc đến ví nào, hãy lấy ID của ví đầu tiên.
        5. note: Tóm tắt ghi chú ngắn gọn.

        Định dạng trả về mong muốn (Luôn chứa mảng "transactions"):
        {{
            "transactions": [
                {{
                    "amount": 50000,
                    "transaction_type": "expense",
                    "category_id": 3,
                    "wallet_id": 1,
                    "note": "Ăn phở"
                }},
                {{
                    "amount": 30000,
                    "transaction_type": "expense",
                    "category_id": 10,
                    "wallet_id": 1,
                    "note": "Đổ xăng"
                }}
            ]
        }}
        """

        # 3. Gọi Google Gemini Model với cơ chế Fallback
        try:
            primary_model = 'models/gemini-2.5-flash'
            print(f"Đang gọi model chính: {primary_model}")
            model = genai.GenerativeModel(primary_model)
            response = model.generate_content(prompt)

        except Exception as primary_error:
            print(f"Model chính gặp lỗi: {primary_error}. Đang kích hoạt cơ chế dự phòng...")
            try:
                available_models = [m.name for m in genai.list_models() if
                                    'generateContent' in m.supported_generation_methods]
                if not available_models:
                    raise Exception("API Key không hỗ trợ bất kỳ model tạo văn bản nào.")

                fallback_model_name = next((m for m in available_models if 'flash' in m), None)
                if not fallback_model_name:
                    fallback_model_name = next((m for m in available_models if 'pro' in m), available_models[0])

                print(f"Đã tìm thấy model dự phòng: {fallback_model_name}")
                model = genai.GenerativeModel(fallback_model_name)
                response = model.generate_content(prompt)

            except Exception as fallback_error:
                raise HTTPException(status_code=500, detail=f"Hệ thống AI tạm thời gián đoạn: {str(fallback_error)}")

        # 4. Tiền xử lý chuỗi trả về
        res_text = response.text.strip()
        if res_text.startswith("```json"):
            res_text = res_text[7:-3].strip()
        elif res_text.startswith("```"):
            res_text = res_text[3:-3].strip()

        result_json = json.loads(res_text)

        # Đảm bảo trả về mảng rỗng nếu AI không phân tích được
        if "transactions" not in result_json:
            result_json = {"transactions": [result_json]}

        return {
            "status": "success",
            "message": "AI phân tích thành công",
            "data": result_json
        }

    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="AI trả về sai định dạng dữ liệu.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi hệ thống AI: {str(e)}")


# ==========================================
# 2. TÍNH NĂNG OCR (Quét hóa đơn)
# Endpoint thực tế: POST /api/v1/ai/ocr
# ==========================================
@router.post("/ocr")
@limiter.limit("5/minute")
def ocr_receipt(
        request: Request,
        file: UploadFile = File(...),
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    # 1. Kiểm tra file có phải là hình ảnh không
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File không hợp lệ. Vui lòng tải lên một bức ảnh (JPEG, PNG).")

    # 2. Đọc file ảnh thành bộ nhớ đệm
    try:
        image_bytes = file.file.read()
        img = Image.open(io.BytesIO(image_bytes))
    except Exception as e:
        raise HTTPException(status_code=400, detail="Không thể đọc được ảnh. File có thể bị hỏng.")

    # 3. Kịch bản Prompt bóc tách hóa đơn
    prompt = f"""
    Bạn là một chuyên gia AI về bóc tách dữ liệu hóa đơn mua hàng (Receipt OCR).
    Hãy nhìn vào bức ảnh hóa đơn này và trích xuất thông tin thành ĐỊNH DẠNG JSON NGHIÊM NGẶT.
    BẮT BUỘC KHÔNG trả về bất kỳ văn bản nào khác ngoài khối JSON.

    Quy tắc trích xuất:
    1. merchant: Tên cửa hàng, siêu thị, quán cafe (VD: Highlands Coffee, Circle K, Lotte Mart...).
    2. total: Tổng số tiền cuối cùng người dùng phải trả (Chuyển thành số nguyên, VD: 59000).
    3. date: Ngày in trên hóa đơn (Định dạng YYYY-MM-DD). Nếu không thấy rõ, hãy dùng ngày hôm nay là: {datetime.utcnow().date()}
    4. items: Danh sách các món hàng (Tên món, số lượng, đơn giá).

    Cấu trúc JSON mong muốn:
    ```json
    {{
        "merchant": "Highlands Coffee",
        "total": 59000,
        "date": "2026-03-27",
        "items": [
            {{ "name": "Phin Sữa Đá", "quantity": 1, "price": 29000 }},
            {{ "name": "Trà Sen Vàng", "quantity": 1, "price": 30000 }}
        ],
        "ocr_data": {{
            "raw_text": "Trích xuất 1-2 dòng text thô nổi bật trên hóa đơn để tham chiếu"
        }}
    }}
    ```
    """

    # 4. Gửi Ảnh + Prompt cho Gemini xử lý
    try:
        print("Đang gửi ảnh hóa đơn cho AI xử lý...")
        model = genai.GenerativeModel('models/gemini-2.5-flash')
        # Gemini nhận vào một mảng chứa cả Text và Hình ảnh
        response = model.generate_content([prompt, img])
        res_text = response.text.strip()

        # Tiền xử lý JSON
        json_match = re.search(r'```json\n(.*?)\n```', res_text, re.DOTALL)
        if json_match:
            res_text = json_match.group(1).strip()
        elif res_text.startswith("```"):
            res_text = res_text[3:-3].strip()

        result_json = json.loads(res_text)

        return {
            "status": "success",
            "message": "Trích xuất hóa đơn thành công",
            "data": result_json
        }

    except json.JSONDecodeError:
        print(f"Lỗi Decode JSON từ OCR: {res_text}")
        raise HTTPException(status_code=500,
                            detail="AI phân tích thành công nhưng định dạng dữ liệu không chuẩn. Vui lòng thử lại.")
    except Exception as e:
        print(f"Lỗi AI OCR: {e}")
        raise HTTPException(status_code=500, detail="Không thể quét hóa đơn này. Vui lòng thử chụp lại rõ nét hơn nhé.")

# ==========================================
# 3. TÍNH NĂNG AI CHATBOT (Trợ lý ảo RAG)
# Endpoint thực tế: POST /api/v1/ai/chat
# ==========================================
@router.post("/chat")
@limiter.limit("15/minute")
def chat_with_ai(
        request: Request,
        req: AIChatRequest,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    if chat_collection is None:
        raise HTTPException(status_code=500, detail="Chưa kết nối được MongoDB")

    session_id = req.session_id or str(uuid.uuid4())

    # 1. Lưu tin nhắn User vào MongoDB
    user_msg = {
        "session_id": session_id,
        "user_id": current_user.user_id,
        "sender": "user",
        "text": req.message,
        "timestamp": datetime.utcnow()
    }
    chat_collection.insert_one(user_msg)

    # 2. RÚT TRÍCH DỮ LIỆU RAG VÀ CONTEXT (Ví, Danh mục)
    # Lấy lịch sử giao dịch & tin nhắn (RAG)
    recent_txs = db.query(Transaction).filter(Transaction.user_id == current_user.user_id).order_by(
        Transaction.date.desc()).limit(20).all()
    tx_data_str = "\n".join([
                                f"- Ngày {tx.date}: {'Chi phí' if tx.transaction_type == 'expense' else 'Thu nhập'} {tx.amount}đ cho {tx.category.name if tx.category else 'Khác'} (Note: {tx.note})"
                                for tx in recent_txs]) if recent_txs else "Chưa có giao dịch."

    recent_chat_cursor = chat_collection.find({"session_id": session_id, "user_id": current_user.user_id}).sort(
        "timestamp", -1).limit(6)
    chat_history_str = "\n".join([f"{'Người dùng' if msg['sender'] == 'user' else 'IFinance'}: {msg['text']}" for msg in
                                  reversed(list(recent_chat_cursor))])

    # Lấy danh sách Ví & Danh mục (Để AI biết ID mà map vào)
    wallets = db.query(Wallet).filter(Wallet.user_id == current_user.user_id).all()
    categories = db.query(Category).filter(
        (Category.user_id == current_user.user_id) | (Category.user_id == None)).all()

    wallet_list = [{"id": w.wallet_id, "name": w.name} for w in wallets]
    category_list = [{"id": c.category_id, "name": c.name, "type": c.type.name} for c in categories]

    # 3. GỌI GEMINI VỚI CHỈ THỊ FUNCTION CALLING
    try:
        model = genai.GenerativeModel('models/gemini-2.5-flash')
        prompt = f"""
                Bạn là IFinance, trợ lý tài chính thông minh.

                [DỮ LIỆU HIỆN TẠI]
                - Giao dịch gần đây: {tx_data_str}
                - Danh sách Ví: {json.dumps(wallet_list, ensure_ascii=False)}
                - Danh sách Danh mục: {json.dumps(category_list, ensure_ascii=False)}
                - Lịch sử chat: {chat_history_str}

                [QUY TẮC PHẢN HỒI BẮT BUỘC]
                TRƯỜNG HỢP 1 - HỎI ĐÁP: Nếu người dùng hỏi thông tin, phân tích, tư vấn -> Trả lời bằng văn bản Markdown bình thường.
                TRƯỜNG HỢP 2 - RA LỆNH THÊM GIAO DỊCH (FUNCTION CALLING): Nếu người dùng yêu cầu THÊM, GHI, NHẬP giao dịch -> Bạn KHÔNG trả lời văn bản, mà BẮT BUỘC chỉ trả về 1 khối JSON duy nhất.

                LƯU Ý ĐẶC BIỆT: NẾU NGƯỜI DÙNG NHẮC ĐẾN NHIỀU GIAO DỊCH CÙNG LÚC, BẮT BUỘC PHẢI TRẢ VỀ TẤT CẢ TRONG MỘT MẢNG `[]` Ở TRƯỜNG `data` NHƯ VÍ DỤ SAU:
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
                        }},
                        {{
                            "amount": 30000,
                            "transaction_type": "expense",
                            "category_id": 2,
                            "wallet_id": 1,
                            "note": "Đổ xăng"
                        }}
                    ],
                    "reply": "Tuyệt vời! Mình đã ghi nhận khoản chi **50.000đ** cho **Ăn phở** và **30.000đ** cho **Đổ xăng** vào hệ thống rồi nhé."
                }}
                ```
                Tuyệt đối không có bất kỳ chữ nào nằm ngoài khối ```json này nếu rơi vào Trường hợp 2.

                Người dùng vừa nói: "{req.message}"
                """

        response = model.generate_content(prompt)
        res_text = response.text.strip()
        bot_reply = res_text

        # 4. XỬ LÝ FUNCTION CALLING (BẮT ACTION TỪ AI)
        action_type = None
        extracted_txs = []

        json_match = re.search(r'```json\n(.*?)\n```', res_text, re.DOTALL)
        if json_match:
            try:
                action_data = json.loads(json_match.group(1).strip())
                if action_data.get("action") == "add_transaction":
                    raw_data = action_data.get("data")

                    # Ép kiểu dữ liệu về dạng Mảng (List)
                    if isinstance(raw_data, dict):
                        extracted_txs = [raw_data]
                    elif isinstance(raw_data, list):
                        extracted_txs = raw_data

                    # KHÔNG GỌI db.commit() Ở ĐÂY NỮA. CHỈ TRẢ DATA VỀ CHO FRONTEND.
                    bot_reply = action_data.get("reply",
                                                "Mình đã phân tích được các giao dịch. Bạn hãy kiểm tra và xác nhận bên dưới nhé!")
                    action_type = "add_transaction"
                    print(f"💡 AI đề xuất thêm {len(extracted_txs)} giao dịch (Đang chờ User xác nhận).")
            except Exception as e:
                print(f"Lỗi khi parse JSON từ AI: {e}")
                bot_reply = "Mình hiểu bạn muốn thêm giao dịch, nhưng có lỗi xảy ra khi phân tích dữ liệu. Vui lòng thử lại sau nhé!"

    except Exception as e:
        print(f"Lỗi gọi Gemini: {e}")
        bot_reply = "Xin lỗi, hệ thống AI đang bận tính toán. Vui lòng thử lại sau nhé!"

    # 5. Lưu câu trả lời của Bot vào MongoDB
    bot_msg = {
        "session_id": session_id,
        "user_id": current_user.user_id,
        "sender": "bot",
        "text": bot_reply,
        "timestamp": datetime.utcnow()
    }
    chat_collection.insert_one(bot_msg)

    # Đóng gói thêm action và action_data để Frontend xử lý
    return {
        "status": "success",
        "data": {
            "reply": bot_reply,
            "session_id": session_id,
            "action": action_type,
            "action_data": extracted_txs
        }
    }

# ==========================================
# 4. LẤY LỊCH SỬ CHATBOT
# Endpoint thực tế: GET /api/v1/ai/chat/{session_id}
# ==========================================
@router.get("/chat/{session_id}")
def get_chat_history(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if chat_collection is None:
        raise HTTPException(status_code=500, detail="Chưa kết nối được MongoDB")

    # Truy vấn MongoDB lấy tất cả tin nhắn của session_id này, sắp xếp theo thời gian cũ -> mới
    messages_cursor = chat_collection.find(
        {"session_id": session_id, "user_id": current_user.user_id}
    ).sort("timestamp", 1)

    # Convert dữ liệu từ MongoDB cursor sang List
    history = []
    for msg in messages_cursor:
        history.append({
            "sender": msg["sender"],
            "text": msg["text"],
            "timestamp": msg["timestamp"].isoformat()
        })

    return {
        "status": "success",
        "data": history
    }


@router.post("/budget-template")
@limiter.limit("5/minute")
def generate_budget_template(
        request: Request,
        req: AIBudgetTemplateRequest,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    # 1. Lấy toàn bộ danh mục "Chi phí" (Expense) của user và hệ thống
    categories = db.query(Category).filter(
        Category.type == "expense",
        (Category.user_id == current_user.user_id) | (Category.user_id == None)
    ).all()

    # Tạo danh sách rút gọn để mớm cho AI
    cat_list = [{"id": c.category_id, "name": c.name} for c in categories]

    # 2. Xây dựng Prompt ép kiểu JSON nghiêm ngặt
    prompt = f"""
    Bạn là một chuyên gia tài chính cá nhân. Người dùng có thu nhập hàng tháng là: {req.income:,.0f} VND.
    Họ muốn phân bổ số tiền này thành các ngân sách chi tiêu theo quy tắc tài chính: '{req.template_type}'.
    (Gợi ý: Nếu là 50/30/20 thì chia 50% Thiết yếu, 30% Linh hoạt, 20% Tiết kiệm/Đầu tư. Nếu là 6 chiếc lọ thì chia theo tỷ lệ 55-10-10-10-10-5).

    Dưới đây là danh sách các danh mục chi tiêu (ID và Tên) đang có trong hệ thống của người dùng:
    {json.dumps(cat_list, ensure_ascii=False)}

    Nhiệm vụ:
    Hãy tính toán số tiền cụ thể cho từng nhóm của quy tắc. Sau đó, CHỌN 1 category_id phù hợp nhất từ danh sách trên để đại diện cho nhóm đó.

    YÊU CẦU BẮT BUỘC: 
    - Chỉ trả về duy nhất 1 mảng JSON, không có định dạng markdown ```json, không có text thừa.
    - Định dạng: [ {{"category_id": int, "category_name": str, "amount_limit": float, "description": "Lý do ngắn gọn"}} ]
    """

    try:
        model = genai.GenerativeModel("gemini-2.5-flash")
        response = model.generate_content(
            prompt,
            generation_config=genai.GenerationConfig(
                response_mime_type="application/json",
                temperature=0.2  # Temperature thấp để AI trả về toán học chính xác, không lan man
            )
        )

        # 3. Parse JSON từ AI
        suggested_budgets = json.loads(response.text.strip())

        return {
            "status": "success",
            "message": f"AI đã gợi ý ngân sách theo quy tắc {req.template_type}",
            "data": suggested_budgets
        }

    except Exception as e:
        print(f"Lỗi AI Budget Template: {e}")
        raise HTTPException(status_code=500, detail="Không thể tạo gợi ý ngân sách lúc này. Vui lòng thử lại!")