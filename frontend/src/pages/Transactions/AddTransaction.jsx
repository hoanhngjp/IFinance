import React, { useState, useEffect } from 'react';
import { Mic, Camera, Keyboard, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';

export default function AddTransaction() {
  const navigate = useNavigate();
  const [inputType, setInputType] = useState('manual');
  const [isProcessing, setIsProcessing] = useState(false);

  // Dữ liệu cho Dropdown
  const [wallets, setWallets] = useState([]);
  const [allCategories, setAllCategories] = useState([]); // Đổi thành lưu TẤT CẢ danh mục

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

  // BIẾN ĐỘNG: Lọc danh mục theo transaction_type hiện tại của form
  const filteredCategories = allCategories.filter(c => c.type === formData.transaction_type);

  // HÀM XỬ LÝ: Khi user chuyển đổi giữa Thu <-> Chi
  const handleTypeChange = (newType) => {
    const newFilteredCats = allCategories.filter(c => c.type === newType);
    setFormData({
      ...formData,
      transaction_type: newType,
      category_id: newFilteredCats.length > 0 ? newFilteredCats[0].category_id : ''
    });
  };

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

          {inputType === 'manual' && (
            <form onSubmit={handleManualSubmit} className="space-y-5 bg-white rounded-2xl">

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
                 <input type="number" required min="1000" value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})} placeholder="Nhập số tiền..." className="w-full border-b-2 border-gray-200 py-2 text-2xl font-bold focus:outline-none focus:border-indigo-600 transition-colors" />
               </div>

               <div className="grid grid-cols-2 gap-4">
                 <div>
                   <label className="text-sm font-medium text-gray-600">Ví tiền</label>
                   <select required value={formData.wallet_id} onChange={(e) => setFormData({...formData, wallet_id: e.target.value})} className="w-full bg-gray-50 border border-gray-200 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none rounded-xl p-3 mt-1.5 transition-all">
                      {wallets.map(w => <option key={w.wallet_id} value={w.wallet_id}>{w.name}</option>)}
                   </select>
                 </div>
                 <div>
                   <label className="text-sm font-medium text-gray-600">Danh mục</label>
                   <select required value={formData.category_id} onChange={(e) => setFormData({...formData, category_id: e.target.value})} className="w-full bg-gray-50 border border-gray-200 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none rounded-xl p-3 mt-1.5 transition-all">
                      {/* Dùng mảng đã lọc */}
                      {filteredCategories.map(c => <option key={c.category_id} value={c.category_id}>{c.icon} {c.name}</option>)}
                   </select>
                 </div>
               </div>

               <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="text-sm font-medium text-gray-600">Ngày giao dịch</label>
                    <input type="date" required value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} className="w-full bg-gray-50 border border-gray-200 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none rounded-xl p-3 mt-1.5 transition-all" />
                 </div>
                 <div>
                    <label className="text-sm font-medium text-gray-600">Ghi chú</label>
                    <input type="text" value={formData.note} onChange={(e) => setFormData({...formData, note: e.target.value})} placeholder="Vd: Ăn sáng..." className="w-full bg-gray-50 border border-gray-200 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none rounded-xl p-3 mt-1.5 transition-all" />
                 </div>
               </div>

               <button type="submit" disabled={isProcessing} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 rounded-xl font-semibold transition-colors mt-8 shadow-sm shadow-indigo-200 disabled:opacity-70">
                 {isProcessing ? 'Đang lưu...' : 'Lưu giao dịch'}
               </button>
            </form>
          )}

          {inputType === 'smart' && (
            <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100 text-center text-indigo-800">
               <p className="font-medium">Tính năng AI Smart Input sẽ được tích hợp ở chặng sau!</p>
            </div>
          )}
          {inputType === 'ocr' && (
             <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200 text-center text-gray-600">
               <p className="font-medium">Tính năng quét Hóa đơn (OCR) đang được xây dựng.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}