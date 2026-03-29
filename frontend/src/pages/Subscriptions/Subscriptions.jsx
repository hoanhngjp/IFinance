import React, { useState, useEffect } from 'react';
import { Calendar, Plus, X, Loader2, Sparkles, Trash2, Power, RefreshCw, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import axiosClient from '../../api/axiosClient';
import CurrencyInput from '../../components/CurrencyInput';

const formatCurrency = (amount) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

// Hàm bóc tách dữ liệu an toàn tương thích với interceptor của bạn
const extractData = (res) => {
    if (res && Array.isArray(res.data)) return res.data;
    if (Array.isArray(res)) return res;
    return [];
};

export default function Subscriptions() {
  const [subs, setSubs] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // States cho Modal & Form
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    amount: '',
    frequency: 'monthly',
    default_wallet_id: '',
    category_id: '',
    next_due_date: new Date().toISOString().split('T')[0]
  });

  // States cho AI Suggestion
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [isDetectingAI, setIsDetectingAI] = useState(false);

  const fetchData = async () => {
    try {
      const [subsRes, walletsRes, catsRes] = await Promise.all([
        axiosClient.get('/subscriptions/?active=true'),
        axiosClient.get('/wallets/'),
        axiosClient.get('/categories/')
      ]);

      // Áp dụng hàm bóc tách an toàn để chống lỗi
      setSubs(extractData(subsRes));
      setWallets(extractData(walletsRes));
      setCategories(extractData(catsRes));
    } catch (error) {
      toast.error("Không thể tải dữ liệu đăng ký");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Gọi API AI Detect
  const handleDetectAI = async () => {
    setIsDetectingAI(true);
    setAiSuggestions([]);
    try {
      const res = await axiosClient.get('/subscriptions/detect/ai');
      const data = extractData(res); // Bóc tách an toàn

      setAiSuggestions(data);
      if (data.length === 0) toast.success("AI: Chưa phát hiện khoản chi định kỳ nào mới.");
    } catch (error) {
      toast.error("Lỗi khi phân tích dữ liệu AI");
    } finally {
      setIsDetectingAI(false);
    }
  };

  // Áp dụng gợi ý của AI vào Form
  const applySuggestion = (suggestion) => {
    setFormData({
      ...formData,
      name: `Gói ${suggestion.category_name} (AI gợi ý)`,
      amount: suggestion.suggested_amount,
      category_id: suggestion.category_id,
      next_due_date: new Date().toISOString().split('T')[0]
    });
    setAiSuggestions([]); // Đóng gợi ý
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    const payload = {
        ...formData,
        amount: Number(formData.amount),
        default_wallet_id: Number(formData.default_wallet_id),
        category_id: Number(formData.category_id)
    };

    const promise = axiosClient.post('/subscriptions/', payload);

    toast.promise(promise, {
      loading: 'Đang lưu gói đăng ký...',
      success: 'Đã thêm đăng ký định kỳ! 🔄',
      error: 'Không thể thêm gói đăng ký'
    });

    try {
      await promise;
      setIsModalOpen(false);
      setFormData({ name: '', amount: '', frequency: 'monthly', default_wallet_id: '', category_id: '', next_due_date: new Date().toISOString().split('T')[0] });
      fetchData();
    } catch (error) {} finally { setIsSubmitting(false); }
  };

  const handleToggleActive = async (subId, currentStatus) => {
    try {
        await axiosClient.put(`/subscriptions/${subId}`, { is_active: !currentStatus });
        toast.success(currentStatus ? 'Đã tạm dừng gói' : 'Đã kích hoạt lại gói');
        fetchData();
    } catch (error) {
        toast.error('Lỗi cập nhật trạng thái');
    }
  };

  const handleDelete = async (subId, subName) => {
      if (!window.confirm(`Bạn có chắc muốn HỦY gói "${subName}" không? (Lịch sử thanh toán cũ vẫn sẽ được giữ lại)`)) return;
      try {
          await axiosClient.delete(`/subscriptions/${subId}`);
          toast.success("Đã hủy gói thành công");
          fetchData();
      } catch (error) {
          toast.error("Lỗi khi hủy gói");
      }
  };

  if (isLoading) return <div className="flex justify-center items-center h-screen text-indigo-600"><Loader2 className="animate-spin" size={40} /></div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-24 lg:p-8 animate-fade-in">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* HEADER */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center bg-white p-6 rounded-3xl shadow-sm border border-gray-100 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <RefreshCw className="text-indigo-600" /> Đăng ký định kỳ
            </h1>
            <p className="text-gray-500 mt-1">Quản lý các khoản phí tự động hàng tháng (Netflix, Spotify...)</p>
          </div>
          <div className="flex gap-3 w-full lg:w-auto">
              <button
                onClick={handleDetectAI} disabled={isDetectingAI}
                className="flex-1 lg:flex-none bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-4 py-2.5 rounded-2xl flex items-center justify-center gap-2 font-bold transition-all disabled:opacity-50"
              >
                {isDetectingAI ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />} <span className="hidden sm:inline">AI Quét</span>
              </button>
              <button onClick={() => setIsModalOpen(true)} className="flex-1 lg:flex-none bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-2xl flex items-center justify-center gap-2 font-bold transition-all shadow-sm">
                <Plus size={20} /> <span className="hidden sm:inline">Thêm mới</span>
              </button>
          </div>
        </div>

        {/* AI SUGGESTIONS BANNER */}
        {aiSuggestions.length > 0 && (
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-6 rounded-3xl shadow-lg text-white animate-slide-up">
                <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="text-yellow-300 animate-pulse" />
                    <h3 className="font-bold text-lg">AI phát hiện {aiSuggestions.length} khoản chi định kỳ tiềm năng!</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {aiSuggestions.map((s, idx) => (
                        <div key={idx} className="bg-white/20 p-4 rounded-2xl backdrop-blur-sm border border-white/30 flex flex-col justify-between">
                            <p className="text-sm font-medium mb-3">"{s.message}"</p>
                            <button onClick={() => applySuggestion(s)} className="w-full bg-white text-indigo-700 font-bold py-2 rounded-xl hover:bg-indigo-50 transition-colors flex justify-center items-center gap-2">
                                <CheckCircle2 size={18} /> Thêm vào danh sách
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* LIST */}
        {subs.length === 0 ? (
            <div className="py-20 bg-white rounded-3xl border border-dashed border-gray-200 text-center text-gray-400">
                Chưa có gói đăng ký định kỳ nào. Bạn có thể tự thêm hoặc dùng AI để quét lịch sử!
            </div>
        ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {subs.map(sub => (
                <div key={sub.subscription_id} className={`bg-white p-6 rounded-3xl border shadow-sm transition-all relative group ${sub.is_active ? 'border-gray-100 hover:shadow-md' : 'border-gray-200 opacity-60'}`}>

                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 flex justify-center items-center rounded-2xl text-xl ${sub.is_active ? 'bg-indigo-50 text-indigo-600' : 'bg-gray-100 text-gray-400'}`}>
                          {categories.find(c => c.category_id === sub.category_id)?.icon || '🔄'}
                      </div>
                      <div>
                        <h3 className={`font-bold text-lg ${sub.is_active ? 'text-slate-800' : 'text-gray-500 line-through'}`}>{sub.name}</h3>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{sub.frequency === 'monthly' ? 'Hàng tháng' : 'Hàng năm'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="mb-5">
                    <span className={`text-2xl font-bold ${sub.is_active ? 'text-slate-800' : 'text-gray-500'}`}>{formatCurrency(sub.amount)}</span>
                  </div>

                  <div className="flex items-center justify-between border-t border-gray-50 pt-5">
                    <div className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg ${sub.is_active ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'bg-gray-100 text-gray-500'}`}>
                      {sub.is_active ? (
                          <><Calendar size={14} /> Tới hạn: {new Date(sub.next_due_date).toLocaleDateString('vi-VN')}</>
                      ) : (
                          <><Power size={14} /> Đang tạm dừng</>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Nút Toggle Bật/Tắt */}
                        <label className="relative inline-flex items-center cursor-pointer" title={sub.is_active ? 'Tạm dừng gói' : 'Kích hoạt lại'}>
                            <input type="checkbox" className="sr-only peer" checked={sub.is_active} onChange={() => handleToggleActive(sub.subscription_id, sub.is_active)} />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                        </label>

                        {/* Nút Xóa */}
                        <button onClick={() => handleDelete(sub.subscription_id, sub.name)} className="p-1.5 text-gray-400 hover:text-rose-500 transition-colors bg-gray-50 rounded-lg hover:bg-rose-50 ml-1">
                            <Trash2 size={16} />
                        </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
        )}
      </div>

      {/* MODAL THÊM MỚI */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-slide-up">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                <h3 className="font-bold text-xl text-slate-800">Thêm gói định kỳ</h3>
                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-rose-500 bg-gray-50 p-2 rounded-full"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Tên dịch vụ</label>
                  <input type="text" required value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" placeholder="VD: Netflix, Tiền điện, Gym..." />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Số tiền thanh toán</label>
                <CurrencyInput required value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-2xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500" placeholder="0" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                  <div>
                      <label className="text-sm font-medium text-gray-700 block mb-1">Chu kỳ</label>
                      <select required value={formData.frequency} onChange={(e) => setFormData({...formData, frequency: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none cursor-pointer">
                          <option value="monthly">Hàng tháng</option>
                          <option value="yearly">Hàng năm</option>
                      </select>
                  </div>
                  <div>
                      <label className="text-sm font-medium text-gray-700 block mb-1">Kỳ thanh toán tới</label>
                      <input type="date" required value={formData.next_due_date} onChange={(e) => setFormData({...formData, next_due_date: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none cursor-pointer" />
                  </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Danh mục hạch toán</label>
                <select required value={formData.category_id} onChange={(e) => setFormData({...formData, category_id: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none cursor-pointer">
                    <option value="">-- Chọn danh mục --</option>
                    {categories.filter(c => c.type === 'expense').map(c => <option key={c.category_id} value={c.category_id}>{c.icon} {c.name}</option>)}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Ví thanh toán mặc định</label>
                <select required value={formData.default_wallet_id} onChange={(e) => setFormData({...formData, default_wallet_id: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none cursor-pointer">
                    <option value="">-- Chọn ví --</option>
                    {wallets.map(w => <option key={w.wallet_id} value={w.wallet_id}>{w.name} (Dư: {formatCurrency(w.balance)})</option>)}
                </select>
              </div>

              <button disabled={isSubmitting} className="w-full bg-indigo-600 text-white py-3.5 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex justify-center items-center gap-2 mt-2">
                {isSubmitting ? <Loader2 className="animate-spin" /> : 'Lưu Gói Đăng Ký'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}