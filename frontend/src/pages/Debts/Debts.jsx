import React, { useState, useEffect } from 'react';
import { ArrowDownLeft, ArrowUpRight, Plus, X, Loader2, AlertCircle, Calendar, User as UserIcon, Clock, History } from 'lucide-react';
import toast from 'react-hot-toast';
import axiosClient from '../../api/axiosClient';
import CurrencyInput from '../../components/CurrencyInput';

const formatCurrency = (amount) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

// Hàm parse tiền chuẩn (Loại bỏ lỗi NaN)
const parseCurrency = (value) => {
    if (!value) return 0;
    return Number(value.toString().replace(/[^0-9]/g, ''));
};

export default function Debts() {
  const [activeTab, setActiveTab] = useState('payable');
  const [debts, setDebts] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // States cho Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isRepayModalOpen, setIsRepayModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [selectedDebt, setSelectedDebt] = useState(null);
  const [repaymentHistory, setRepaymentHistory] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const [newDebtData, setNewDebtData] = useState({
    creditor_name: '', total_amount: '', type: 'payable', wallet_id: '', category_id: '', note: '', due_date: ''
  });

  const [repayData, setRepayData] = useState({
    amount: '', wallet_id: '', category_id: '', date: new Date().toISOString().split('T')[0], note: ''
  });

  const fetchData = async () => {
    try {
      const [debtsRes, walletsRes, catsRes] = await Promise.all([
        axiosClient.get('/debts'),
        axiosClient.get('/wallets'),
        axiosClient.get('/categories/')
      ]);
      setDebts(debtsRes.data || []);
      setWallets(walletsRes.data || []);
      setCategories(catsRes.data || []);
    } catch (error) {
      toast.error("Không thể tải dữ liệu nợ");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateDebt = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    const payload = {
      ...newDebtData,
      total_amount: parseCurrency(newDebtData.total_amount),
      category_id: Number(newDebtData.category_id),
      due_date: newDebtData.due_date || null
    };

    const promise = axiosClient.post('/debts/', payload);

    toast.promise(promise, {
      loading: 'Đang tạo khoản nợ...',
      success: 'Đã ghi nhận khoản nợ thành công! 📝',
      error: (err) => err.response?.data?.detail || "Lỗi khi tạo nợ"
    });

    try {
      await promise;
      setIsAddModalOpen(false);
      setNewDebtData({ creditor_name: '', total_amount: '', type: activeTab, wallet_id: '', category_id: '', note: '', due_date: '' });
      fetchData();
    } catch (error) {} finally { setIsSubmitting(false); }
  };

  const fetchHistory = async (debt) => {
      setSelectedDebt(debt);
      setIsHistoryModalOpen(true);
      setIsLoadingHistory(true);
      try {
          const res = await axiosClient.get(`/debts/${debt.debt_id}/repayments`);
          setRepaymentHistory(res.data || []);
      } catch (error) {
          toast.error("Không thể tải lịch sử trả nợ");
      } finally {
          setIsLoadingHistory(false);
      }
  };

  const handleRepay = async (e) => {
    e.preventDefault();

    const amountParsed = parseCurrency(repayData.amount);
    if (amountParsed > selectedDebt.remaining_amount) {
        return toast.error("Số tiền trả không được vượt quá số nợ còn lại!");
    }

    setIsSubmitting(true);
    const promise = axiosClient.post(`/debts/${selectedDebt.debt_id}/repay`, {
      ...repayData,
      amount: amountParsed,
      category_id: Number(repayData.category_id)
    });

    toast.promise(promise, {
      loading: 'Đang xử lý...',
      success: 'Ghi nhận thanh toán thành công! ✅',
      error: (err) => err.response?.data?.detail || "Lỗi"
    });

    try {
      await promise;
      setIsRepayModalOpen(false);
      setRepayData({ amount: '', wallet_id: '', category_id: '', date: new Date().toISOString().split('T')[0], note: '' });
      fetchData();
    } catch (error) {} finally { setIsSubmitting(false); }
  };

  const currentDebts = debts.filter(d => d.type === activeTab);
  const today = new Date().toISOString().split('T')[0];

  if (isLoading) return <div className="flex justify-center items-center h-screen text-indigo-600"><Loader2 className="animate-spin" size={40} /></div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-24 lg:p-8 animate-fade-in">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* HEADER */}
        <div className="flex justify-between items-center bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Quản lý Nợ</h1>
            <p className="text-gray-500 mt-1">Theo dõi các khoản vay và cho vay</p>
          </div>
          <button onClick={() => {
              setNewDebtData(prev => ({ ...prev, type: activeTab }));
              setIsAddModalOpen(true);
          }} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-2xl flex items-center gap-2 font-medium transition-all">
            <Plus size={20} /> <span className="hidden lg:inline">Thêm khoản nợ</span>
          </button>
        </div>

        {/* TABS */}
        <div className="flex gap-2 bg-white p-2 rounded-2xl shadow-sm border border-gray-100">
          {['payable', 'receivable'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all ${activeTab === tab ? (tab === 'payable' ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600') : 'text-gray-400 hover:bg-gray-50'}`}>
              {tab === 'payable' ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
              {tab === 'payable' ? 'Tôi đi vay' : 'Tôi cho vay'}
            </button>
          ))}
        </div>

        {/* LIST */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {currentDebts.length === 0 ? (
            <div className="col-span-full py-20 bg-white rounded-3xl border border-dashed border-gray-200 text-center text-gray-400">
                Chưa có khoản nợ nào trong danh sách này.
            </div>
          ) : (
             currentDebts.map(debt => {
              const isOverdue = debt.due_date && debt.due_date < today && debt.remaining_amount > 0;
              const progress = ((Number(debt.total_amount) - Number(debt.remaining_amount)) / Number(debt.total_amount)) * 100;

              return (
                <div key={debt.debt_id} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
                  <div className={`absolute top-0 right-0 w-2 h-full ${activeTab === 'payable' ? 'bg-indigo-500' : 'bg-emerald-500'}`}></div>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-bold text-lg text-slate-800">{debt.creditor_name}</h3>
                      {debt.due_date ? (
                          <p className={`text-xs font-bold mt-1 flex items-center gap-1 ${isOverdue ? 'text-rose-500' : 'text-gray-400'}`}>
                             <Clock size={14} /> Hạn: {new Date(debt.due_date).toLocaleDateString('vi-VN')} {isOverdue && '(Quá hạn!)'}
                          </p>
                      ) : (
                          <p className="text-xs text-gray-400 mt-1 italic">Không có ngày hạn</p>
                      )}
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] font-bold text-gray-400 uppercase">Còn lại</p>
                        <p className="font-bold text-slate-800">{formatCurrency(debt.remaining_amount)}</p>
                    </div>
                  </div>

                  <div className="w-full bg-gray-100 h-2 rounded-full mt-4 overflow-hidden">
                      <div className={`h-full rounded-full ${activeTab === 'payable' ? 'bg-indigo-500' : 'bg-emerald-500'}`} style={{ width: `${progress}%` }}></div>
                  </div>

                  <div className="mt-6 flex gap-3">
                    <button onClick={() => fetchHistory(debt)} className="p-3 bg-gray-50 hover:bg-gray-100 text-slate-600 rounded-xl transition-colors" title="Lịch sử trả nợ"><History size={20}/></button>
                    {/* FIX: Sử dụng Math.floor(Number(...)) để chống lỗi sinh thêm số 0 do Decimal */}
                    <button disabled={Number(debt.remaining_amount) === 0} onClick={() => { setSelectedDebt(debt); setRepayData(prev => ({ ...prev, amount: Math.floor(Number(debt.remaining_amount)).toString() })); setIsRepayModalOpen(true); }} className={`flex-1 py-3 rounded-xl text-sm font-bold text-white transition-all shadow-sm disabled:opacity-30 ${activeTab === 'payable' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
                      {Number(debt.remaining_amount) === 0 ? 'Đã hoàn tất' : (activeTab === 'payable' ? 'Trả nợ' : 'Thu nợ')}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* MODAL LỊCH SỬ TRẢ NỢ */}
      {isHistoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden max-h-[80vh] flex flex-col">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                <h3 className="font-bold text-xl text-slate-800 flex items-center gap-2"><History className="text-indigo-600" /> Lịch sử thanh toán</h3>
                <button onClick={() => setIsHistoryModalOpen(false)} className="text-gray-400 hover:text-rose-500 bg-gray-50 p-2 rounded-full"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
                {isLoadingHistory ? <Loader2 className="animate-spin mx-auto text-indigo-500" /> : repaymentHistory.length === 0 ? <p className="text-center text-gray-400">Chưa có lịch sử giao dịch.</p> : (
                    <div className="space-y-4">
                        {repaymentHistory.map(item => (
                            <div key={item.repayment_id} className="flex justify-between items-center p-3 border-b border-gray-50">
                                <div>
                                    <p className="font-bold text-slate-700">{formatCurrency(item.amount)}</p>
                                    <p className="text-xs text-gray-400">{new Date(item.date).toLocaleDateString('vi-VN')}</p>
                                </div>
                                {item.note && <span className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-500 truncate max-w-[150px]">{item.note}</span>}
                            </div>
                        ))}
                    </div>
                )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL THÊM NỢ MỚI */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-slide-up">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                <h3 className="font-bold text-xl text-slate-800">Tạo khoản nợ mới</h3>
                <button onClick={() => setIsAddModalOpen(false)} className="text-gray-400 hover:text-rose-500 bg-gray-50 p-2 rounded-full"><X size={20} /></button>
            </div>
            <form onSubmit={handleCreateDebt} className="p-6 space-y-4">

              {/* THANH CHUYỂN ĐỔI CHẮC CHẮN NẰM Ở ĐÂY */}
              <div className="flex bg-gray-100 p-1 rounded-xl mb-2">
                  <button type="button" onClick={() => setNewDebtData({...newDebtData, type: 'payable'})} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${newDebtData.type === 'payable' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:bg-gray-200'}`}>Tôi đi vay</button>
                  <button type="button" onClick={() => setNewDebtData({...newDebtData, type: 'receivable'})} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${newDebtData.type === 'receivable' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500 hover:bg-gray-200'}`}>Tôi cho vay</button>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Đối tác (Người vay/Người cho vay)</label>
                <div className="relative">
                    <UserIcon className="absolute left-3 top-3 text-gray-400" size={18} />
                    <input type="text" required value={newDebtData.creditor_name} onChange={(e) => setNewDebtData({...newDebtData, creditor_name: e.target.value})} className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" placeholder="VD: Anh Tuấn, Ngân hàng VIB..." />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Số tiền gốc</label>
                <CurrencyInput required value={newDebtData.total_amount} onChange={(e) => setNewDebtData({...newDebtData, total_amount: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-2xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500" placeholder="0" />
              </div>

              <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Hạn thanh toán (Không bắt buộc)</label>
                  <input type="date" value={newDebtData.due_date} onChange={(e) => setNewDebtData({...newDebtData, due_date: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Ví {newDebtData.type === 'payable' ? 'nhận tiền' : 'chi tiền'}</label>
                    <select required value={newDebtData.wallet_id} onChange={(e) => setNewDebtData({...newDebtData, wallet_id: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none cursor-pointer focus:ring-2 focus:ring-indigo-500">
                        <option value="">-- Chọn ví --</option>
                        {wallets.map(w => <option key={w.wallet_id} value={w.wallet_id}>{w.name}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Danh mục hạch toán</label>
                    <select required value={newDebtData.category_id} onChange={(e) => setNewDebtData({...newDebtData, category_id: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none cursor-pointer focus:ring-2 focus:ring-indigo-500">
                        <option value="">-- Danh mục --</option>
                        {categories.filter(c => c.type === (newDebtData.type === 'payable' ? 'income' : 'expense')).map(c => <option key={c.category_id} value={c.category_id}>{c.icon} {c.name}</option>)}
                    </select>
                  </div>
              </div>

              <button disabled={isSubmitting} className="w-full bg-indigo-600 text-white py-3.5 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex justify-center items-center gap-2 mt-2">
                {isSubmitting ? <Loader2 className="animate-spin" /> : 'Xác nhận ghi nợ'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL TRẢ NỢ / THU NỢ */}
      {isRepayModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-slide-up">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <h3 className="font-bold text-xl text-slate-800 flex items-center gap-2"><ArrowDownLeft className="text-indigo-600" /> {activeTab === 'payable' ? 'Trả nợ' : 'Thu hồi nợ'}</h3>
              <button onClick={() => setIsRepayModalOpen(false)} className="text-gray-400 hover:text-rose-500 bg-gray-50 p-2 rounded-full"><X size={20} /></button>
            </div>
            <form onSubmit={handleRepay} className="p-6 space-y-4">
              <div className="bg-amber-50 p-3 rounded-xl flex items-start gap-3 border border-amber-100 text-amber-700 text-sm">
                  <AlertCircle size={20} className="shrink-0" />
                  <p>Số nợ còn lại: <b>{formatCurrency(selectedDebt?.remaining_amount)}</b>. Bạn có thể trả một phần hoặc toàn bộ.</p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Số tiền thanh toán</label>
                <CurrencyInput required value={repayData.amount} onChange={(e) => setRepayData({...repayData, amount: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-2xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Ngày thực hiện</label>
                    <input type="date" value={repayData.date} onChange={(e) => setRepayData({...repayData, date: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none" />
                </div>
                <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Ví {activeTab === 'payable' ? 'chi trả' : 'thu hồi'}</label>
                    <select required value={repayData.wallet_id} onChange={(e) => setRepayData({...repayData, wallet_id: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none cursor-pointer">
                        <option value="">-- Chọn ví --</option>
                        {wallets.map(w => <option key={w.wallet_id} value={w.wallet_id}>{w.name}</option>)}
                    </select>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Danh mục hạch toán</label>
                <select required value={repayData.category_id} onChange={(e) => setRepayData({...repayData, category_id: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none cursor-pointer">
                    <option value="">-- Chọn danh mục --</option>
                    {categories.filter(c => c.type === (activeTab === 'payable' ? 'expense' : 'income')).map(c => <option key={c.category_id} value={c.category_id}>{c.icon} {c.name}</option>)}
                </select>
              </div>
              <button disabled={isSubmitting} className={`w-full text-white py-3.5 rounded-xl font-bold transition-all shadow-lg mt-2 flex justify-center items-center gap-2 ${activeTab === 'payable' ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100'}`}>
                {isSubmitting ? <Loader2 className="animate-spin" /> : 'Xác nhận thanh toán'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}