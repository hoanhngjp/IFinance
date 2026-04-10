import os
import json
import re
import io
import uuid
from datetime import datetime
from PIL import Image
import google.generativeai as genai
from sqlalchemy.orm import Session
from dotenv import load_dotenv

from app.db.mongodb import chat_collection
from app.models.wallet_category import Wallet, Category
from app.models.transaction import Transaction

load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")
if api_key:
    genai.configure(api_key=api_key)

class AIService:
    def __init__(self):
        self.primary_model_name = 'models/gemini-2.5-flash'

    def _get_model(self):
        return genai.GenerativeModel(self.primary_model_name)

    def parse_natural_language(self, db: Session, text: str, user_id: int):
        wallets = db.query(Wallet).filter(Wallet.user_id == user_id).all()
        categories = db.query(Category).filter(
            (Category.user_id == user_id) | (Category.user_id == None)
        ).all()

        if not wallets:
            raise ValueError("Bạn cần tạo ít nhất 1 ví tiền trước khi dùng AI.")

        wallet_list = [{"id": w.wallet_id, "name": w.name} for w in wallets]
        category_list = [{"id": c.category_id, "name": c.name, "type": c.type.name} for c in categories]

        prompt = f"""
        Bạn là một trợ lý tài chính cá nhân thông minh. Nhiệm vụ của bạn là phân tích câu văn của người dùng, 
        bóc tách TẤT CẢ các giao dịch có trong câu và trả về định dạng JSON nghiêm ngặt.
        KHÔNG trả về bất kỳ văn bản nào khác ngoài JSON.

        Câu của người dùng: "{text}"

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
                }}
            ]
        }}
        """

        try:
            model = self._get_model()
            response = model.generate_content(prompt)
            res_text = response.text.strip()
            
            if res_text.startswith("```json"):
                res_text = res_text[7:-3].strip()
            elif res_text.startswith("```"):
                res_text = res_text[3:-3].strip()

            result_json = json.loads(res_text)

            if "transactions" not in result_json:
                result_json = {"transactions": [result_json]}

            return result_json
            
        except json.JSONDecodeError:
            raise ValueError("AI trả về sai định dạng dữ liệu.")
        except Exception as e:
            raise RuntimeError(f"Hệ thống AI tạm thời gián đoạn: {str(e)}")

    def ocr_receipt(self, file_bytes: bytes):
        try:
            img = Image.open(io.BytesIO(file_bytes))
        except Exception:
            raise ValueError("Không thể đọc được ảnh. File có thể bị hỏng.")

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
                {{ "name": "Phin Sữa Đá", "quantity": 1, "price": 29000 }}
            ],
            "ocr_data": {{
                "raw_text": "Trích xuất 1-2 dòng text thô nổi bật trên hóa đơn để tham chiếu"
            }}
        }}
        ```
        """

        try:
            model = self._get_model()
            response = model.generate_content([prompt, img])
            res_text = response.text.strip()

            json_match = re.search(r'```json\n(.*?)\n```', res_text, re.DOTALL)
            if json_match:
                res_text = json_match.group(1).strip()
            elif res_text.startswith("```"):
                res_text = res_text[3:-3].strip()

            result_json = json.loads(res_text)
            return result_json

        except json.JSONDecodeError:
            raise ValueError("AI phân tích thành công nhưng định dạng dữ liệu không chuẩn. Vui lòng thử lại.")
        except Exception as e:
            raise RuntimeError("Không thể quét hóa đơn này. Vui lòng thử chụp lại rõ nét hơn nhé.")

    def chat_rag(self, db: Session, message: str, session_id: str, user_id: int):
        if chat_collection is None:
            raise RuntimeError("Chưa kết nối được MongoDB")

        session_id = session_id or str(uuid.uuid4())

        user_msg = {
            "session_id": session_id,
            "user_id": user_id,
            "sender": "user",
            "text": message,
            "timestamp": datetime.utcnow()
        }
        chat_collection.insert_one(user_msg)

        recent_txs = db.query(Transaction).filter(Transaction.user_id == user_id).order_by(
            Transaction.date.desc()).limit(20).all()
        tx_data_str = "\n".join([
                                    f"- Ngày {tx.date}: {'Chi phí' if tx.transaction_type == 'expense' else 'Thu nhập'} {tx.amount}đ cho {tx.category.name if tx.category else 'Khác'} (Note: {tx.note})"
                                    for tx in recent_txs]) if recent_txs else "Chưa có giao dịch."

        recent_chat_cursor = chat_collection.find({"session_id": session_id, "user_id": user_id}).sort(
            "timestamp", -1).limit(6)
        chat_history_str = "\n".join([f"{'Người dùng' if msg['sender'] == 'user' else 'IFinance'}: {msg['text']}" for msg in
                                      reversed(list(recent_chat_cursor))])

        wallets = db.query(Wallet).filter(Wallet.user_id == user_id).all()
        categories = db.query(Category).filter(
            (Category.user_id == user_id) | (Category.user_id == None)).all()

        wallet_list = [{"id": w.wallet_id, "name": w.name} for w in wallets]
        category_list = [{"id": c.category_id, "name": c.name, "type": c.type.name} for c in categories]

        try:
            model = self._get_model()
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
                            }}
                        ],
                        "reply": "Tuyệt vời! Mình đã ghi nhận khoản chi..."
                    }}
                    ```
                    Tuyệt đối không có bất kỳ chữ nào nằm ngoài khối ```json này nếu rơi vào Trường hợp 2.

                    Người dùng vừa nói: "{message}"
                    """

            response = model.generate_content(prompt)
            res_text = response.text.strip()
            bot_reply = res_text

            action_type = None
            extracted_txs = []

            json_match = re.search(r'```json\n(.*?)\n```', res_text, re.DOTALL)
            if json_match:
                try:
                    action_data = json.loads(json_match.group(1).strip())
                    if action_data.get("action") == "add_transaction":
                        raw_data = action_data.get("data")
                        if isinstance(raw_data, dict):
                            extracted_txs = [raw_data]
                        elif isinstance(raw_data, list):
                            extracted_txs = raw_data

                        bot_reply = action_data.get("reply", "Mình đã phân tích được các giao dịch. Bạn hãy kiểm tra và xác nhận bên dưới nhé!")
                        action_type = "add_transaction"
                except Exception:
                    bot_reply = "Mình hiểu bạn muốn thêm giao dịch, nhưng có lỗi xảy ra khi phân tích dữ liệu. Vui lòng thử lại sau nhé!"

        except Exception:
            bot_reply = "Xin lỗi, hệ thống AI đang bận tính toán. Vui lòng thử lại sau nhé!"

        bot_msg = {
            "session_id": session_id,
            "user_id": user_id,
            "sender": "bot",
            "text": bot_reply,
            "timestamp": datetime.utcnow()
        }
        chat_collection.insert_one(bot_msg)

        return {
            "reply": bot_reply,
            "session_id": session_id,
            "action": action_type,
            "action_data": extracted_txs
        }

    def get_chat_history(self, session_id: str, user_id: int):
        if chat_collection is None:
            raise RuntimeError("Chưa kết nối được MongoDB")

        messages_cursor = chat_collection.find(
            {"session_id": session_id, "user_id": user_id}
        ).sort("timestamp", 1)

        history = []
        for msg in messages_cursor:
            history.append({
                "sender": msg["sender"],
                "text": msg["text"],
                "timestamp": msg["timestamp"].isoformat()
            })
        return history

    def generate_budget_template(self, db: Session, income: float, template_type: str, user_id: int):
        categories = db.query(Category).filter(
            Category.type == "expense",
            (Category.user_id == user_id) | (Category.user_id == None)
        ).all()

        cat_list = [{"id": c.category_id, "name": c.name} for c in categories]

        prompt = f"""
        Bạn là một chuyên gia tài chính cá nhân. Người dùng có thu nhập hàng tháng là: {income:,.0f} VND.
        Họ muốn phân bổ số tiền này thành các ngân sách chi tiêu theo quy tắc tài chính: '{template_type}'.
        
        Dưới đây là danh sách các danh mục chi tiêu (ID và Tên) đang có trong hệ thống của người dùng:
        {json.dumps(cat_list, ensure_ascii=False)}

        Nhiệm vụ:
        Hãy tính toán số tiền cụ thể cho từng nhóm của quy tắc. Sau đó, CHỌN 1 category_id phù hợp nhất từ danh sách trên để đại diện cho nhóm đó.

        YÊU CẦU BẮT BUỘC: 
        - Chỉ trả về duy nhất 1 mảng JSON, không có định dạng markdown ```json, không có text thừa.
        - Định dạng: [ {{"category_id": int, "category_name": str, "amount_limit": float, "description": "Lý do ngắn gọn"}} ]
        """

        try:
            model = self._get_model()
            response = model.generate_content(
                prompt,
                generation_config=genai.GenerationConfig(
                    response_mime_type="application/json",
                    temperature=0.2
                )
            )
            suggested_budgets = json.loads(response.text.strip())
            return suggested_budgets
        except Exception as e:
            raise RuntimeError("Không thể tạo gợi ý ngân sách lúc này. Vui lòng thử lại!")

ai_service = AIService()
