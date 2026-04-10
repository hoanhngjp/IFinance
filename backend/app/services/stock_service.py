import os
import traceback
from typing import Optional
from decimal import Decimal
from vnstock import register_user, Quote
from dotenv import load_dotenv

load_dotenv()

class StockService:
    def __init__(self):
        self.api_key = os.getenv("VNSTOCKS_API_KEY")
        if self.api_key:
            try:
                register_user(api_key=self.api_key)
                print("Đã kích hoạt VNSTOCKS_API_KEY thành công.")
            except Exception as e:
                print(f"Lỗi đăng ký vnstock API key: {e}")

    def get_stock_price(self, ticker: str) -> Optional[Decimal]:
        """
        Lấy giá đóng cửa mới nhất của 1 mã trên thị trường VNĐ
        """
        try:
            quote = Quote(symbol=ticker.upper().strip(), source='KBS')
            # Lấy 5 ngày lịch sử để đảm bảo dính ngày có dữ liệu (loại trừ T7 CN)
            df_history = quote.history(length='5', interval='d')
            
            if df_history is None or df_history.empty:
                return None
            
            # Lấy dòng cuối cùng (ngày gần nhất)
            last_row = df_history.iloc[-1]
            if 'close' in last_row:
                price = float(last_row['close'])
                
                # Sàn chứng khoán thường làm tròn về đv nghìn (vd: 135.5 nghĩa là 135,500đ)
                # Dùng quy tắc nếu giá < 5000 (Ví dụ VNM 65.0 => 65) thì mình quy đổi * 1000 cho khớp Database
                if price < 5000:
                    price = price * 1000
                    
                return Decimal(str(int(price)))
            return None
            
        except Exception as e:
            print(f"Lỗi fetch giá Stock: {e}")
            traceback.print_exc()
            return None

stock_service = StockService()
