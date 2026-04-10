import pytest
import json
from unittest.mock import patch, MagicMock

from app.services.ai_service import ai_service
from app.models.enums import WalletType
from app.schemas.wallet import WalletCreate
from app.services.wallet_service import wallet_service

# Class giả lập lại cấu trúc Response của Google Gemini API
class MockGeminiResponse:
    def __init__(self, text):
        self.text = text

# ===============================================
# TC-10: AI Trích xuất giao dịch (Natural Language Parsing)
# ===============================================
def test_parse_natural_language(db_session, test_user, test_category):
    # Cần tạo ít nhất 1 ví để vượt qua logic check trong UserService
    w1 = wallet_service.create(db_session, WalletCreate(name="Cash", type=WalletType.cash, initial_balance=0, currency="VND"), test_user.user_id)

    mock_json_bot_talks = """
    ```json
    {
        "transactions": [
            {
                "amount": 50000,
                "transaction_type": "expense",
                "category_id": 1,
                "wallet_id": 1,
                "note": "Ăn phở"
            }
        ]
    }
    ```
    """
    # Xài MagicMock để "bịt mắt" hàm gọi Google Gemini Internet
    with patch('app.services.ai_service.AIService._get_model') as mock_get_model:
        mock_model_instance = MagicMock()
        mock_model_instance.generate_content.return_value = MockGeminiResponse(mock_json_bot_talks)
        mock_get_model.return_value = mock_model_instance
        
        res = ai_service.parse_natural_language(db_session, "sáng nay ăn phở 50k", test_user.user_id)
        
        # Test kiểm chứng AI Service lấy ra Json chuẩn
        assert "transactions" in res
        assert len(res["transactions"]) == 1
        assert res["transactions"][0]["amount"] == 50000
        assert res["transactions"][0]["note"] == "Ăn phở"

# ===============================================
# TC-11: Chatbot RAG (Thêm giao dịch via Chat)  
# ===============================================
def test_chat_rag(db_session, test_user):
    mock_chat_function_calling_response = """Tuyệt vời, mình giúp bạn thêm nha
```json
{
    "action": "add_transaction",
    "data": [
        {
            "amount": 30000,
            "transaction_type": "expense",
            "category_id": 1,
            "wallet_id": 1,
            "note": "Cà phê"
        }
    ],
    "reply": "Đã thêm giao dịch vào hệ thống."
}
```"""
    
    # Ở đây hàm chat_rag sẽ chép Logs vào MongoDB. Ta phải bịt MongoDB lại!
    with patch('app.services.ai_service.chat_collection') as mock_mongo:
        mock_mongo.insert_one = MagicMock()
        mock_mongo.find.return_value.sort.return_value.limit.return_value = [] # Giả sử chưa có lịch sử chat
        
        with patch('app.services.ai_service.AIService._get_model') as mock_get_model:
            mock_model_instance = MagicMock()
            mock_model_instance.generate_content.return_value = MockGeminiResponse(mock_chat_function_calling_response)
            mock_get_model.return_value = mock_model_instance

            # Gọi RAG với câu lệnh tự nhiên
            res = ai_service.chat_rag(db_session, "Nhớ thêm 30k cafe hôm nay", "req-123", test_user.user_id)
            
            assert res["action"] == "add_transaction"
            assert len(res["action_data"]) == 1
            assert res["action_data"][0]["amount"] == 30000
            assert res["action_data"][0]["note"] == "Cà phê"
            assert res["session_id"] == "req-123"

# ===============================================
# TC-12: OCR (Đọc File ảnh biên lai)
# ===============================================
def test_ocr_receipt():
    # File fake return format
    mock_ocr_response = """```json
{
    "merchant": "Highlands Coffee",
    "total": 59000,
    "date": "2026-03-27",
    "items": []
}
```"""
    # Ngăn việc dùng pillow mở ảnh lên báo lỗi byte ảo
    with patch('app.services.ai_service.Image.open'): 
        with patch('app.services.ai_service.AIService._get_model') as mock_get_model:
            mock_model_instance = MagicMock()
            mock_model_instance.generate_content.return_value = MockGeminiResponse(mock_ocr_response)
            mock_get_model.return_value = mock_model_instance

            res = ai_service.ocr_receipt(b"fake_image_bytes")
            assert res["merchant"] == "Highlands Coffee"
            assert res["total"] == 59000

# ===============================================
# TC-13: AI Auto-Generate Budget
# ===============================================
def test_generate_budget_template(db_session, test_user):
    mock_budget_template_res = """
    [
        {"category_id": 1, "category_name": "Ăn uống", "amount_limit": 5000000, "description": "Needs 50%"},
        {"category_id": 2, "category_name": "Giải trí", "amount_limit": 3000000, "description": "Wants 30%"},
        {"category_id": 3, "category_name": "Tiết kiệm", "amount_limit": 2000000, "description": "Savings 20%"}
    ]
    """
    with patch('app.services.ai_service.AIService._get_model') as mock_get_model:
        mock_model_instance = MagicMock()
        mock_model_instance.generate_content.return_value = MockGeminiResponse(mock_budget_template_res)
        mock_get_model.return_value = mock_model_instance

        # User thu nhập 10 củ, muốn dùng rule 50/30/20
        res = ai_service.generate_budget_template(db_session, income=10000000, template_type="50/30/20", user_id=test_user.user_id)
        
        assert len(res) == 3
        assert res[0]["amount_limit"] == 5000000
        assert res[2]["amount_limit"] == 2000000
        assert "50/30/20" in res[1]["description"] or "30%" in res[1]["description"]
