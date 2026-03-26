import os
import json
import re
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

# Load file .env và cấu hình API Key cho Gemini
load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    raise RuntimeError("Chưa cấu hình GEMINI_API_KEY trong file .env")

genai.configure(api_key=api_key)

router = APIRouter()

# ==========================================
# SCHEMAS (Đầu vào từ Frontend)
# ==========================================
class AIParseRequest(BaseModel):
    text: str

class AIChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None


# ==========================================
# 1. TÍNH NĂNG SMART INPUT (Hỗ trợ câu phức)
# Endpoint thực tế: POST /api/v1/ai/parse
# ==========================================
@router.post("/parse")
def parse_natural_language(
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
def ocr_receipt(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    # Khung (Placeholder) cho tính năng OCR
    return {
        "status": "success",
        "data": {
            "merchant": "Trích xuất mẫu",
            "total": 0,
            "date": "2026-03-26",
            "items": [],
            "ocr_data": {}
        }
    }


# ==========================================
# 3. TÍNH NĂNG AI CHATBOT (Trợ lý ảo RAG)
# Endpoint thực tế: POST /api/v1/ai/chat
# ==========================================
@router.post("/chat")
def chat_with_ai(
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
        json_match = re.search(r'```json\n(.*?)\n```', res_text, re.DOTALL)
        if json_match:
            try:
                action_data = json.loads(json_match.group(1).strip())
                if action_data.get("action") == "add_transaction":
                    raw_data = action_data.get("data")

                    # Ép kiểu dữ liệu về dạng Mảng (List) để xử lý một hoặc nhiều giao dịch
                    tx_list = []
                    if isinstance(raw_data, dict):
                        tx_list = [raw_data]  # Nếu AI trả 1 object -> Bọc nó vào mảng
                    elif isinstance(raw_data, list):
                        tx_list = raw_data  # Nếu AI trả mảng -> Giữ nguyên

                    # Duyệt qua từng giao dịch và lưu vào Database
                    for tx_data in tx_list:
                        new_tx = Transaction(
                            user_id=current_user.user_id,
                            wallet_id=tx_data["wallet_id"],
                            category_id=tx_data["category_id"],
                            amount=tx_data["amount"],
                            transaction_type=tx_data["transaction_type"],
                            note=tx_data.get("note", ""),
                            date=datetime.utcnow().date()
                        )
                        db.add(new_tx)

                    db.commit()  # Lưu tất cả cùng lúc

                    # Đổi câu trả lời thành câu reply nằm trong JSON
                    bot_reply = action_data.get("reply", "Đã lưu giao dịch thành công!")
                    print(f"✅ AI đã tự động thêm {len(tx_list)} giao dịch vào DB!")
            except Exception as e:
                db.rollback()
                print(f"Lỗi khi AI lưu giao dịch: {e}")
                bot_reply = "Mình hiểu bạn muốn thêm giao dịch, nhưng có lỗi xảy ra khi lưu vào hệ thống. Vui lòng thử lại sau nhé!"

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

    return {
        "status": "success",
        "data": {
            "reply": bot_reply,
            "session_id": session_id
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