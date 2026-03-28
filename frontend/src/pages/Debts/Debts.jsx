import React, { useState, useEffect } from 'react';
import { ArrowDownLeft, ArrowUpRight, Plus, X, Loader2, AlertCircle, Wallet as WalletIcon, Calendar, User as UserIcon, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import axiosClient from '../../api/axiosClient';
import CurrencyInput from '../../components/CurrencyInput';

const formatCurrency = (amount) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

export default function Debts() {
  const [activeTab, setActiveTab] = useState('payable'); // 'payable' (Đi vay) hoặc 'receivable' (Cho vay)
  const [debts, setDebts] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // States cho Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isRepayModalOpen, setIsRepayModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState(null);

  // Form States
  const [newDebtData, setNewDebtData] = useState({
    creditor_name: '',
    total_amount: '',
    type: 'payable',
    wallet_id: '',
    note: ''
  });

  const [repayData, setRepayData] = useState({
    amount: '',
    wallet_id: '',
    category_id: '',
    date: new Date().toISOString().split('T')[0],
    note: ''
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
    if (!newDebtData.wallet_id) return toast.error("Vui lòng chọn ví thực hiện");

    setIsSubmitting(true);
    const promise = axiosClient.post('/debts/', {
      ...newDebtData,
      total_amount: Number(newDebtData.total_amount)
    });

    toast.promise(promise, {
      loading: 'Đang tạo khoản nợ...',
      success: 'Đã ghi nhận khoản nợ thành công! 📝',
      error: (err) => err.response?.data?.detail || "Lỗi khi tạo nợ"
    });

    try {
      await promise;
      setIsAddModalOpen(false);
      setNewDebtData({ creditor_name: '', total_amount: '', type: activeTab, wallet_id: '', note: '' });
      fetchData();
    } catch (error) {} finally { setIsSubmitting(false); }
  };

  const handleRepay = async (e) => {
    e.preventDefault();
    if (Number(repayData.amount) > selectedDebt.remaining_amount) {
        return toast.error("Số tiền trả không được vượt quá số nợ còn lại!");
    }

    setIsSubmitting(true);
    const promise = axiosClient.post(`/debts/${selectedDebt.debt_id}/repay`, {
      ...repayData,
      amount: Number(repayData.amount),
      category_id: Number(repayData.category_id)
    });

    toast.promise(promise, {
      loading: 'Đang xử lý giao dịch...',
      success: 'Ghi nhận trả nợ thành công! ✅',
      error: (err) => err.response?.data?.detail || "Lỗi khi trả nợ"
    });

    try {
      await promise;
      setIsRepayModalOpen(false);
      setRepayData({ amount: '', wallet_id: '', category_id: '', date: new Date().toISOString().split('T')[0], note: '' });
      fetchData();
    } catch (error) {} finally { setIsSubmitting(false); }
  };

  const currentDebts = debts.filter(d => d.type === activeTab);

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
          <button
            onClick={() => {
                setNewDebtData(prev => ({ ...prev, type: activeTab }));
                setIsAddModalOpen(true);
            }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white p-3 lg:px-5 lg:py-2.5 rounded-2xl flex items-center gap-2 font-medium shadow-sm transition-all"
          >
            <Plus size={20} /> <span className="hidden lg:inline">Thêm khoản nợ</span>
          </button>
        </div>

        {/* TABS */}
        <div className="flex gap-2 bg-white p-2 rounded-2xl shadow-sm border border-gray-100">
          <button
            onClick={() => setActiveTab('payable')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all ${activeTab === 'payable' ? 'bg-indigo-50 text-indigo-600 shadow-sm' : 'text-gray-400 hover:bg-gray-50'}`}
          >
            <ArrowDownLeft size={18} /> Tôi đi vay
          </button>
          <button
            onClick={() => setActiveTab('receivable')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all ${activeTab === 'receivable' ? 'bg-emerald-50 text-emerald-600 shadow-sm' : 'text-gray-400 hover:bg-gray-50'}`}
          >
            <ArrowUpRight size={18} /> Tôi cho vay
          </button>
        </div>

        {/* LIST */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {currentDebts.length === 0 ? (
            <div className="col-span-full py-20 bg-white rounded-3xl border border-dashed border-gray-200 text-center text-gray-400">
                Chưa có khoản nợ nào trong danh sách này.
            </div>
          ) : (
            currentDebts.map(debt => {
              const remaining = Number(debt.remaining_amount);
              const total = Number(debt.total_amount);
              const paid = total - remaining;
              const progress = (paid / total) * 100;

              return (
                <div key={debt.debt_id} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
                  <div className={`absolute top-0 right-0 w-2 h-full ${activeTab === 'payable' ? 'bg-indigo-500' : 'bg-emerald-500'}`}></div>

                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-bold text-lg text-slate-800">{debt.creditor_name}</h3>
                      <p className="text-sm text-gray-400">Ngày tạo: {new Date(debt.created_at).toLocaleDateString('vi-VN')}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Tổng nợ</p>
                        <p className="font-bold text-slate-800">{formatCurrency(total)}</p>
                    </div>
                  </div>

                  <div className="space-y-3 mt-6">
                    <div className="flex justify-between text-sm font-bold">
                      <span className="text-indigo-600">Đã trả: {formatCurrency(paid)}</span>
                      <span className="text-gray-400">Còn lại: {formatCurrency(remaining)}</span>
                    </div>
                    <div className="w-full bg-gray-100 h-3 rounded-full overflow-hidden shadow-inner">
                      <div className={`h-full rounded-full transition-all duration-1000 ${activeTab === 'payable' ? 'bg-indigo-500' : 'bg-emerald-500'}`} style={{ width: `${progress}%` }}></div>
                    </div>
                  </div>

                  <div className="mt-6 flex gap-3">
                    <button
                        disabled={remaining === 0}
                        onClick={() => {
                            setSelectedDebt(debt);
                            setRepayData(prev => ({ ...prev, amount: remaining }));
                            setIsRepayModalOpen(true);
                        }}
                        className={`flex-1 py-3 rounded-xl text-sm font-bold text-white transition-all shadow-sm shadow-indigo-100 disabled:opacity-30 ${activeTab === 'payable' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                    >
                      {remaining === 0 ? 'Đã hoàn tất' : (activeTab === 'payable' ? 'Trả nợ' : 'Thu nợ')}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* MODAL THÊM NỢ MỚI */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-slide-up">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <h3 className="font-bold text-xl text-slate-800 flex items-center gap-2"><Plus className="text-indigo-600" /> Tạo khoản nợ mới</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-gray-400 hover:text-rose-500 bg-gray-50 p-2 rounded-full"><X size={20} /></button>
            </div>
            <form onSubmit={handleCreateDebt} className="p-6 space-y-4">
              <div className="flex bg-gray-100 p-1 rounded-xl">
                  <button type="button" onClick={() => setNewDebtData({...newDebtData, type: 'payable'})} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${newDebtData.type === 'payable' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'}`}>Tôi đi vay</button>
                  <button type="button" onClick={() => setNewDebtData({...newDebtData, type: 'receivable'})} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${newDebtData.type === 'receivable' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500'}`}>Tôi cho vay</button>
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
                <label className="text-sm font-medium text-gray-700 block mb-1">Ví {newDebtData.type === 'payable' ? 'nhận tiền' : 'chi tiền'}</label>
                <select required value={newDebtData.wallet_id} onChange={(e) => setNewDebtData({...newDebtData, wallet_id: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none cursor-pointer">
                    <option value="">-- Chọn ví --</option>
                    {wallets.map(w => <option key={w.wallet_id} value={w.wallet_id}>{w.name} (Dư: {formatCurrency(w.balance)})</option>)}
                </select>
              </div>
              <button disabled={isSubmitting} className="w-full bg-indigo-600 text-white py-3.5 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex justify-center items-center gap-2">
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
                    <select required value={repayData.wallet_id} onChange={(e) => setRepayData({...repayData, wallet_id: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none">
                        <option value="">-- Chọn ví --</option>
                        {wallets.map(w => <option key={w.wallet_id} value={w.wallet_id}>{w.name}</option>)}
                    </select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Danh mục hạch toán</label>
                <select required value={repayData.category_id} onChange={(e) => setRepayData({...repayData, category_id: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none">
                    <option value="">-- Chọn danh mục --</option>
                    {categories.filter(c => c.type === (activeTab === 'payable' ? 'expense' : 'income')).map(c => <option key={c.category_id} value={c.category_id}>{c.icon} {c.name}</option>)}
                </select>
              </div>
              <button disabled={isSubmitting} className={`w-full text-white py-3.5 rounded-xl font-bold transition-all shadow-lg flex justify-center items-center gap-2 ${activeTab === 'payable' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
                {isSubmitting ? <Loader2 className="animate-spin" /> : 'Xác nhận thanh toán'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}