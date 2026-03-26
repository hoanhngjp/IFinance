import React, { useState, useEffect } from 'react';
import { Mic, Camera, Keyboard, ArrowLeft, MessageSquare, Sparkles, UploadCloud, X, ImageIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';

export default function AddTransaction() {
  const navigate = useNavigate();
  const [inputType, setInputType] = useState('smart'); // Đổi mặc định sang tab AI
  const [isProcessing, setIsProcessing] = useState(false);

  // State cho AI Smart Input
  const [aiText, setAiText] = useState('');

  // State cho AI OCR
  const [ocrFile, setOcrFile] = useState(null);
  const [ocrPreview, setOcrPreview] = useState(null);

  // Dữ liệu cho Dropdown
  const [wallets, setWallets] = useState([]);
  const [allCategories, setAllCategories] = useState([]);

  // Form State
  const [formData, setFormData] = useState({
    amount: '',
    category_id: '',
    wallet_id: '',
    date: new Date().toISOString().split('T')[0],
    transaction_type: 'expense',
    note: ''
  });

  useEffect(() => {
    const fetchFormData = async () => {
      try {
        const [walletsRes, categoriesRes] = await Promise.all([
          axiosClient.get('/wallets'),
          axiosClient.get('/categories')
        ]);
        setWallets(walletsRes.data);

        let flatCats = [];
        categoriesRes.data.forEach(c => {
          flatCats.push(c);
          if(c.subcategories) flatCats = [...flatCats, ...c.subcategories];
        });
        setAllCategories(flatCats);

        // Thiết lập giá trị mặc định lúc mới vào trang
        if(walletsRes.data.length > 0) {
           setFormData(prev => ({ ...prev, wallet_id: walletsRes.data[0].wallet_id }));
        }

        const defaultExpenseCats = flatCats.filter(c => c.type === 'expense');
        if(defaultExpenseCats.length > 0) {
           setFormData(prev => ({ ...prev, category_id: defaultExpenseCats[0].category_id }));
        }

      } catch (error) {
        console.error("Lỗi tải form:", error);
      }
    };
    fetchFormData();
  }, []);

  const filteredCategories = allCategories.filter(c => c.type === formData.transaction_type);

  const handleTypeChange = (newType) => {
    const newFilteredCats = allCategories.filter(c => c.type === newType);
    setFormData({
      ...formData,
      transaction_type: newType,
      category_id: newFilteredCats.length > 0 ? newFilteredCats[0].category_id : ''
    });
  };

  // =====================================
  // HÀM XỬ LÝ AI SMART INPUT
  // =====================================
  const handleAiSubmit = async () => {
    if (!aiText.trim()) return;
    setIsProcessing(true);

    try {
      const response = await axiosClient.post('/ai/parse', { text: aiText });
      const aiResult = response.data?.data || response.data;

      if (aiResult && aiResult.transactions && aiResult.transactions.length > 0) {
        // Lấy giao dịch đầu tiên để điền vào form thủ công
        const tx = aiResult.transactions[0];

        setFormData(prev => ({
          ...prev,
          amount: tx.amount || '',
          transaction_type: tx.transaction_type || 'expense',
          category_id: tx.category_id || prev.category_id,
          wallet_id: tx.wallet_id || prev.wallet_id,
          note: tx.note || ''
        }));

        if (aiResult.transactions.length > 1) {
            // Cảnh báo nhẹ nếu AI nhận diện ra nhiều hơn 1 giao dịch
            alert(`AI nhận diện được ${aiResult.transactions.length} giao dịch. Tạm thời đang điền giao dịch đầu tiên vào form để bạn kiểm tra!`);
        }

        setInputType('manual');
        setAiText(''); // Xóa trắng ô nhập
      }
    } catch (error) {
      alert("Lỗi phân tích AI: " + (error.response?.data?.detail || "Vui lòng thử lại"));
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  // =====================================
  // HÀM XỬ LÝ ẢNH & GỌI API OCR
  // =====================================
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setOcrFile(file);
      setOcrPreview(URL.createObjectURL(file));
    }
  };

  const clearImage = () => {
    setOcrFile(null);
    setOcrPreview(null);
  };

  const handleOcrSubmit = async () => {
    if (!ocrFile) return;
    setIsProcessing(true);

    try {
      const formDataToUpload = new FormData();
      formDataToUpload.append('file', ocrFile);

      const response = await axiosClient.post('/ai/ocr', formDataToUpload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const aiResult = response.data?.data || response.data;

      if (aiResult) {
        const { total, merchant, date, items } = aiResult;

        // Tạo câu ghi chú từ dữ liệu OCR
        let noteText = merchant ? `Thanh toán tại ${merchant}` : "Quét hóa đơn";
        if (items && items.length > 0) {
           const itemNames = items.slice(0, 2).map(i => i.name).join(', ');
           noteText += ` (${itemNames}${items.length > 2 ? ',...' : ''})`;
        }

        setFormData(prev => ({
          ...prev,
          amount: total || '',
          transaction_type: 'expense',
          date: date || prev.date,
          note: noteText
        }));

        setInputType('manual');
        clearImage();
      }
    } catch (error) {
      alert("Lỗi quét hóa đơn: " + (error.response?.data?.detail || "Vui lòng thử lại ảnh khác"));
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  // =====================================
  // HÀM LƯU GIAO DỊCH VÀO DATABASE
  // =====================================
  const handleManualSubmit = async (e) => {
    e.preventDefault();
    setIsProcessing(true);
    try {
      await axiosClient.post('/transactions', {
        ...formData,
        amount: Number(formData.amount),
        wallet_id: Number(formData.wallet_id),
        category_id: Number(formData.category_id)
      });
      alert('Đã thêm giao dịch thành công!');
      navigate('/');
    } catch (error) {
      alert('Có lỗi xảy ra, vui lòng kiểm tra lại');
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-gray-50 min-h-screen animate-slide-up pb-20 lg:py-10">
      <div className="max-w-2xl mx-auto bg-white lg:rounded-3xl lg:shadow-xl overflow-hidden border-x lg:border border-gray-100">

        <div className="bg-white px-6 py-4 flex items-center justify-between border-b sticky top-0 z-10">
          <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-indigo-600 transition-colors"><ArrowLeft size={24} /></button>
          <h2 className="text-lg font-semibold text-slate-800">Thêm giao dịch</h2>
          <div className="w-6"></div>
        </div>

        <div className="p-6">
          <div className="flex bg-gray-100 p-1.5 rounded-2xl mb-8">
            <button onClick={() => setInputType('smart')} className={`flex-1 py-2.5 rounded-xl font-medium text-sm flex justify-center items-center gap-2 transition-all ${inputType === 'smart' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><Mic size={18} /> AI Nhập</button>
            <button onClick={() => setInputType('ocr')} className={`flex-1 py-2.5 rounded-xl font-medium text-sm flex justify-center items-center gap-2 transition-all ${inputType === 'ocr' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><Camera size={18} /> Quét HĐ</button>
            <button onClick={() => setInputType('manual')} className={`flex-1 py-2.5 rounded-xl font-medium text-sm flex justify-center items-center gap-2 transition-all ${inputType === 'manual' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><Keyboard size={18} /> Thủ công</button>
          </div>

          {/* TAB THỦ CÔNG */}
          {inputType === 'manual' && (
            <form onSubmit={handleManualSubmit} className="space-y-5 bg-white rounded-2xl animate-fade-in">
               <div className="flex gap-4 mb-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="type" value="expense" checked={formData.transaction_type === 'expense'} onChange={() => handleTypeChange('expense')} className="text-indigo-600 focus:ring-indigo-500 w-4 h-4" />
                    <span className="font-medium text-slate-700">Chi phí (Trừ ví)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="type" value="income" checked={formData.transaction_type === 'income'} onChange={() => handleTypeChange('income')} className="text-indigo-600 focus:ring-indigo-500 w-4 h-4" />
                    <span className="font-medium text-slate-700">Thu nhập (Cộng ví)</span>
                  </label>
               </div>

               <div>
                 <label className="text-sm font-medium text-gray-600">Số tiền</label>
                 <input type="number" required min="1000" value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})} placeholder="Nhập số tiền..." className="w-full border-b-2 border-gray-200 py-2 text-2xl font-bold focus:outline-none focus:border-indigo-600 transition-colors text-slate-800" />
               </div>

               <div className="grid grid-cols-2 gap-4">
                 <div>
                   <label className="text-sm font-medium text-gray-600">Ví tiền</label>
                   <select required value={formData.wallet_id} onChange={(e) => setFormData({...formData, wallet_id: e.target.value})} className="w-full bg-gray-50 border border-gray-200 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none rounded-xl p-3 mt-1.5 transition-all text-slate-700">
                      {wallets.map(w => <option key={w.wallet_id} value={w.wallet_id}>{w.name}</option>)}
                   </select>
                 </div>
                 <div>
                   <label className="text-sm font-medium text-gray-600">Danh mục</label>
                   <select required value={formData.category_id} onChange={(e) => setFormData({...formData, category_id: e.target.value})} className="w-full bg-gray-50 border border-gray-200 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none rounded-xl p-3 mt-1.5 transition-all text-slate-700">
                      {filteredCategories.map(c => <option key={c.category_id} value={c.category_id}>{c.icon} {c.name}</option>)}
                   </select>
                 </div>
               </div>

               <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="text-sm font-medium text-gray-600">Ngày giao dịch</label>
                    <input type="date" required value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} className="w-full bg-gray-50 border border-gray-200 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none rounded-xl p-3 mt-1.5 transition-all text-slate-700" />
                 </div>
                 <div>
                    <label className="text-sm font-medium text-gray-600">Ghi chú</label>
                    <input type="text" value={formData.note} onChange={(e) => setFormData({...formData, note: e.target.value})} placeholder="Vd: Ăn sáng..." className="w-full bg-gray-50 border border-gray-200 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none rounded-xl p-3 mt-1.5 transition-all text-slate-700" />
                 </div>
               </div>

               <button type="submit" disabled={isProcessing} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 rounded-xl font-semibold transition-colors mt-8 shadow-sm shadow-indigo-200 disabled:opacity-70">
                 {isProcessing ? 'Đang lưu...' : 'Lưu giao dịch'}
               </button>
            </form>
          )}

          {/* TAB AI NHẬP */}
          {inputType === 'smart' && (
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4 animate-fade-in">
              <div className="flex items-center gap-2 text-indigo-600 mb-2">
                  <Sparkles size={20} />
                  <h3 className="font-semibold text-lg">Trợ lý AI Điền tự động</h3>
              </div>
              <p className="text-sm text-gray-500">
                Hãy nhập tự nhiên: <br/>
                <span className="italic text-gray-400">"Sáng nay đổ xăng 50k bằng tiền mặt"</span>
              </p>

              <textarea
                  value={aiText}
                  onChange={(e) => setAiText(e.target.value)}
                  placeholder="Nhập câu mô tả giao dịch của bạn vào đây..."
                  className="w-full bg-gray-50 border border-gray-200 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none rounded-xl p-4 min-h-[120px] transition-all resize-none text-slate-700"
              ></textarea>

              <button
                  onClick={handleAiSubmit}
                  disabled={isProcessing || !aiText.trim()}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 rounded-xl font-semibold transition-colors shadow-sm disabled:opacity-70 flex justify-center items-center gap-2"
              >
                {isProcessing ? 'Đang phân tích...' : <><MessageSquare size={18} /> Phân tích ngay</>}
              </button>
            </div>
          )}

          {/* TAB OCR QUÉT HÓA ĐƠN */}
          {inputType === 'ocr' && (
             <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4 animate-fade-in">
              <div className="flex items-center gap-2 text-indigo-600 mb-2">
                  <Camera size={20} />
                  <h3 className="font-semibold text-lg">Quét hóa đơn thông minh</h3>
              </div>
              <p className="text-sm text-gray-500 mb-4">Tải lên ảnh chụp biên lai, hóa đơn. AI sẽ tự động đọc số tiền và thông tin cho bạn.</p>

              {!ocrPreview ? (
                <label className="border-2 border-dashed border-gray-300 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-500 hover:bg-indigo-50 transition-colors group">
                  <div className="w-14 h-14 bg-gray-100 group-hover:bg-indigo-100 text-gray-400 group-hover:text-indigo-600 rounded-full flex items-center justify-center mb-3 transition-colors">
                    <UploadCloud size={28} />
                  </div>
                  <span className="text-sm font-medium text-slate-700">Nhấn để chọn hoặc chụp ảnh</span>
                  <span className="text-xs text-gray-400 mt-1">Hỗ trợ JPG, PNG</span>
                  <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                </label>
              ) : (
                <div className="relative rounded-2xl overflow-hidden border border-gray-200 bg-gray-50 flex justify-center h-[300px]">
                  <img src={ocrPreview} alt="Preview" className="h-full w-auto object-contain" />
                  <button onClick={clearImage} className="absolute top-3 right-3 bg-white text-rose-500 p-1.5 rounded-full shadow-md hover:bg-rose-50 transition-colors">
                    <X size={18} />
                  </button>
                </div>
              )}

              <button
                  onClick={handleOcrSubmit}
                  disabled={isProcessing || !ocrFile}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 rounded-xl font-semibold transition-colors shadow-sm disabled:opacity-70 flex justify-center items-center gap-2 mt-4"
              >
                {isProcessing ? 'AI đang đọc hóa đơn...' : <><ImageIcon size={18} /> Quét và Điền tự động</>}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}