import React, { useState, useEffect } from 'react';
import { Wallet, Landmark, CreditCard, Activity, Plus, ArrowRightLeft, X, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import axiosClient from '../../api/axiosClient';
import CurrencyInput from '../../components/CurrencyInput'

const formatCurrency = (amount) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

const getWalletIcon = (type) => {
  if (type === 'cash') return Wallet;
  if (type === 'bank') return Landmark;
  if (type === 'credit') return CreditCard;
  return Activity;
};

export default function Wallets() {
  const [wallets, setWallets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // State quản lý Modal Chuyển tiền
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [transferData, setTransferData] = useState({
    source_wallet_id: '',
    dest_wallet_id: '',
    amount: '',
    note: 'Chuyển tiền nội bộ',
    date: new Date().toISOString().split('T')[0]
  });

  // Lấy danh sách Ví
  const fetchWallets = async () => {
    try {
      const res = await axiosClient.get('/wallets/');
      const data = res.data || res;
      setWallets(data);

      // Khởi tạo giá trị mặc định cho form chuyển tiền nếu có ít nhất 2 ví
      if (data.length >= 2) {
        setTransferData(prev => ({
          ...prev,
          source_wallet_id: data[0].wallet_id,
          dest_wallet_id: data[1].wallet_id
        }));
      }
    } catch (error) {
      console.error("Lỗi tải danh sách ví:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWallets();
  }, []);

  // Xử lý submit Chuyển tiền
  const handleTransferSubmit = async (e) => {
    e.preventDefault();
    if (transferData.source_wallet_id === transferData.dest_wallet_id) {
        toast.error("Ví nguồn và ví đích không được trùng nhau!"); // Đổi alert thành toast.error
        return;
    }

    setIsSubmitting(true);
    // Dùng toast.promise để tạo hiệu ứng loading chờ API gọi xong
    const transferPromise = axiosClient.post('/transactions/transfer', {
        source_wallet_id: Number(transferData.source_wallet_id),
        dest_wallet_id: Number(transferData.dest_wallet_id),
        amount: Number(transferData.amount),
        note: transferData.note,
        date: transferData.date
    });

    toast.promise(transferPromise, {
      loading: 'Đang xử lý giao dịch...',
      success: 'Chuyển tiền thành công! 💸',
      error: (err) => `Lỗi: ${err.response?.data?.detail || 'Vui lòng kiểm tra lại số dư'}`
    });

    try {
      await transferPromise;

      setIsTransferModalOpen(false); // Đóng modal
      setTransferData(prev => ({ ...prev, amount: '' })); // Reset số tiền
      fetchWallets(); // Load lại số dư các ví

    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-screen text-indigo-600"><Loader2 className="animate-spin" size={40} /></div>;
  }

  // Tính tổng tài sản
  const totalAssets = wallets.reduce((sum, w) => sum + Number(w.balance || 0), 0);

  return (
    <div className="p-4 lg:p-8 bg-gray-50 min-h-screen animate-fade-in pb-24">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* HEADER */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-5 lg:p-6 rounded-3xl shadow-sm border border-gray-100 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Quản lý Ví tiền</h1>
            <p className="text-gray-500 mt-1">Tổng tài sản: <span className="font-bold text-indigo-600">{formatCurrency(totalAssets)}</span></p>
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            <button
                onClick={() => setIsTransferModalOpen(true)}
                disabled={wallets.length < 2}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 px-5 py-2.5 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <ArrowRightLeft size={18} /> Chuyển tiền
            </button>
            <button className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-medium shadow-sm transition-colors">
                <Plus size={18} /> Thêm ví
            </button>
          </div>
        </div>

        {/* DANH SÁCH VÍ */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {wallets.map(wallet => {
            const IconComponent = getWalletIcon(wallet.type);
            return (
              <div key={wallet.wallet_id} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
                {/* Decoration background */}
                <div className="absolute -right-6 -top-6 w-24 h-24 bg-indigo-50 rounded-full opacity-50 group-hover:scale-150 transition-transform duration-500"></div>

                <div className="flex justify-between items-start mb-6 relative z-10">
                  <div className="p-3 rounded-2xl bg-indigo-100 text-indigo-600">
                    <IconComponent size={24} />
                  </div>
                  <span className="text-xs font-semibold bg-gray-100 text-gray-500 px-3 py-1 rounded-full uppercase tracking-wider">
                    {wallet.type}
                  </span>
                </div>

                <div className="relative z-10">
                  <h3 className="text-lg font-semibold text-slate-700 mb-1">{wallet.name}</h3>
                  <p className="text-3xl font-bold text-slate-800">{formatCurrency(wallet.balance)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ========================================== */}
      {/* MODAL CHUYỂN TIỀN */}
      {/* ========================================== */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-slide-up">

            <div className="flex justify-between items-center p-5 lg:p-6 border-b border-gray-100">
              <h3 className="font-bold text-xl text-slate-800 flex items-center gap-2">
                 <ArrowRightLeft className="text-emerald-500" /> Chuyển tiền nội bộ
              </h3>
              <button onClick={() => setIsTransferModalOpen(false)} className="text-gray-400 hover:text-rose-500 transition-colors bg-gray-50 p-2 rounded-full">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleTransferSubmit} className="p-5 lg:p-6 space-y-5">

              <div className="flex flex-col gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                  {/* Ví Nguồn */}
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Từ ví (Trừ tiền)</label>
                    <select
                        required
                        value={transferData.source_wallet_id}
                        onChange={(e) => setTransferData({...transferData, source_wallet_id: e.target.value})}
                        className="w-full bg-white border border-gray-200 focus:ring-2 focus:ring-emerald-500 rounded-xl p-3 text-slate-700 font-medium outline-none"
                    >
                        {wallets.map(w => (
                            <option key={`src-${w.wallet_id}`} value={w.wallet_id}>
                                {w.name} ({formatCurrency(w.balance)})
                            </option>
                        ))}
                    </select>
                  </div>

                  {/* Icon mũi tên xuống */}
                  <div className="flex justify-center -my-3 relative z-10">
                      <div className="bg-white p-1.5 rounded-full border border-gray-200 text-gray-400 shadow-sm">
                          <ArrowRightLeft size={16} className="rotate-90" />
                      </div>
                  </div>

                  {/* Ví Đích */}
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Đến ví (Cộng tiền)</label>
                    <select
                        required
                        value={transferData.dest_wallet_id}
                        onChange={(e) => setTransferData({...transferData, dest_wallet_id: e.target.value})}
                        className="w-full bg-white border border-gray-200 focus:ring-2 focus:ring-emerald-500 rounded-xl p-3 text-slate-700 font-medium outline-none"
                    >
                        {wallets.map(w => (
                            <option
                                key={`dest-${w.wallet_id}`}
                                value={w.wallet_id}
                                disabled={w.wallet_id.toString() === transferData.source_wallet_id.toString()}
                            >
                                {w.name} {w.wallet_id.toString() === transferData.source_wallet_id.toString() ? '(Đang chọn)' : ''}
                            </option>
                        ))}
                    </select>
                  </div>
              </div>

              {/* Số tiền */}
              <div>
                <label className="text-sm font-medium text-gray-600 block mb-1.5">Số tiền chuyển</label>

                <CurrencyInput
                    required
                    value={transferData.amount}
                    onChange={(e) => setTransferData({...transferData, amount: e.target.value})}
                    placeholder="VD: 500.000"
                    className="w-full border-b-2 border-gray-200 py-2 text-2xl font-bold focus:outline-none focus:border-emerald-500 transition-colors text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="text-sm font-medium text-gray-600 block mb-1.5">Ngày chuyển</label>
                    <input
                        type="date" required
                        value={transferData.date}
                        onChange={(e) => setTransferData({...transferData, date: e.target.value})}
                        className="w-full bg-gray-50 border border-gray-200 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none rounded-xl p-3"
                    />
                 </div>
                 <div>
                    <label className="text-sm font-medium text-gray-600 block mb-1.5">Ghi chú</label>
                    <input
                        type="text"
                        value={transferData.note}
                        onChange={(e) => setTransferData({...transferData, note: e.target.value})}
                        className="w-full bg-gray-50 border border-gray-200 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none rounded-xl p-3"
                    />
                 </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-3.5 rounded-xl font-bold transition-colors mt-4 shadow-sm shadow-emerald-200 disabled:opacity-70 flex justify-center items-center gap-2"
              >
                {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : 'Xác nhận chuyển'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}