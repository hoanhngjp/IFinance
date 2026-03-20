import React, { useState } from 'react';
import { Mic, Camera, Keyboard, MessageSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function AddTransaction() {
  const [inputType, setInputType] = useState('smart');
  const [aiText, setAiText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const navigate = useNavigate();

  const handleAiSubmit = () => {
    if(!aiText) return;
    setIsProcessing(true);
    setTimeout(() => setIsProcessing(false), 1500);
  };

  return (
    // Nền xám trên PC, tự động padding trên PC
    <div className="bg-gray-50 min-h-screen animate-slide-up pb-20 lg:py-10">

      {/* Container giới hạn chiều rộng trên PC */}
      <div className="max-w-2xl mx-auto bg-white lg:rounded-3xl lg:shadow-xl overflow-hidden border-x lg:border border-gray-100">

        <div className="bg-white px-6 py-4 flex items-center justify-between border-b sticky top-0 z-10">
          <h2 className="text-lg font-semibold text-slate-800">Thêm giao dịch</h2>
          <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-indigo-600 font-medium transition-colors">Đóng</button>
        </div>

        <div className="px-6 py-4">
          <div className="flex bg-gray-100 p-1.5 rounded-xl">
            <button onClick={() => setInputType('smart')} className={`flex-1 flex justify-center items-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${inputType === 'smart' ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}><Mic size={18}/> AI NLP</button>
            <button onClick={() => setInputType('ocr')} className={`flex-1 flex justify-center items-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${inputType === 'ocr' ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}><Camera size={18}/> Hóa đơn</button>
            <button onClick={() => setInputType('manual')} className={`flex-1 flex justify-center items-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${inputType === 'manual' ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}><Keyboard size={18}/> Thủ công</button>
          </div>
        </div>

        <div className="px-6 pb-8">
          {inputType === 'smart' && (
            <div className="space-y-4">
              <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl text-sm text-indigo-800 flex items-start gap-3">
                <MessageSquare size={18} className="mt-0.5 flex-shrink-0 text-indigo-600" />
                <p>Ví dụ: "Trưa nay ăn phở 50k thanh toán Momo" hoặc "Mua sách 120 ngàn bằng thẻ tín dụng".</p>
              </div>
              <textarea
                value={aiText} onChange={(e) => setAiText(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-4 h-32 lg:h-40 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none text-lg transition-all"
                placeholder="Nhập hoặc đọc giao dịch của bạn..."
              />
              <button onClick={handleAiSubmit} disabled={isProcessing} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-xl font-semibold disabled:opacity-50 transition-colors">
                {isProcessing ? 'AI Đang phân tích...' : 'Phân tích tự động'}
              </button>
            </div>
          )}
          {inputType === 'ocr' && (
            <div className="border-2 border-dashed border-gray-300 rounded-2xl h-64 lg:h-72 flex flex-col items-center justify-center text-gray-400 bg-gray-50 hover:bg-white hover:border-indigo-400 cursor-pointer transition-all">
              <Camera size={48} className="mb-3 text-gray-300" />
              <p className="font-medium">Chạm để tải lên / Chụp hóa đơn</p>
            </div>
          )}
          {inputType === 'manual' && (
            <div className="space-y-5 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
               <div><label className="text-sm font-medium text-gray-600">Số tiền</label><input type="number" placeholder="0 ₫" className="w-full border-b-2 py-2 text-3xl font-bold focus:outline-none focus:border-indigo-600 transition-colors" /></div>
               <div><label className="text-sm font-medium text-gray-600">Danh mục</label><input type="text" className="w-full bg-gray-50 border border-gray-200 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none rounded-xl p-3 mt-1.5 transition-all" placeholder="Ví dụ: Ăn uống, Mua sắm..." /></div>
               <button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 rounded-xl font-semibold mt-2 transition-colors">Lưu giao dịch</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}