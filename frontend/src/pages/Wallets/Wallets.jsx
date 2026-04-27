import React, { useState, useEffect } from 'react';
import { Wallet, Landmark, CreditCard, Activity, Plus, ArrowRightLeft, X, Loader2, TrendingUp, TrendingDown, DollarSign, Edit2, Trash2, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import axiosClient from '../../api/axiosClient';
import CurrencyInput from '../../components/CurrencyInput'

const formatCurrency = (amount) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

// Hàm loại bỏ các ký tự định dạng (chấm, phẩy) để gửi số thực về Backend
const parseCurrency = (value) => {
    if (!value) return 0;
    return Number(value.toString().replace(/[^0-9]/g, ''));
};

const getWalletIcon = (type) => {
  if (type === 'cash') return Wallet;
  if (type === 'bank') return Landmark;
  if (type === 'credit') return CreditCard;
  return Activity;
};

export default function Wallets() {
  const [wallets, setWallets] = useState([]);
  const [summary, setSummary] = useState({ total_assets: 0, total_liabilities: 0, net_worth: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ==========================================
  // STATE CHUYỂN TIỀN
  // ==========================================
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferData, setTransferData] = useState({
    source_wallet_id: '',
    dest_wallet_id: '',
    amount: '',
    note: 'Chuyển tiền nội bộ',
    date: new Date().toISOString().split('T')[0]
  });

  // ==========================================
  // STATE THÊM VÍ MỚI
  // ==========================================
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addWalletData, setAddWalletData] = useState({
    name: '',
    type: 'cash',
    currency: 'VND',
    initial_balance: '',
    credit_limit: ''
  });

  // ==========================================
  // STATE SỬA / XÓA VÍ
  // ==========================================
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false); // <-- STATE POPUP XÓA MỚI
  const [editWalletData, setEditWalletData] = useState({
    wallet_id: '',
    name: '',
    type: 'cash',
    credit_limit: ''
  });

  // ==========================================
  // API: LẤY DỮ LIỆU TỔNG HỢP VÀ DANH SÁCH VÍ
  // ==========================================
  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [walletsRes, summaryRes] = await Promise.all([
          axiosClient.get('/wallets/'),
          axiosClient.get('/wallets/summary')
      ]);

      const walletsData = walletsRes.data || [];
      const summaryData = summaryRes.data || { total_assets: 0, total_liabilities: 0, net_worth: 0 };

      setWallets(walletsData);
      setSummary(summaryData);

      if (walletsData.length >= 2) {
        setTransferData(prev => ({
          ...prev,
          source_wallet_id: walletsData[0].wallet_id,
          dest_wallet_id: walletsData[1].wallet_id
        }));
      }
    } catch (error) {
      console.error("Lỗi tải dữ liệu ví:", error);
      toast.error("Không thể tải dữ liệu ví.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // ==========================================
  // API: XỬ LÝ THÊM VÍ
  // ==========================================
  const handleAddWalletSubmit = async (e) => {
    e.preventDefault();
    if (!addWalletData.name.trim()) return toast.error("Vui lòng nhập tên ví!");

    if (addWalletData.type === 'credit' && !addWalletData.credit_limit) {
        return toast.error("Vui lòng nhập hạn mức tín dụng!");
    }

    setIsSubmitting(true);

    const payload = {
        name: addWalletData.name,
        type: addWalletData.type,
        currency: addWalletData.currency,
        initial_balance: addWalletData.type === 'credit' ? 0 : parseCurrency(addWalletData.initial_balance),
        credit_limit: addWalletData.type === 'credit' ? parseCurrency(addWalletData.credit_limit) : 0
    };

    const promise = axiosClient.post('/wallets/', payload);

    toast.promise(promise, {
      loading: 'Đang tạo ví...',
      success: 'Tạo ví mới thành công! 🏦',
      error: (err) => `Lỗi: ${err.response?.data?.detail || 'Không thể tạo ví'}`
    });

    try {
      await promise;
      setIsAddModalOpen(false);
      setAddWalletData({ name: '', type: 'cash', currency: 'VND', initial_balance: '', credit_limit: '' });
      fetchData();
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ==========================================
  // API: XỬ LÝ CẬP NHẬT VÍ
  // ==========================================
  const openEditModal = (wallet) => {
    setEditWalletData({
        wallet_id: wallet.wallet_id,
        name: wallet.name,
        type: wallet.type,
        credit_limit: wallet.credit_limit ? wallet.credit_limit.toString() : ''
    });
    setIsEditModalOpen(true);
  };

  const handleEditWalletSubmit = async (e) => {
    e.preventDefault();
    if (!editWalletData.name.trim()) return toast.error("Vui lòng nhập tên ví!");

    if (editWalletData.type === 'credit' && !editWalletData.credit_limit) {
        return toast.error("Vui lòng nhập hạn mức tín dụng!");
    }

    setIsSubmitting(true);

    const payload = {
        name: editWalletData.name,
        type: editWalletData.type,
        credit_limit: editWalletData.type === 'credit' ? parseCurrency(editWalletData.credit_limit) : 0
    };

    const promise = axiosClient.put(`/wallets/${editWalletData.wallet_id}`, payload);

    toast.promise(promise, {
      loading: 'Đang cập nhật ví...',
      success: 'Cập nhật ví thành công! ✏️',
      error: (err) => `Lỗi: ${err.response?.data?.detail || 'Không thể cập nhật ví'}`
    });

    try {
      await promise;
      setIsEditModalOpen(false);
      fetchData();
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ==========================================
  // API: XỬ LÝ XÓA VÍ (ĐÃ CẬP NHẬT POPUP)
  // ==========================================
  const executeDeleteWallet = async () => {
    setIsSubmitting(true);
    const promise = axiosClient.delete(`/wallets/${editWalletData.wallet_id}`);

    toast.promise(promise, {
      loading: 'Đang xóa ví...',
      success: 'Đã lưu trữ ví thành công! 🗑️',
      error: (err) => `Lỗi: ${err.response?.data?.detail || 'Không thể xóa ví'}`
    });

    try {
      await promise;
      setIsDeleteConfirmOpen(false); // Đóng popup cảnh báo
      setIsEditModalOpen(false); // Đóng luôn modal edit
      fetchData();
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ==========================================
  // API: XỬ LÝ CHUYỂN TIỀN
  // ==========================================
  const handleTransferSubmit = async (e) => {
    e.preventDefault();
    if (transferData.source_wallet_id.toString() === transferData.dest_wallet_id.toString()) {
        return toast.error("Ví nguồn và ví đích không được trùng nhau!");
    }

    setIsSubmitting(true);
    const transferPromise = axiosClient.post('/transactions/transfer', {
        source_wallet_id: Number(transferData.source_wallet_id),
        dest_wallet_id: Number(transferData.dest_wallet_id),
        amount: parseCurrency(transferData.amount),
        note: transferData.note,
        date: transferData.date
    });

    toast.promise(transferPromise, {
      loading: 'Đang xử lý giao dịch...',
      success: 'Chuyển tiền thành công! 💸',
      error: (err) => `Lỗi: ${err.response?.data?.detail || 'Giao dịch thất bại'}`
    });

    try {
      await transferPromise;
      setIsTransferModalOpen(false);
      setTransferData(prev => ({ ...prev, amount: '' }));
      fetchData();
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-screen text-indigo-600"><Loader2 className="animate-spin" size={40} /></div>;
  }

  const resetEditWalletData = () => setEditWalletData({
  wallet_id: '',
  name: '',
  type: 'cash',
  credit_limit: ''
});

 const resetAddWalletData = () => setAddWalletData({
  wallet_id: '',
  name: '',
  type: 'cash',
  credit_limit: ''
});

  return (
    <div className="p-4 lg:p-8 bg-gray-50 min-h-screen animate-fade-in pb-24">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* HEADER & HÀNH ĐỘNG */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h1 className="text-2xl font-bold text-slate-800">Quản lý Ví & Tài sản</h1>
          <div className="flex gap-3 w-full sm:w-auto">
            <button
                onClick={() => setIsTransferModalOpen(true)}
                disabled={wallets.length < 2}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 px-5 py-2.5 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <ArrowRightLeft size={18} /> Chuyển tiền
            </button>
            <button
                onClick={() => {
                    setIsAddModalOpen(true);
                    resetAddWalletData();
                }}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-medium shadow-sm transition-colors"
            >
                <Plus size={18} /> Thêm ví
            </button>
          </div>
        </div>

        {/* THỐNG KÊ TÀI SẢN (DASHBOARD CARDS) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4">
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl"><DollarSign size={24} /></div>
                <div>
                    <p className="text-sm font-medium text-gray-500">Tài sản ròng (Net Worth)</p>
                    <p className="text-xl font-bold text-slate-800">{formatCurrency(summary.net_worth)}</p>
                </div>
            </div>
            <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4">
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl"><TrendingUp size={24} /></div>
                <div>
                    <p className="text-sm font-medium text-gray-500">Tổng tài sản (+)</p>
                    <p className="text-xl font-bold text-emerald-600">{formatCurrency(summary.total_assets)}</p>
                </div>
            </div>
            <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4">
                <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl"><TrendingDown size={24} /></div>
                <div>
                    <p className="text-sm font-medium text-gray-500">Tổng dư nợ (-)</p>
                    <p className="text-xl font-bold text-rose-600">{formatCurrency(summary.total_liabilities)}</p>
                </div>
            </div>
        </div>

        {/* DANH SÁCH VÍ */}
        {wallets.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-200 text-gray-500">
             Chưa có ví tiền nào. Hãy ấn nút "Thêm ví" để bắt đầu!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {wallets.map(wallet => {
              const IconComponent = getWalletIcon(wallet.type);
              const isDebt = wallet.balance < 0 || wallet.type === 'credit';

              return (
                <div key={wallet.wallet_id} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
                  <div className={`absolute -right-6 -top-6 w-24 h-24 rounded-full opacity-50 group-hover:scale-150 transition-transform duration-500 ${isDebt ? 'bg-rose-50' : 'bg-indigo-50'}`}></div>

                  <div className="flex justify-between items-start mb-6 relative z-10">
                    <div className="flex gap-3 items-center">
                        <div className={`p-3 rounded-2xl ${isDebt ? 'bg-rose-100 text-rose-600' : 'bg-indigo-100 text-indigo-600'}`}>
                          <IconComponent size={24} />
                        </div>
                        <span className="text-xs font-semibold bg-gray-100 text-gray-500 px-3 py-1 rounded-full uppercase tracking-wider">
                          {wallet.type}
                        </span>
                    </div>

                    {/* NÚT CHỈNH SỬA VÍ */}
                    <button
                        onClick={() => openEditModal(wallet)}
                        className="p-2 text-gray-400 hover:text-indigo-600 bg-gray-50 hover:bg-indigo-50 rounded-full transition-colors"
                        title="Chỉnh sửa ví"
                    >
                        <Edit2 size={18} />
                    </button>
                  </div>

                  <div className="relative z-10">
                    <h3 className="text-lg font-semibold text-slate-700 mb-1">{wallet.name}</h3>
                    <p className={`text-2xl font-bold ${isDebt && wallet.balance !== 0 ? 'text-rose-600' : 'text-slate-800'}`}>
                        {formatCurrency(wallet.balance)}
                    </p>
                    {wallet.type === 'credit' && (
                        <p className="text-sm text-gray-500 mt-2 font-medium">Hạn mức: {formatCurrency(wallet.credit_limit)}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ========================================== */}
      {/* MODAL THÊM VÍ MỚI */}
      {/* ========================================== */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-slide-up">

            <div className="flex justify-between items-center p-5 lg:p-6 border-b border-gray-100">
              <h3 className="font-bold text-xl text-slate-800 flex items-center gap-2">
                 <Plus className="text-indigo-600" /> Thêm ví mới
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-gray-400 hover:text-rose-500 transition-colors bg-gray-50 p-2 rounded-full">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddWalletSubmit} className="p-5 lg:p-6 space-y-5 bg-gray-50/50">
              <div>
                <label className="text-sm font-medium text-gray-600 block mb-1.5">Tên ví <span className="text-rose-500">*</span></label>
                <input
                  type="text" required
                  value={addWalletData.name}
                  onChange={(e) => setAddWalletData({...addWalletData, name: e.target.value})}
                  placeholder="VD: Tiền mặt, Thẻ Techcombank..."
                  className="w-full bg-white border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none rounded-xl p-3 text-slate-800 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600 block mb-1.5">Loại ví</label>
                    <select
                      value={addWalletData.type}
                      onChange={(e) => setAddWalletData({...addWalletData, type: e.target.value})}
                      className="w-full bg-white border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none rounded-xl p-3 cursor-pointer text-slate-700 font-medium"
                    >
                      <option value="cash">Tiền mặt</option>
                      <option value="bank">Ngân hàng</option>
                      <option value="credit">Thẻ tín dụng</option>
                      <option value="e_wallet">Ví điện tử</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600 block mb-1.5">Tiền tệ</label>
                    <select
                      value={addWalletData.currency}
                      onChange={(e) => setAddWalletData({...addWalletData, currency: e.target.value})}
                      className="w-full bg-white border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none rounded-xl p-3 cursor-pointer text-slate-700 font-medium"
                    >
                      <option value="VND">VND</option>
                      <option value="USD">USD</option>
                    </select>
                  </div>
              </div>

              {/* RENDER THEO LOẠI VÍ */}
              {addWalletData.type === 'credit' ? (
                  <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100">
                      <label className="text-sm font-semibold text-indigo-700 block mb-1.5">Hạn mức tín dụng <span className="text-rose-500">*</span></label>
                      <CurrencyInput
                          required
                          value={addWalletData.credit_limit}
                          onChange={(e) => setAddWalletData({...addWalletData, credit_limit: e.target.value})}
                          placeholder="VD: 20.000.000"
                          className="w-full border-b-2 border-indigo-200 bg-transparent py-2 text-2xl font-bold text-indigo-800 focus:outline-none focus:border-indigo-500 transition-colors"
                      />
                      <p className="text-xs text-indigo-500 mt-2 font-medium">* Dư nợ ban đầu của thẻ sẽ là 0đ.</p>
                  </div>
              ) : (
                  <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                      <label className="text-sm font-semibold text-emerald-700 block mb-1.5">Số dư ban đầu</label>
                      <CurrencyInput
                          value={addWalletData.initial_balance}
                          onChange={(e) => setAddWalletData({...addWalletData, initial_balance: e.target.value})}
                          placeholder="0"
                          className="w-full border-b-2 border-emerald-200 bg-transparent py-2 text-2xl font-bold text-emerald-800 focus:outline-none focus:border-emerald-500 transition-colors"
                      />
                      <p className="text-xs text-emerald-600 mt-2 font-medium">* Hệ thống sẽ tạo một giao dịch thu nhập khởi tạo.</p>
                  </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 rounded-xl font-bold transition-colors mt-2 shadow-sm shadow-indigo-200 disabled:opacity-70 flex justify-center items-center gap-2"
              >
                {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : 'Tạo ví ngay'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL CẬP NHẬT / SỬA VÍ */}
      {/* ========================================== */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center px-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-slide-up">

            <div className="flex justify-between items-center p-5 lg:p-6 border-b border-gray-100">
              <h3 className="font-bold text-xl text-slate-800 flex items-center gap-2">
                 <Edit2 className="text-indigo-600" /> Cập nhật ví
              </h3>
              <button onClick={() => { setIsEditModalOpen(false); resetEditWalletData(); }} className="text-gray-400 hover:text-rose-500 transition-colors bg-gray-50 p-2 rounded-full">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleEditWalletSubmit} className="p-5 lg:p-6 space-y-5 bg-gray-50/50">
              <div>
                <label className="text-sm font-medium text-gray-600 block mb-1.5">Tên ví <span className="text-rose-500">*</span></label>
                <input
                  type="text" required
                  value={editWalletData.name}
                  onChange={(e) => setEditWalletData({...editWalletData, name: e.target.value})}
                  placeholder="VD: Tiền mặt, Thẻ Techcombank..."
                  className="w-full bg-white border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none rounded-xl p-3 text-slate-800 font-medium"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-600 block mb-1.5">Loại ví</label>
                <select
                  value={editWalletData.type}
                  onChange={(e) => setEditWalletData({...editWalletData, type: e.target.value})}
                  className="w-full bg-white border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none rounded-xl p-3 cursor-pointer text-slate-700 font-medium"
                >
                  <option value="cash">Tiền mặt</option>
                  <option value="bank">Ngân hàng</option>
                  <option value="credit">Thẻ tín dụng</option>
                  <option value="e_wallet">Ví điện tử</option>
                </select>
              </div>

              {/* Hạn mức thẻ tín dụng */}
              {editWalletData.type === 'credit' && (
                  <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100">
                      <label className="text-sm font-semibold text-indigo-700 block mb-1.5">Hạn mức tín dụng <span className="text-rose-500">*</span></label>
                      <CurrencyInput
                          required
                          value={editWalletData.credit_limit}
                          onChange={(e) => setEditWalletData({...editWalletData, credit_limit: e.target.value})}
                          placeholder="VD: 20.000.000"
                          className="w-full border-b-2 border-indigo-200 bg-transparent py-2 text-2xl font-bold text-indigo-800 focus:outline-none focus:border-indigo-500 transition-colors"
                      />
                  </div>
              )}

              <div className="flex flex-col gap-3 mt-6">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 rounded-xl font-bold transition-colors shadow-sm shadow-indigo-200 disabled:opacity-70 flex justify-center items-center gap-2"
                  >
                    {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : 'Lưu thay đổi'}
                  </button>

                  {/* NÚT XÓA VÍ: Mở popup xác nhận thay vì xóa ngay */}
                  <button
                    type="button"
                    onClick={() => setIsDeleteConfirmOpen(true)}
                    disabled={isSubmitting}
                    className="w-full bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 py-3.5 rounded-xl font-bold transition-colors flex justify-center items-center gap-2"
                  >
                    <Trash2 size={18} /> Xóa ví này
                  </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* POPUP XÁC NHẬN XÓA (CUSTOM MODAL) */}
      {/* ========================================== */}
      {isDeleteConfirmOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-slide-up p-6 text-center">
             <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
                 <AlertTriangle size={32} className="text-rose-600" />
             </div>
             <h3 className="text-xl font-bold text-slate-800 mb-2">Bạn có chắc chắn?</h3>
             <p className="text-sm text-gray-500 mb-6 leading-relaxed">
                 Ví <span className="font-bold text-slate-700">"{editWalletData.name}"</span> sẽ được ẩn đi. Các giao dịch cũ liên quan đến ví này vẫn sẽ được lưu trong lịch sử hệ thống.
             </p>
             <div className="flex gap-3">
                 <button
                     onClick={() => setIsDeleteConfirmOpen(false)}
                     disabled={isSubmitting}
                     className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-xl font-bold transition-colors"
                 >
                     Hủy bỏ
                 </button>
                 <button
                     onClick={executeDeleteWallet}
                     disabled={isSubmitting}
                     className="flex-1 bg-rose-600 hover:bg-rose-700 text-white py-3 rounded-xl font-bold transition-colors flex justify-center items-center gap-2 disabled:opacity-70 shadow-sm shadow-rose-200"
                 >
                     {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : 'Xác nhận Xóa'}
                 </button>
             </div>
          </div>
        </div>
      )}

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