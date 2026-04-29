import React, { useState, useEffect } from 'react';
import { Target, AlertTriangle, Plus, X, Loader2, Sparkles, TrendingUp, Trash2, Info, Wand2, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import axiosClient from '../../api/axiosClient';
import CurrencyInput from '../../components/CurrencyInput';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as BarTooltip, ResponsiveContainer, Legend } from 'recharts';

const formatCurrency = (amount) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

// Hàm parse tiền để đảm bảo an toàn khi xử lý số liệu
const parseCurrency = (value) => {
    if (!value) return 0;
    return Number(value.toString().replace(/[^0-9]/g, ''));
};

export default function Budgets() {
  const [budgets, setBudgets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // States cho Modal Thêm/Sửa Ngân sách thủ công
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    category_id: '',
    amount_limit: '',
    is_rollover: false
  });

  // States cho Gợi ý AI (AI Recommendation từng danh mục)
  const [recommendation, setRecommendation] = useState(null);
  const [isFetchingRec, setIsFetchingRec] = useState(false);

  // ==========================================
  // STATES CHO AI SMART BUDGET TEMPLATE
  // ==========================================
  const [isSmartModalOpen, setIsSmartModalOpen] = useState(false);
  const [isFetchingSmart, setIsFetchingSmart] = useState(false);
  const [smartData, setSmartData] = useState({ income: '', template_type: '50_30_20' });
  const [smartPreview, setSmartPreview] = useState([]);

  // States cho Modal Biểu đồ Trend
  const [trendModal, setTrendModal] = useState({
    isOpen: false,
    budgetName: '',
    data: [],
    isLoading: false
  });

  const fetchBudgets = async () => {
    try {
      const res = await axiosClient.get('/budgets/progress?period=monthly');
      const data = res.data || [];
      setBudgets(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Lỗi tải ngân sách:", error);
      toast.error("Không thể tải danh sách ngân sách");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await axiosClient.get('/categories/');
      const data = res.data || res;
      const expenseCats = Array.isArray(data) ? data.filter(c => c.type === 'expense') : [];
      setCategories(expenseCats);
    } catch (error) {
      console.error("Lỗi tải danh mục:", error);
    }
  };

  useEffect(() => {
    fetchBudgets();
    fetchCategories();
  }, []);

  const handleCategoryChange = async (categoryId) => {
    setFormData({ ...formData, category_id: categoryId });
    setRecommendation(null);
    if (!categoryId) return;

    setIsFetchingRec(true);
    try {
      const res = await axiosClient.get(`/budgets/recommendation?category_id=${categoryId}`);
      setRecommendation(res.data);
    } catch (error) {
      console.error("Lỗi lấy gợi ý:", error);
    } finally {
      setIsFetchingRec(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.category_id || !formData.amount_limit) {
      return toast.error("Vui lòng nhập đầy đủ thông tin!");
    }

    setIsSubmitting(true);
    const date = new Date();
    const start_date = new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
    const end_date = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];

    const payload = {
      category_id: Number(formData.category_id),
      amount_limit: parseCurrency(formData.amount_limit),
      period: "monthly",
      start_date: start_date,
      end_date: end_date,
      is_rollover: formData.is_rollover
    };

    const submitPromise = axiosClient.post('/budgets/', payload);

    toast.promise(submitPromise, {
      loading: 'Đang thiết lập ngân sách...',
      success: 'Lưu ngân sách thành công! 🎯',
      error: 'Không thể thiết lập ngân sách.'
    });

    try {
      await submitPromise;
      setIsModalOpen(false);
      setFormData({ category_id: '', amount_limit: '', is_rollover: false });
      setRecommendation(null);
      fetchBudgets();
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (budgetId, categoryName) => {
      if (!window.confirm(`Bạn có chắc chắn muốn xóa ngân sách "${categoryName}" không?`)) return;

      try {
          await axiosClient.delete(`/budgets/${budgetId}`);
          toast.success("Đã xóa ngân sách thành công");
          fetchBudgets();
      } catch (error) {
          toast.error("Lỗi khi xóa ngân sách");
      }
  };

  const openTrendModal = async (categoryId, categoryName) => {
      setTrendModal({ isOpen: true, budgetName: categoryName, data: [], isLoading: true });
      try {
          const res = await axiosClient.get(`/budgets/trend?category_id=${categoryId}&months=6`);
          setTrendModal(prev => ({
              ...prev,
              data: Array.isArray(res.data) ? res.data : [],
              isLoading: false
          }));
      } catch (error) {
          toast.error("Không thể tải dữ liệu biểu đồ");
          setTrendModal(prev => ({ ...prev, isOpen: false }));
      }
  };

  // ==========================================
  // HÀM XỬ LÝ AI SMART BUDGET (FR-06)
  // ==========================================
  const handleGenerateSmartBudget = async (e) => {
      e.preventDefault();
      const incomeVal = parseCurrency(smartData.income);
      if (!incomeVal || incomeVal <= 0) return toast.error("Vui lòng nhập mức thu nhập hợp lệ!");

      setIsFetchingSmart(true);
      const templateName = smartData.template_type === '50_30_20' ? 'Quy tắc 50/30/20' : 'Quy tắc 6 chiếc lọ';

      try {
          const res = await axiosClient.post('/ai/budget-template', {
              income: incomeVal,
              template_type: templateName
          });
          // Trả về JSON mảng ngân sách
          const suggestedData = res.data?.data || res.data;
          if (Array.isArray(suggestedData)) {
              setSmartPreview(suggestedData);
          } else {
              toast.error("Dữ liệu AI trả về không đúng định dạng.");
          }
      } catch (error) {
          toast.error("Lỗi AI: " + (error.response?.data?.detail || "Không thể tạo template lúc này"));
      } finally {
          setIsFetchingSmart(false);
      }
  };

  const handleSaveSmartBudgets = async () => {
      setIsSubmitting(true);
      const date = new Date();
      const start_date = new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
      const end_date = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];

      try {
          // Dùng Promise.all để gọi API Upsert đồng loạt
          const promises = smartPreview.map(budget => {
              return axiosClient.post('/budgets/', {
                  category_id: budget.category_id,
                  amount_limit: budget.amount_limit,
                  period: "monthly",
                  start_date: start_date,
                  end_date: end_date,
                  is_rollover: false
              });
          });

          await Promise.all(promises);
          toast.success(`Đã áp dụng thành công ${smartPreview.length} ngân sách!`);

          // Reset Modal
          setIsSmartModalOpen(false);
          setSmartPreview([]);
          setSmartData({ income: '', template_type: '50_30_20' });
          fetchBudgets();

      } catch (error) {
          toast.error("Có lỗi xảy ra khi lưu một số ngân sách.");
      } finally {
          setIsSubmitting(false);
      }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20 lg:p-8 animate-fade-in">
      <div className="max-w-5xl mx-auto">

        {/* HEADER */}
        <div className="bg-white px-6 py-4 lg:px-6 lg:py-6 lg:mb-8 rounded-none lg:rounded-3xl shadow-sm border border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sticky top-0 z-10 lg:static">
          <div>
            <h2 className="text-xl lg:text-2xl font-bold text-slate-800 flex items-center gap-2">
                <Target className="text-indigo-600" /> Ngân sách tháng này
            </h2>
            <p className="text-gray-500 mt-1 hidden lg:block">Kiểm soát chi tiêu, làm chủ tài chính</p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
              <button
                 onClick={() => setIsSmartModalOpen(true)}
                 className="flex-1 sm:flex-none bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 font-bold shadow-sm transition-colors border border-indigo-100"
              >
                <Wand2 size={20} /> <span className="hidden sm:inline">AI Template</span>
              </button>
              <button
                 onClick={() => {
                    setFormData({ category_id: '', amount_limit: '', is_rollover: false });
                    setRecommendation(null);
                    setIsModalOpen(true);
                 }}
                 className="flex-1 sm:flex-none bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 font-medium shadow-sm transition-colors"
              >
                <Plus size={20} /> <span className="hidden sm:inline">Tạo thủ công</span>
              </button>
          </div>
        </div>

        {/* DANH SÁCH NGÂN SÁCH (TIẾN ĐỘ) */}
        <div className="px-4 lg:px-0 mt-6 lg:mt-0">
          {isLoading ? (
            <div className="flex justify-center items-center py-20 text-indigo-600">
               <Loader2 className="animate-spin" size={40} />
            </div>
          ) : budgets.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-3xl border border-gray-100 text-gray-500 shadow-sm">
              <Target size={56} className="mx-auto text-indigo-200 mb-4" />
              <p className="text-lg font-medium text-slate-700">Chưa có ngân sách nào</p>
              <p className="text-sm mt-1 mb-6">Hãy thiết lập giới hạn chi tiêu để hệ thống gợi ý cho bạn nhé!</p>
              <button onClick={() => setIsSmartModalOpen(true)} className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-sm inline-flex items-center gap-2">
                 <Wand2 size={18} /> Dùng AI tạo tự động
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {budgets.map(budget => {
                const limit = Number(budget.amount_limit);
                const spent = Number(budget.spent);
                const remaining = Number(budget.remaining);
                const safeToSpend = Number(budget.safe_to_spend_per_day);
                const progress = Math.min((spent / limit) * 100, 100);

                const barColor = budget.warning ? 'bg-rose-500' : 'bg-emerald-500';

                return (
                  <div key={budget.budget_id} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all group flex flex-col justify-between">
                    <div>
                        <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 flex items-center justify-center bg-gray-50 rounded-2xl text-xl border border-gray-100 group-hover:bg-indigo-50 transition-colors">
                                {categories.find(c => c.category_id === budget.category_id)?.icon || '📌'}
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                                    {budget.category_name}
                                    {budget.is_rollover && <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full uppercase tracking-wider hidden sm:inline-block">Cộng dồn</span>}
                                </h3>
                                <p className="text-sm font-medium text-gray-500 mt-0.5">Giới hạn: {formatCurrency(limit)}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            {budget.warning && <AlertTriangle className="text-rose-500 animate-pulse bg-rose-50 p-1.5 rounded-lg mr-1" size={32} />}
                            <button onClick={() => openTrendModal(budget.category_id, budget.category_name)} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Xem biểu đồ"><TrendingUp size={18}/></button>
                            <button onClick={() => handleDelete(budget.budget_id, budget.category_name)} className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" title="Xóa"><Trash2 size={18}/></button>
                        </div>
                        </div>

                        <div className="mt-6">
                            <div className="flex justify-between text-sm font-bold mb-2">
                                <span className={budget.warning ? 'text-rose-600' : 'text-slate-700'}>
                                Đã tiêu: {formatCurrency(spent)}
                                </span>
                                <span className={remaining <= 0 ? 'text-rose-500' : 'text-gray-400'}>
                                Còn lại: {remaining > 0 ? formatCurrency(remaining) : '0 ₫'}
                                </span>
                            </div>
                            <div className="w-full bg-gray-100 h-4 rounded-full overflow-hidden shadow-inner">
                                <div className={`h-full rounded-full transition-all duration-1000 ${barColor}`} style={{ width: `${progress}%` }}></div>
                            </div>
                            <p className="text-right text-xs font-semibold text-gray-400 mt-2">{progress.toFixed(1)}%</p>
                        </div>
                    </div>

                    {/* TÍNH NĂNG SAFE-TO-SPEND */}
                    {remaining > 0 && safeToSpend > 0 && (
                        <div className="mt-4 p-3 bg-emerald-50 rounded-xl flex items-start gap-3 border border-emerald-100">
                            <Info className="text-emerald-500 shrink-0 mt-0.5" size={18} />
                            <p className="text-sm text-emerald-700 font-medium leading-relaxed">
                                Gợi ý: Bạn có thể tiêu tối đa <span className="font-bold bg-white px-1.5 py-0.5 rounded shadow-sm mx-0.5">{formatCurrency(safeToSpend)}/ngày</span> từ nay đến cuối tháng để giữ an toàn.
                            </p>
                        </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ========================================== */}
      {/* MODAL AI SMART BUDGET (FR-06) */}
      {/* ========================================== */}
      {isSmartModalOpen && (
         <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
           <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-slide-up flex flex-col max-h-[90vh]">
             <div className="flex justify-between items-center p-5 lg:p-6 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-white">
                <h3 className="font-bold text-xl text-slate-800 flex items-center gap-2">
                   <Wand2 className="text-indigo-600" /> AI Tạo Ngân Sách
                </h3>
                <button onClick={() => { setIsSmartModalOpen(false); setSmartPreview([]); setSmartData({ income: '', template_type: '50_30_20' }); }} className="text-gray-400 hover:text-rose-500 transition-colors bg-white p-2 rounded-full shadow-sm">
                  <X size={20} />
                </button>
             </div>

             <div className="p-5 lg:p-6 overflow-y-auto flex-1">
                 {smartPreview.length === 0 ? (
                     <form onSubmit={handleGenerateSmartBudget} className="space-y-5">
                         <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100 text-sm text-indigo-800 leading-relaxed">
                             <Sparkles size={18} className="inline mr-1 text-indigo-600" />
                             AI sẽ tự động tính toán và phân bổ ngân sách vào các danh mục phù hợp dựa trên thu nhập và quy tắc tài chính bạn chọn.
                         </div>

                         <div>
                             <label className="text-sm font-medium text-gray-700 block mb-1.5">Tổng thu nhập dự kiến (VNĐ)</label>
                             <CurrencyInput
                                 required
                                 value={smartData.income}
                                 onChange={(e) => setSmartData({...smartData, income: e.target.value})}
                                 placeholder="VD: 20.000.000"
                                 className="w-full bg-gray-50 border border-gray-200 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none rounded-xl p-3 text-2xl font-bold text-slate-800"
                             />
                         </div>

                         <div>
                             <label className="text-sm font-medium text-gray-700 block mb-1.5">Quy tắc phân bổ</label>
                             <select
                                 value={smartData.template_type}
                                 onChange={(e) => setSmartData({...smartData, template_type: e.target.value})}
                                 className="w-full bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none rounded-xl p-3 font-medium text-slate-700 cursor-pointer"
                             >
                                 <option value="50_30_20">Quy tắc 50/30/20 (Thiết yếu - Linh hoạt - Tiết kiệm)</option>
                                 <option value="6_jars">Quy tắc 6 chiếc lọ (55-10-10-10-10-5)</option>
                             </select>
                         </div>

                         <button
                             type="submit"
                             disabled={isFetchingSmart}
                             className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 rounded-xl font-bold transition-colors mt-2 shadow-sm shadow-indigo-200 disabled:opacity-70 flex justify-center items-center gap-2"
                         >
                             {isFetchingSmart ? <><Loader2 className="animate-spin" size={20} /> Đang tính toán...</> : 'Bắt đầu phân bổ'}
                         </button>
                     </form>
                 ) : (
                     <div className="space-y-4">
                         <div className="flex items-center justify-between mb-2">
                             <h4 className="font-bold text-slate-800">Kết quả phân bổ AI</h4>
                             <button onClick={() => setSmartPreview([])} className="text-sm text-indigo-600 hover:underline font-medium">Tính toán lại</button>
                         </div>
                         <div className="space-y-3">
                             {smartPreview.map((item, idx) => (
                                 <div key={idx} className="p-4 border border-gray-100 bg-gray-50 rounded-2xl flex justify-between items-center">
                                     <div>
                                         <p className="font-bold text-slate-800">{item.category_name}</p>
                                         <p className="text-xs text-gray-500 mt-1">{item.description}</p>
                                     </div>
                                     <div className="font-bold text-indigo-600 text-lg">
                                         {formatCurrency(item.amount_limit)}
                                     </div>
                                 </div>
                             ))}
                         </div>
                         <button
                             onClick={handleSaveSmartBudgets}
                             disabled={isSubmitting}
                             className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 rounded-xl font-bold transition-colors mt-6 shadow-sm shadow-emerald-200 flex justify-center items-center gap-2"
                         >
                             {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : <><CheckCircle size={20} /> Áp dụng và Lưu</>}
                         </button>
                     </div>
                 )}
             </div>
           </div>
         </div>
      )}

      {/* ========================================== */}
      {/* MODAL THÊM / CẬP NHẬT NGÂN SÁCH (THỦ CÔNG) */}
      {/* ========================================== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-slide-up">

            <div className="flex justify-between items-center p-5 lg:p-6 border-b border-gray-100">
              <h3 className="font-bold text-xl text-slate-800 flex items-center gap-2">
                 <Target className="text-indigo-600" /> Thiết lập Ngân sách
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-rose-500 transition-colors bg-gray-50 p-2 rounded-full">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 lg:p-6 space-y-5">

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Chọn danh mục chi tiêu</label>
                <select
                    required
                    value={formData.category_id}
                    onChange={(e) => handleCategoryChange(e.target.value)}
                    className="w-full bg-white border border-gray-200 focus:ring-2 focus:ring-indigo-500 rounded-xl p-3 text-slate-700 font-medium outline-none cursor-pointer"
                >
                    <option value="" disabled>-- Chọn danh mục --</option>
                    {categories.map(c => (
                        <option key={c.category_id} value={c.category_id}>
                            {c.icon} {c.name}
                        </option>
                    ))}
                </select>
              </div>

              {/* KHU VỰC AI GỢI Ý LỊCH SỬ */}
              {isFetchingRec ? (
                  <div className="flex items-center gap-2 text-indigo-500 text-sm font-medium animate-pulse">
                      <Loader2 size={16} className="animate-spin" /> Đang phân tích lịch sử chi tiêu...
                  </div>
              ) : recommendation && (
                  <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-2xl relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-2 opacity-10"><Sparkles size={40} /></div>
                      <p className="text-sm text-indigo-800 font-medium relative z-10 leading-relaxed">
                          {recommendation.message}
                      </p>
                      {recommendation.recommended_amount > 0 && (
                          <button
                              type="button"
                              onClick={() => setFormData({...formData, amount_limit: recommendation.recommended_amount})}
                              className="mt-3 text-sm font-bold bg-white text-indigo-600 px-3 py-1.5 rounded-lg shadow-sm border border-indigo-100 hover:bg-indigo-600 hover:text-white transition-colors"
                          >
                              Áp dụng mức {formatCurrency(recommendation.recommended_amount)}
                          </button>
                      )}
                  </div>
              )}

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Hạn mức tối đa (VNĐ)</label>
                <CurrencyInput
                    required
                    value={formData.amount_limit}
                    onChange={(e) => setFormData({...formData, amount_limit: e.target.value})}
                    placeholder="VD: 3.000.000"
                    className="w-full bg-gray-50 border border-gray-200 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none rounded-xl p-3 text-2xl font-bold text-slate-800 transition-colors"
                />
                {formData.amount_limit && (
                   <p className="text-xs font-semibold text-emerald-600 mt-2 text-right">
                      ~ {formatCurrency(formData.amount_limit)}
                   </p>
                )}
              </div>

              <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
                  <div className="relative">
                      <input
                          type="checkbox"
                          className="sr-only"
                          checked={formData.is_rollover}
                          onChange={(e) => setFormData({...formData, is_rollover: e.target.checked})}
                      />
                      <div className={`block w-10 h-6 rounded-full transition-colors ${formData.is_rollover ? 'bg-indigo-600' : 'bg-gray-300'}`}></div>
                      <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${formData.is_rollover ? 'translate-x-4' : ''}`}></div>
                  </div>
                  <div className="flex-1 text-sm">
                      <p className="font-bold text-slate-700">Cộng dồn số dư sang tháng sau</p>
                      <p className="text-gray-500 text-xs">Phù hợp cho các quỹ tiết kiệm mục tiêu.</p>
                  </div>
              </label>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 rounded-xl font-bold transition-colors mt-4 shadow-sm shadow-indigo-200 disabled:opacity-70 flex justify-center items-center gap-2"
              >
                {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : 'Lưu Ngân sách'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL BIỂU ĐỒ XU HƯỚNG */}
      {/* ========================================== */}
      {trendModal.isOpen && (
         <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
           <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl animate-slide-up flex flex-col">

              <div className="flex justify-between items-center p-5 lg:p-6 border-b border-gray-100">
                <h3 className="font-bold text-xl text-slate-800 flex items-center gap-2">
                   <TrendingUp className="text-indigo-600" /> Xu hướng chi tiêu: {trendModal.budgetName}
                </h3>
                <button onClick={() => setTrendModal({...trendModal, isOpen: false})} className="text-gray-400 hover:text-rose-500 transition-colors bg-gray-50 p-2 rounded-full">
                  <X size={20} />
                </button>
              </div>

              <div className="p-5 lg:p-6">
                 {trendModal.isLoading ? (
                     <div className="h-64 flex justify-center items-center"><Loader2 className="animate-spin text-indigo-500" size={40}/></div>
                 ) : trendModal.data.length === 0 ? (
                     <div className="h-64 flex justify-center items-center text-gray-400">Không có dữ liệu lịch sử.</div>
                 ) : (
                     <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={trendModal.data} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="month_label" tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} />
                                <YAxis tickFormatter={(value) => `${value / 1000}k`} tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} />
                                <BarTooltip formatter={(value) => formatCurrency(value)} cursor={{fill: '#f8fafc'}} />
                                <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '14px' }}/>
                                <Bar dataKey="limit" name="Hạn mức" fill="#cbd5e1" radius={[4, 4, 0, 0]} barSize={20} />
                                <Bar dataKey="spent" name="Đã tiêu" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                     </div>
                 )}
              </div>
           </div>
         </div>
      )}

    </div>
  );
}