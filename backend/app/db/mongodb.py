import os
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "ifinance_db")

try:
    # Khởi tạo kết nối đến MongoDB Atlas
    client = MongoClient(MONGO_URI)

    # Chọn Database
    mongodb = client[MONGO_DB_NAME]

    # Chọn (hoặc tự động tạo) Collection để lưu tin nhắn
    chat_collection = mongodb["chat_history"]

    print("✅ Đã kết nối thành công tới MongoDB Atlas!")
except Exception as e:
    print(f"❌ Lỗi kết nối MongoDB: {e}")
    chat_collection = None