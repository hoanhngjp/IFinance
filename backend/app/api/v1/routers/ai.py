from pathlib import Path
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File

from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.user import User
from app.api.deps import get_current_user

# Throttling
from slowapi.util import get_remote_address
from slowapi.extension import Limiter
from fastapi import Request

from app.schemas.ai import AIParseRequest, AIChatRequest, AIBudgetTemplateRequest
from app.services.ai_service import ai_service

limiter = Limiter(key_func=get_remote_address)
router = APIRouter()

@router.post("/parse", response_model=dict)
@limiter.limit("5/minute")
def parse_natural_language(
        request: Request,
        data: AIParseRequest,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    try:
        result_json = ai_service.parse_natural_language(db, data.text, current_user.user_id)
        return {
            "status": "success",
            "message": "Phân tích câu thành công",
            "data": result_json
        }
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except RuntimeError as re:
        raise HTTPException(status_code=503, detail=str(re))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi không xác định: {str(e)}")


@router.post("/ocr", response_model=dict)
@limiter.limit("3/minute")
async def ocr_receipt(
        request: Request,
        file: UploadFile = File(...),
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    valid_content_types = {
        "image/jpeg",
        "image/png",
        "image/jpg",
        "image/webp",
        "image/pjpeg",
        "application/octet-stream",
    }
    valid_extensions = {".jpg", ".jpeg", ".png", ".webp"}
    file_extension = Path(file.filename or "").suffix.lower()

    if file.content_type not in valid_content_types and file_extension not in valid_extensions:
        raise HTTPException(status_code=400, detail="Chỉ hỗ trợ file ảnh định dạng JPG, PNG, WEBP.")

    try:
        file_bytes = await file.read()
        result_json = ai_service.ocr_receipt(file_bytes)
        return {
            "status": "success",
            "message": "Trích xuất hóa đơn thành công",
            "data": result_json
        }
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except RuntimeError as re:
        raise HTTPException(status_code=503, detail=str(re))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi không xác định: {str(e)}")


@router.post("/chat", response_model=dict)
@limiter.limit("10/minute")
def chat_with_ai(
        request: Request,
        data: AIChatRequest,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    try:
        response_data = ai_service.chat_rag(db, data.message, data.session_id, current_user.user_id)
        return {
            "status": "success",
            "data": response_data
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi RAG Chatbot: {str(e)}")


@router.get("/chat/history", response_model=dict)
def get_chat_history(
        session_id: str,
        current_user: User = Depends(get_current_user)
):
    try:
        history = ai_service.get_chat_history(session_id, current_user.user_id)
        return {
            "status": "success",
            "data": {
                "session_id": session_id,
                "history": history
            }
        }
    except RuntimeError as re:
        raise HTTPException(status_code=503, detail=str(re))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/budget-template", response_model=dict)
def generate_budget_template(
        data: AIBudgetTemplateRequest,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    if data.income <= 0:
        raise HTTPException(status_code=400, detail="Thu nhập không hợp lệ.")
    
    try:
        suggested_budgets = ai_service.generate_budget_template(db, data.income, data.template_type, current_user.user_id)
        return {
            "status": "success",
            "message": f"Tạo thành công ngân sách dựa trên quy tắc {data.template_type}",
            "data": suggested_budgets
        }
    except RuntimeError as re:
        raise HTTPException(status_code=503, detail=str(re))
    except Exception as e:
         raise HTTPException(status_code=500, detail=str(e))