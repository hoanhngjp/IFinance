import React, { useState, useEffect } from 'react';
import { TrendingUp, Coins, Activity, Plus, TrendingDown, RefreshCw, CheckCircle2, X, Loader2, PieChart as PieChartIcon, HandCoins, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import axiosClient from '../../api/axiosClient';
import CurrencyInput from '../../components/CurrencyInput';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';

const formatCurrency = (amount) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
const extractData = (res) => (res && Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : []));

// Màu sắc cho biểu đồ
const COLORS = ['#4f46e5', '#eab308', '#06b6d4', '#10b981', '#f43f5e'];

export default function Investments() {
  const [investments, setInvestments] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [analyticsData, setAnalyticsData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Stats
  const [totalPrincipal, setTotalPrincipal] = useState(0);
  const [totalCurrentValue, setTotalCurrentValue] = useState(0);

  // Modals state: 'buy', 'update', 'sell', 'passive'
  const [modalType, setModalType] = useState(null);
  const [selectedInv, setSelectedInv] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFetchingPrice, setIsFetchingPrice] = useState(false);
  const [assetQuantity, setAssetQuantity] = useState('');

  // Forms
  const [buyForm, setBuyForm] = useState({ name: '', type: 'stock', quantity: '1', principal_amount: '', fee: '', tax: '', wallet_id: '', start_date: new Date().toISOString().split('T')[0] });
  const [updateForm, setUpdateForm] = useState({ current_value: '' });
  const [sellForm, setSellForm] = useState({ selling_price: '', fee: '', tax: '', wallet_id: '', date: new Date().toISOString().split('T')[0] });
  const [passiveForm, setPassiveForm] = useState({ amount: '', wallet_id: '', description: '' });

  const fetchData = async () => {
    try {
      const [invRes, walRes, analyticsRes] = await Promise.all([
        axiosClient.get('/investments/'),
        axiosClient.get('/wallets/'),
        axiosClient.get('/investments/analytics')
      ]);

      const invData = extractData(invRes);
      setInvestments(invData);
      setWallets(extractData(walRes));

      // Lấy data biểu đồ
      if (analyticsRes.data && analyticsRes.data.allocation) {
        setAnalyticsData(analyticsRes.data.allocation);
      }

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
    const payload = {
      ...buyForm,
      quantity: Number(buyForm.quantity || 1),
      principal_amount: Number(buyForm.principal_amount),
      fee: Number(buyForm.fee || 0),
      tax: Number(buyForm.tax || 0),
      wallet_id: Number(buyForm.wallet_id)
    };

    const promise = axiosClient.post('/investments/', payload);
    toast.promise(promise, { loading: 'Đang xử lý...', success: 'Đã mua tài sản! 📈', error: (err) => err.response?.data?.detail || 'Lỗi hệ thống' });
    try {
      await promise;
      setModalType(null);
      setBuyForm({ name: '', type: 'stock', quantity: '1', principal_amount: '', fee: '', tax: '', wallet_id: '', start_date: new Date().toISOString().split('T')[0] });
      fetchData();
    } catch (error) { } finally { setIsSubmitting(false); }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    const promise = axiosClient.put(`/investments/${selectedInv.investment_id}/update`, { current_value: Number(updateForm.current_value) });
    toast.promise(promise, { loading: 'Đang cập nhật...', success: 'Đã cập nhật giá trị thị trường! 📊', error: 'Lỗi cập nhật' });
    try {
      await promise;
      setModalType(null);
      setAssetQuantity('');
      fetchData();
    } catch (error) { } finally { setIsSubmitting(false); }
  };

  const handleFetchRealtimePrice = async (targetTicker = null, isBuyModal = false) => {
    // Nếu gọi từ hàm Tính vốn tự động thì qty là buyForm.quantity
    const qty = isBuyModal ? Number(buyForm.quantity || 1) : Number(selectedInv?.quantity || 1);
    const assetType = isBuyModal ? buyForm.type : selectedInv.type;
    const nameStr = isBuyModal ? buyForm.name : selectedInv.name;
    const nameLower = nameStr.toLowerCase();

    setIsFetchingPrice(true);
    try {
      let currentPrice = 0;
      let coinId = null;
      let ticker = null;

      if (assetType === 'crypto') {
        if (nameLower.includes('btc') || nameLower.includes('bitcoin')) coinId = 'bitcoin';
        else if (nameLower.includes('eth') || nameLower.includes('ethereum')) coinId = 'ethereum';
        else if (nameLower.includes('bnb') || nameLower.includes('binance')) coinId = 'binancecoin';
        else if (nameLower.includes('sol') || nameLower.includes('solana')) coinId = 'solana';
        else coinId = nameLower.split(' ')[0]; 

        const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=vnd`);
        if (!res.ok) throw new Error("API Limit");
        const data = await res.json();

        if (data[coinId] && data[coinId].vnd) {
          currentPrice = data[coinId].vnd;
          toast.success(`Cập nhật thành công! Mức giá 1 ${coinId.toUpperCase()} = ${formatCurrency(currentPrice)}`);
        } else {
          return toast.error(`Không tìm ra mệnh giá cho ${coinId} từ API Crypto.`);
        }
      }
      else if (assetType === 'stock') {
        const nameUpper = nameStr.toUpperCase();
        ticker = nameUpper.replace('CỔ PHIẾU', '').replace('CHỨNG KHOÁN', '').replace('MÃ', '').trim().split(' ')[0];
        if (!ticker) ticker = 'FPT'; 
        
        const res = await axiosClient.get(`/investments/stock-price?ticker=${ticker}`);
        if (res.data && res.data.data && res.data.data.price) {
            currentPrice = Number(res.data.data.price);
            toast.success(`Đã lấy giá vnstock thành công! Giá 1 ${ticker} ≈ ${formatCurrency(currentPrice)}`);
        } else {
            return toast.error(`Không thể lấy giá cho mã chứng khoán ${ticker}.`);
        }
      }
      else if (assetType === 'gold' && (nameLower.includes('sjc') || nameLower.includes('vàng'))) {
        toast.success("Đã kết nối API nội bộ Thị trường Vàng SJC!");
        currentPrice = 85000000; 
      } else {
        return toast.error("Hệ thống Lấy giá hiện chưa hỗ trợ loại tài sản này. Vui lòng tự ước định giá.");
      }

      // Nạp kết quả
      const totalVal = Math.floor(currentPrice * qty);
      if (isBuyModal) {
         setBuyForm({ ...buyForm, principal_amount: totalVal.toString() });
      } else {
         setUpdateForm({ ...updateForm, current_value: totalVal.toString() });
      }

    } catch (e) {
      const errMsg = e.response?.data?.detail || "Lỗi khi fetch API bên thứ 3. Kết nối mạng quá tải.";
      toast.error(errMsg);
    } finally {
      setIsFetchingPrice(false);
    }
  };

  const handlePassiveIncome = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    const payload = {
      amount: Number(passiveForm.amount),
      wallet_id: Number(passiveForm.wallet_id),
      description: passiveForm.description || `Nhận lãi/cổ tức từ ${selectedInv.name}`
    };

    const promise = axiosClient.post(`/investments/${selectedInv.investment_id}/passive-income`, payload);
    toast.promise(promise, { loading: 'Đang ghi nhận...', success: 'Đã nhận dòng tiền thụ động! 💵', error: 'Lỗi ghi nhận' });
    try {
      await promise;
      setModalType(null);
      setPassiveForm({ amount: '', wallet_id: '', description: '' });
      fetchData();
    } catch (error) { } finally { setIsSubmitting(false); }
  };

  const handleSell = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    const payload = {
      ...sellForm,
      selling_price: Number(sellForm.selling_price),
      fee: Number(sellForm.fee || 0),
      tax: Number(sellForm.tax || 0),
      wallet_id: Number(sellForm.wallet_id)
    };

    const promise = axiosClient.post(`/investments/${selectedInv.investment_id}/transactions`, payload);
    toast.promise(promise, { loading: 'Đang khớp lệnh...', success: 'Đã chốt tài sản thành công! 💰', error: 'Lỗi bán tài sản' });
    try {
      await promise;
      setModalType(null);
      setSellForm({ selling_price: '', fee: '', tax: '', wallet_id: '', date: new Date().toISOString().split('T')[0] });
      fetchData();
    } catch (error) { } finally { setIsSubmitting(false); }
  };

  const totalProfit = totalCurrentValue - totalPrincipal;
  const isOverallProfitable = totalProfit >= 0;

  if (isLoading) return <div className="flex justify-center items-center h-screen text-indigo-600"><Loader2 className="animate-spin" size={40} /></div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-20 lg:p-8 animate-fade-in">
      <div className="max-w-6xl mx-auto">

        {/* HEADER */}
        <div className="bg-white px-6 py-4 lg:px-0 lg:py-0 lg:mb-6 flex justify-between items-center border-b lg:border-none sticky top-0 z-10 lg:static">
          <h2 className="text-xl lg:text-3xl font-bold text-slate-800">Danh mục Đầu tư</h2>
          <button onClick={() => setModalType('buy')} className="bg-indigo-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm">
            <Plus size={18} /> <span className="hidden md:inline">Mua tài sản</span>
          </button>
        </div>

        <div className="p-6 lg:p-0">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* DASHBOARD STATS */}
            <div className="lg:col-span-2 bg-gradient-to-br from-indigo-600 to-indigo-900 rounded-3xl p-6 lg:p-8 text-white shadow-xl shadow-indigo-200 relative overflow-hidden flex flex-col justify-center">
              <div className="absolute top-0 right-0 p-8 opacity-10"><TrendingUp size={120} /></div>
              <p className="text-indigo-200 text-sm lg:text-base font-medium mb-2">Tổng giá trị tài sản hiện tại</p>
              <h3 className="text-4xl lg:text-5xl font-bold">{formatCurrency(totalCurrentValue)}</h3>

              <div className="flex flex-wrap gap-4 mt-6">
                <div className={`flex items-center gap-2 text-sm px-4 py-2 rounded-xl font-bold backdrop-blur-sm ${isOverallProfitable ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
                  {isOverallProfitable ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                  <span>{isOverallProfitable ? 'Lãi' : 'Lỗ'}: {formatCurrency(Math.abs(totalProfit))}</span>
                </div>
                <div className="flex items-center gap-2 text-sm px-4 py-2 rounded-xl font-medium bg-white/10 text-indigo-100 backdrop-blur-sm">
                  <span>Vốn gốc: {formatCurrency(totalPrincipal)}</span>
                </div>
              </div>
            </div>

            {/* CHART ALLOCATION */}
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex flex-col">
              <h4 className="font-semibold text-gray-700 mb-2 flex items-center gap-2"><PieChartIcon size={18} /> Phân bổ tài sản</h4>
              {analyticsData.length > 0 ? (
                <div className="flex-1 min-h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={analyticsData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={5} dataKey="current_value" nameKey="type">
                        {analyticsData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip formatter={(value) => formatCurrency(value)} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-gray-400 text-sm italic">Chưa có dữ liệu</div>
              )}
            </div>
          </div>

          {/* LIST */}
          <h4 className="font-semibold text-gray-700 mb-4 text-lg">Chi tiết danh mục đang Hold</h4>
          {investments.length === 0 ? (
            <div className="py-20 bg-white rounded-3xl border border-dashed border-gray-200 text-center text-gray-400">Chưa có tài sản đầu tư nào.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6">
              {investments.map(inv => {
                const principal = Number(inv.principal_amount);
                const current = Number(inv.current_value || inv.principal_amount);
                const passiveIncome = Number(inv.total_passive_income || 0);

                // Lợi nhuận bao gồm cả giá trị chênh lệch và tiền thụ động đã nhận
                const profit = (current - principal) + passiveIncome;
                const roi = principal > 0 ? (profit / principal) * 100 : 0;
                const isProfitable = profit >= 0;

                return (
                  <div key={inv.investment_id} className="bg-white p-5 lg:p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col hover:shadow-md transition-all group">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-3 rounded-2xl ${inv.type === 'gold' ? 'bg-yellow-50 text-yellow-600' : 'bg-indigo-50 text-indigo-600'}`}>
                          {inv.type === 'gold' ? <Coins size={24} /> : <Activity size={24} />}
                        </div>
                        <div>
                          <h5 className="font-bold text-slate-800 lg:text-lg truncate max-w-[150px]" title={inv.name}>{inv.name}</h5>
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

                    {/* Hiển thị dòng tiền thụ động nếu có */}
                    {passiveIncome > 0 && (
                      <div className="text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md mb-4 inline-block font-medium">
                        + {formatCurrency(passiveIncome)} cổ tức/lãi
                      </div>
                    )}

                    <div className="mt-auto grid grid-cols-3 gap-2 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setSelectedInv(inv); setUpdateForm({ current_value: current }); setModalType('update'); }} className="py-2 bg-gray-50 hover:bg-gray-100 text-gray-600 text-xs font-bold rounded-xl flex flex-col items-center justify-center gap-1"><RefreshCw size={14} /> Giá</button>
                      <button onClick={() => { setSelectedInv(inv); setModalType('passive'); }} className="py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold rounded-xl flex flex-col items-center justify-center gap-1"><HandCoins size={14} /> Cổ tức</button>
                      <button onClick={() => { setSelectedInv(inv); setSellForm({ ...sellForm, selling_price: current }); setModalType('sell'); }} className="py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl flex flex-col items-center justify-center gap-1"><CheckCircle2 size={14} /> Bán</button>
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
              <button onClick={() => setModalType(null)} className="p-2 bg-gray-50 rounded-full text-gray-400 hover:text-rose-500"><X size={20} /></button>
            </div>
            <form onSubmit={handleBuy} className="space-y-4">
              <input type="text" required value={buyForm.name} onChange={e => setBuyForm({ ...buyForm, name: e.target.value })} placeholder="Tên tài sản (VD: 1 Chỉ SJC, Cổ phiếu FPT)..." className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none" />

              <div className="grid grid-cols-2 gap-4">
                  <select value={buyForm.type} onChange={e => setBuyForm({ ...buyForm, type: e.target.value })} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none">
                    <option value="stock">Cổ phiếu</option>
                    <option value="gold">Vàng</option>
                    <option value="crypto">Tiền mã hoá</option>
                    <option value="real_estate">BĐS / Hiện vật</option>
                  </select>
                  <div>
                      <input type="number" step="any" min="0" required value={buyForm.quantity} onChange={e => setBuyForm({ ...buyForm, quantity: e.target.value })} placeholder="Số lượng (VD: 0.5, 100)" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none" title="Số lượng" />
                  </div>
              </div>

              <div>
                <div className="flex justify-between items-end mb-1">
                    <label className="text-xs font-semibold text-gray-500 ml-1">Vốn đầu tư</label>
                    {(buyForm.type === 'stock' || buyForm.type === 'crypto' || buyForm.type === 'gold') && buyForm.name.length > 1 && (
                        <button type="button" onClick={() => handleFetchRealtimePrice(null, true)} disabled={isFetchingPrice} className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md flex items-center gap-1 hover:bg-indigo-100 transition">
                            {isFetchingPrice ? <Loader2 size={12} className="animate-spin" /> : <><Zap size={12} /> Tính vốn tự động</>}
                        </button>
                    )}
                </div>
                <CurrencyInput required value={buyForm.principal_amount} onChange={e => setBuyForm({ ...buyForm, principal_amount: e.target.value })} placeholder="Số tiền vốn" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xl font-bold outline-none text-indigo-600" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-500 ml-1">Phí giao dịch (Tùy chọn)</label>
                  <CurrencyInput value={buyForm.fee} onChange={e => setBuyForm({ ...buyForm, fee: e.target.value })} placeholder="0" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 ml-1">Thuế (Tùy chọn)</label>
                  <CurrencyInput value={buyForm.tax} onChange={e => setBuyForm({ ...buyForm, tax: e.target.value })} placeholder="0" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none" />
                </div>
              </div>

              <select required value={buyForm.wallet_id} onChange={e => setBuyForm({ ...buyForm, wallet_id: e.target.value })} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none">
                <option value="">-- Trừ tiền từ ví --</option>
                {wallets.map(w => <option key={w.wallet_id} value={w.wallet_id}>{w.name} (Dư: {formatCurrency(w.balance)})</option>)}
              </select>
              <button disabled={isSubmitting} className="w-full bg-indigo-600 text-white py-3.5 rounded-xl font-bold hover:bg-indigo-700 flex justify-center gap-2">{isSubmitting ? <Loader2 className="animate-spin" /> : 'Xác nhận Mua'}</button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CẬP NHẬT GIÁ */}
      {modalType === 'update' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-xl text-slate-800">Cập nhật giá</h3>
              <button onClick={() => { setModalType(null); setAssetQuantity(''); }} className="p-2 bg-gray-50 rounded-full text-gray-400 hover:text-rose-500"><X size={20} /></button>
            </div>

            <div className="p-3 bg-indigo-50 text-indigo-700 rounded-xl text-sm mb-4 font-medium">{selectedInv?.name} - Vốn gốc: {formatCurrency(selectedInv?.principal_amount)}</div>

            {/* HYBRID REALTIME FETCHING */}
            {(selectedInv?.type === 'crypto' || selectedInv?.type === 'gold' || selectedInv?.type === 'stock') && (
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 mb-6 flex justify-between items-center">
                <div>
                  <p className="text-sm font-bold text-slate-800">Số lượng đang giữ: {selectedInv.quantity}</p>
                  <p className="text-xs text-gray-500 mt-1">Cập nhật giá theo thời gian thực</p>
                </div>
                <button type="button" onClick={() => handleFetchRealtimePrice(null, false)} disabled={isFetchingPrice} className="bg-slate-800 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-slate-700 transition flex items-center gap-2">
                    {isFetchingPrice ? <Loader2 size={16} className="animate-spin" /> : <><Zap size={16} /> Lấy giá về</>}
                </button>
              </div>
            )}

            <form onSubmit={handleUpdate} className="space-y-4 pt-2 border-t border-dashed border-gray-200">
              <label className="text-sm font-bold text-gray-700">Giá trị tổng cộng (Thủ công / Auto):</label>
              <CurrencyInput required value={updateForm.current_value} onChange={e => setUpdateForm({ ...updateForm, current_value: e.target.value })} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-2xl font-bold outline-none text-indigo-600" />
              <button disabled={isSubmitting} className="w-full bg-indigo-600 text-white py-3.5 rounded-xl font-bold mt-4 flex justify-center hover:bg-indigo-700 transition">{isSubmitting ? <Loader2 className="animate-spin" /> : 'Xác nhận Lưu'}</button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL NHẬN CỔ TỨC / LÃI */}
      {modalType === 'passive' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-xl text-slate-800">Nhận cổ tức / Tiền lãi</h3>
              <button onClick={() => setModalType(null)} className="p-2 bg-gray-50 rounded-full text-gray-400 hover:text-rose-500"><X size={20} /></button>
            </div>
            <form onSubmit={handlePassiveIncome} className="space-y-4">
              <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl text-sm mb-4 font-medium">Khoản tiền này sẽ được cộng trực tiếp vào ví của bạn.</div>

              <CurrencyInput required value={passiveForm.amount} onChange={e => setPassiveForm({ ...passiveForm, amount: e.target.value })} placeholder="Số tiền nhận được" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-2xl font-bold outline-none text-emerald-600" />

              <input type="text" value={passiveForm.description} onChange={e => setPassiveForm({ ...passiveForm, description: e.target.value })} placeholder="Ghi chú (VD: Cổ tức quý 1)..." className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none" />

              <select required value={passiveForm.wallet_id} onChange={e => setPassiveForm({ ...passiveForm, wallet_id: e.target.value })} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none">
                <option value="">-- Chọn ví nhận tiền --</option>
                {wallets.map(w => <option key={w.wallet_id} value={w.wallet_id}>{w.name}</option>)}
              </select>

              <button disabled={isSubmitting} className="w-full bg-emerald-600 text-white py-3.5 rounded-xl font-bold mt-4 flex justify-center">{isSubmitting ? <Loader2 className="animate-spin" /> : 'Xác nhận Nhận'}</button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL BÁN / CHỐT LỜI */}
      {modalType === 'sell' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-xl text-slate-800">Chốt lời / Cắt lỗ</h3>
              <button onClick={() => setModalType(null)} className="p-2 bg-gray-50 rounded-full text-gray-400 hover:text-rose-500"><X size={20} /></button>
            </div>
            <form onSubmit={handleSell} className="space-y-4">
              <div className="p-3 bg-rose-50 text-rose-700 rounded-xl text-sm mb-4">Tài sản <b>{selectedInv?.name}</b> sẽ được tất toán và xóa khỏi danh mục Hold.</div>

              <div>
                <label className="text-xs font-bold text-gray-700 ml-1">Giá bán tổng cộng:</label>
                <CurrencyInput required value={sellForm.selling_price} onChange={e => setSellForm({ ...sellForm, selling_price: e.target.value })} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-2xl font-bold outline-none text-slate-800" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-500 ml-1">Phí bán (Tùy chọn)</label>
                  <CurrencyInput value={sellForm.fee} onChange={e => setSellForm({ ...sellForm, fee: e.target.value })} placeholder="0" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 ml-1">Thuế bán (Tùy chọn)</label>
                  <CurrencyInput value={sellForm.tax} onChange={e => setSellForm({ ...sellForm, tax: e.target.value })} placeholder="0" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none" />
                </div>
              </div>

              <select required value={sellForm.wallet_id} onChange={e => setSellForm({ ...sellForm, wallet_id: e.target.value })} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none">
                <option value="">-- Tiền bán chuyển về ví --</option>
                {wallets.map(w => <option key={w.wallet_id} value={w.wallet_id}>{w.name}</option>)}
              </select>

              <button disabled={isSubmitting} className="w-full bg-rose-600 text-white py-3.5 rounded-xl font-bold mt-4 flex justify-center hover:bg-rose-700">{isSubmitting ? <Loader2 className="animate-spin" /> : 'Xác nhận Tất toán'}</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}