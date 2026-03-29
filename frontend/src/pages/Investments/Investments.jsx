import React, { useState, useEffect } from 'react';
import { TrendingUp, Coins, Activity, Plus, TrendingDown, RefreshCw, CheckCircle2, X, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import axiosClient from '../../api/axiosClient';
import CurrencyInput from '../../components/CurrencyInput';

const formatCurrency = (amount) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
const extractData = (res) => (res && Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : []));

export default function Investments() {
  const [investments, setInvestments] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Stats
  const [totalPrincipal, setTotalPrincipal] = useState(0);
  const [totalCurrentValue, setTotalCurrentValue] = useState(0);

  // Modals state
  const [modalType, setModalType] = useState(null); // 'buy', 'update', 'sell'
  const [selectedInv, setSelectedInv] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Forms
  const [buyForm, setBuyForm] = useState({ name: '', type: 'stock', principal_amount: '', wallet_id: '', start_date: new Date().toISOString().split('T')[0] });
  const [updateForm, setUpdateForm] = useState({ current_value: '' });
  const [sellForm, setSellForm] = useState({ selling_price: '', wallet_id: '', date: new Date().toISOString().split('T')[0] });

  const fetchData = async () => {
    try {
      const [invRes, walRes] = await Promise.all([
        axiosClient.get('/investments/'),
        axiosClient.get('/wallets/')
      ]);
      const invData = extractData(invRes);
      setInvestments(invData);
      setWallets(extractData(walRes));

      const principal = invData.reduce((sum, item) => sum + Number(item.principal_amount), 0);
      const current = invData.reduce((sum, item) => sum + Number(item.current_value || item.principal_amount), 0);
      setTotalPrincipal(principal);
      setTotalCurrentValue(current);
    } catch (error) {
      toast.error("Lỗi tải dữ liệu đầu tư");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleBuy = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    const promise = axiosClient.post('/investments/', { ...buyForm, principal_amount: Number(buyForm.principal_amount), wallet_id: Number(buyForm.wallet_id) });
    toast.promise(promise, { loading: 'Đang xử lý...', success: 'Đã mua tài sản! 📈', error: (err) => err.response?.data?.detail || 'Lỗi' });
    try {
      await promise;
      setModalType(null);
      setBuyForm({ name: '', type: 'stock', principal_amount: '', wallet_id: '', start_date: new Date().toISOString().split('T')[0] });
      fetchData();
    } catch (error) {} finally { setIsSubmitting(false); }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    const promise = axiosClient.put(`/investments/${selectedInv.investment_id}/update`, { current_value: Number(updateForm.current_value) });
    toast.promise(promise, { loading: 'Đang cập nhật...', success: 'Đã cập nhật giá trị thị trường! 📊', error: 'Lỗi' });
    try {
      await promise;
      setModalType(null);
      fetchData();
    } catch (error) {} finally { setIsSubmitting(false); }
  };

  const handleSell = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    const promise = axiosClient.post(`/investments/${selectedInv.investment_id}/sell`, { ...sellForm, selling_price: Number(sellForm.selling_price), wallet_id: Number(sellForm.wallet_id) });
    toast.promise(promise, { loading: 'Đang khớp lệnh...', success: 'Đã chốt tài sản thành công! 💰', error: 'Lỗi' });
    try {
      await promise;
      setModalType(null);
      fetchData();
    } catch (error) {} finally { setIsSubmitting(false); }
  };

  const totalProfit = totalCurrentValue - totalPrincipal;
  const isOverallProfitable = totalProfit >= 0;

  if (isLoading) return <div className="flex justify-center items-center h-screen text-indigo-600"><Loader2 className="animate-spin" size={40} /></div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-20 lg:p-8 animate-fade-in">
      <div className="max-w-5xl mx-auto">

        {/* HEADER */}
        <div className="bg-white px-6 py-4 lg:px-0 lg:py-0 lg:mb-6 flex justify-between items-center border-b lg:border-none sticky top-0 z-10 lg:static">
          <h2 className="text-xl lg:text-3xl font-bold text-slate-800">Danh mục Đầu tư</h2>
          <button onClick={() => setModalType('buy')} className="bg-indigo-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm">
              <Plus size={18}/> <span className="hidden md:inline">Mua tài sản</span>
          </button>
        </div>

        <div className="p-6 lg:p-0">
          {/* DASHBOARD STATS */}
          <div className="bg-gradient-to-br from-indigo-600 to-indigo-900 rounded-3xl p-6 lg:p-8 text-white mb-8 shadow-xl shadow-indigo-200 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10"><TrendingUp size={120} /></div>
            <p className="text-indigo-200 text-sm lg:text-base font-medium mb-2">Tổng giá trị tài sản hiện tại</p>
            <h3 className="text-4xl lg:text-5xl font-bold">{formatCurrency(totalCurrentValue)}</h3>

            <div className="flex gap-4 mt-6">
                <div className={`flex items-center gap-2 text-sm px-4 py-2 rounded-xl font-bold backdrop-blur-sm ${isOverallProfitable ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
                    {isOverallProfitable ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                    <span>{isOverallProfitable ? 'Lãi' : 'Lỗ'}: {formatCurrency(Math.abs(totalProfit))}</span>
                </div>
                <div className="flex items-center gap-2 text-sm px-4 py-2 rounded-xl font-medium bg-white/10 text-indigo-100 backdrop-blur-sm">
                    <span>Vốn gốc: {formatCurrency(totalPrincipal)}</span>
                </div>
            </div>
          </div>

          {/* LIST */}
          <h4 className="font-semibold text-gray-700 mb-4 text-lg">Chi tiết danh mục đang Hold</h4>
          {investments.length === 0 ? (
             <div className="py-20 bg-white rounded-3xl border border-dashed border-gray-200 text-center text-gray-400">Chưa có tài sản đầu tư nào.</div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
              {investments.map(inv => {
                const principal = Number(inv.principal_amount);
                const current = Number(inv.current_value || inv.principal_amount);
                const profit = current - principal;
                const roi = principal > 0 ? (profit / principal) * 100 : 0;
                const isProfitable = profit >= 0;

                return (
                  <div key={inv.investment_id} className="bg-white p-5 lg:p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col hover:shadow-md transition-all group">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-3 rounded-2xl ${inv.type === 'gold' ? 'bg-yellow-50 text-yellow-600' : 'bg-indigo-50 text-indigo-600'}`}>
                          {inv.type === 'gold' ? <Coins size={24} /> : <Activity size={24} />}
                        </div>
                        <div>
                          <h5 className="font-bold text-slate-800 lg:text-lg">{inv.name}</h5>
                          <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">{inv.type}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-slate-800 lg:text-lg">{formatCurrency(current)}</p>
                        <p className={`text-sm font-bold mt-0.5 flex items-center justify-end gap-1 ${isProfitable ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {isProfitable ? '+' : ''}{roi.toFixed(2)}%
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2 mt-2 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setSelectedInv(inv); setUpdateForm({ current_value: current }); setModalType('update'); }} className="flex-1 py-2 bg-gray-50 hover:bg-gray-100 text-gray-600 text-sm font-bold rounded-xl flex items-center justify-center gap-2"><RefreshCw size={16}/> Cập nhật giá</button>
                        <button onClick={() => { setSelectedInv(inv); setSellForm({ ...sellForm, selling_price: current }); setModalType('sell'); }} className="flex-1 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-sm font-bold rounded-xl flex items-center justify-center gap-2"><CheckCircle2 size={16}/> Bán chốt lời</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* MODAL MUA TÀI SẢN */}
      {modalType === 'buy' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl p-6">
            <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-xl text-slate-800">Mua tài sản mới</h3>
                <button onClick={() => setModalType(null)} className="p-2 bg-gray-50 rounded-full text-gray-400 hover:text-rose-500"><X size={20}/></button>
            </div>
            <form onSubmit={handleBuy} className="space-y-4">
                <input type="text" required value={buyForm.name} onChange={e => setBuyForm({...buyForm, name: e.target.value})} placeholder="Tên tài sản (VD: 1 Chỉ SJC)..." className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none" />
                <select value={buyForm.type} onChange={e => setBuyForm({...buyForm, type: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none">
                    <option value="stock">Cổ phiếu / Chứng khoán</option>
                    <option value="gold">Vàng / Kim loại quý</option>
                    <option value="crypto">Tiền điện tử</option>
                    <option value="real_estate">Bất động sản</option>
                </select>
                <CurrencyInput required value={buyForm.principal_amount} onChange={e => setBuyForm({...buyForm, principal_amount: e.target.value})} placeholder="Số tiền vốn đầu tư" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xl font-bold outline-none" />
                <select required value={buyForm.wallet_id} onChange={e => setBuyForm({...buyForm, wallet_id: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none">
                    <option value="">-- Trừ tiền từ ví --</option>
                    {wallets.map(w => <option key={w.wallet_id} value={w.wallet_id}>{w.name} (Dư: {formatCurrency(w.balance)})</option>)}
                </select>
                <button disabled={isSubmitting} className="w-full bg-indigo-600 text-white py-3.5 rounded-xl font-bold hover:bg-indigo-700 flex justify-center gap-2">{isSubmitting ? <Loader2 className="animate-spin"/> : 'Xác nhận Mua'}</button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CẬP NHẬT GIÁ */}
      {modalType === 'update' && (
         <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-slate-900/50 backdrop-blur-sm">
         <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl p-6">
           <div className="flex justify-between items-center mb-6">
               <h3 className="font-bold text-xl text-slate-800">Cập nhật giá thị trường</h3>
               <button onClick={() => setModalType(null)} className="p-2 bg-gray-50 rounded-full text-gray-400 hover:text-rose-500"><X size={20}/></button>
           </div>
           <form onSubmit={handleUpdate} className="space-y-4">
               <div className="p-3 bg-indigo-50 text-indigo-700 rounded-xl text-sm mb-4 font-medium">{selectedInv?.name} - Vốn gốc: {formatCurrency(selectedInv?.principal_amount)}</div>
               <label className="text-sm font-bold text-gray-700">Nhập giá trị hiện tại:</label>
               <CurrencyInput required value={updateForm.current_value} onChange={e => setUpdateForm({...updateForm, current_value: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-2xl font-bold outline-none text-indigo-600" />
               <button disabled={isSubmitting} className="w-full bg-indigo-600 text-white py-3.5 rounded-xl font-bold mt-4 flex justify-center">{isSubmitting ? <Loader2 className="animate-spin"/> : 'Lưu giá mới'}</button>
           </form>
         </div>
       </div>
      )}

      {/* MODAL BÁN / CHỐT LỜI */}
      {modalType === 'sell' && (
         <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-slate-900/50 backdrop-blur-sm">
         <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl p-6">
           <div className="flex justify-between items-center mb-6">
               <h3 className="font-bold text-xl text-slate-800">Chốt lời / Cắt lỗ</h3>
               <button onClick={() => setModalType(null)} className="p-2 bg-gray-50 rounded-full text-gray-400 hover:text-rose-500"><X size={20}/></button>
           </div>
           <form onSubmit={handleSell} className="space-y-4">
               <div className="p-3 bg-rose-50 text-rose-700 rounded-xl text-sm mb-4">Tài sản <b>{selectedInv?.name}</b> sẽ được tất toán và xóa khỏi danh mục Hold.</div>
               <label className="text-sm font-bold text-gray-700">Giá trị bán thực tế:</label>
               <CurrencyInput required value={sellForm.selling_price} onChange={e => setSellForm({...sellForm, selling_price: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-2xl font-bold outline-none text-slate-800" />

               <select required value={sellForm.wallet_id} onChange={e => setSellForm({...sellForm, wallet_id: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none">
                    <option value="">-- Tiền bán chuyển về ví --</option>
                    {wallets.map(w => <option key={w.wallet_id} value={w.wallet_id}>{w.name}</option>)}
                </select>

               <button disabled={isSubmitting} className="w-full bg-emerald-600 text-white py-3.5 rounded-xl font-bold mt-4 flex justify-center hover:bg-emerald-700">{isSubmitting ? <Loader2 className="animate-spin"/> : 'Xác nhận Bán'}</button>
           </form>
         </div>
       </div>
      )}
    </div>
  );
}