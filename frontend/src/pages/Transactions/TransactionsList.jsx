import React, { useState, useEffect } from 'react';
import { Filter, Download, Trash2, Loader2, AlertTriangle, Edit2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import axiosClient from '../../api/axiosClient';
import CurrencyInput from '../../components/CurrencyInput';

const formatCurrency = (amount) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

// Hàm loại bỏ định dạng tiền tệ trước khi gửi API
const parseCurrency = (value) => {
    if (!value) return 0;
    return Number(value.toString().replace(/[^0-9]/g, ''));
};

export default function TransactionsList() {
  const [transactions, setTransactions] = useState([]);
  const [walletMap, setWalletMap] = useState({});
  const [categoryMap, setCategoryMap] = useState({});
  const [categoriesList, setCategoriesList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Trạng thái loading phụ
  const [deletingId, setDeletingId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // State quản lý bộ lọc
  const [filterType, setFilterType] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');

  // State quản lý Popup Xóa
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState(null);

  // State quản lý Modal Cập nhật (Edit)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    transaction_id: null,
    amount: '',
    category_id: '',
    date: '',
    note: '',
    transaction_type: 'expense'
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [walletsRes, categoriesRes, txRes] = await Promise.all([
        axiosClient.get('/wallets/'),
        axiosClient.get('/categories/'),
        axiosClient.get('/transactions/?page=1&size=100')
      ]);

      const walletsData = walletsRes.data || walletsRes || [];
      const categoriesData = categoriesRes.data || categoriesRes || [];

      let txData = [];
      if (txRes?.data?.items) txData = txRes.data.items;
      else if (txRes?.items) txData = txRes.items;
      else if (Array.isArray(txRes?.data)) txData = txRes.data;
      else if (Array.isArray(txRes)) txData = txRes;

      const wMap = {};
      if (Array.isArray(walletsData)) {
          walletsData.forEach(w => { wMap[w.wallet_id] = w.name; });
      }
      setWalletMap(wMap);

      const cMap = {};
      const cList = [];
      const flattenCategories = (cats) => {
        if (!Array.isArray(cats)) return;
        cats.forEach(c => {
          cMap[c.category_id] = { name: c.name, icon: c.icon || '📌', type: c.type };
          cList.push({ id: c.category_id, name: c.name, icon: c.icon || '📌', type: c.type });
          if (c.subcategories && Array.isArray(c.subcategories)) {
            flattenCategories(c.subcategories);
          }
        });
      };
      flattenCategories(categoriesData);

      setCategoryMap(cMap);
      setCategoriesList(cList);
      setTransactions(txData);

    } catch (error) {
      console.error("Lỗi tải dữ liệu giao dịch:", error);
      toast.error("Không thể tải danh sách giao dịch");
    } finally {
      setIsLoading(false);
    }
  };

  const handleTypeChange = (type) => {
      setFilterType(type);
      setFilterCategory('all');
  };

  const filteredTransactions = transactions.filter(tx => {
    const matchType = filterType === 'all' || tx.transaction_type === filterType;
    const matchCategory = filterCategory === 'all' || tx.category_id.toString() === filterCategory;
    return matchType && matchCategory;
  });

  // ==========================================
  // XỬ LÝ XÓA GIAO DỊCH
  // ==========================================
  const handleDeleteClick = (e, tx) => {
    e.stopPropagation();
    setTransactionToDelete(tx);
    setIsDeleteConfirmOpen(true);
  };

  const executeDelete = async () => {
    if (!transactionToDelete) return;
    const transactionId = transactionToDelete.transaction_id;
    setDeletingId(transactionId);
    setIsDeleteConfirmOpen(false);

    const promise = axiosClient.delete(`/transactions/${transactionId}`);
    toast.promise(promise, {
      loading: 'Đang xóa giao dịch...',
      success: 'Đã xóa và hoàn tiền vào ví! ♻️',
      error: (err) => `Lỗi: ${err.response?.data?.detail || "Không thể xóa"}`
    });

    try {
      await promise;
      setTransactions(prev => prev.filter(tx => tx.transaction_id !== transactionId));
    } catch (error) {
      console.error(error);
    } finally {
      setDeletingId(null);
      setTransactionToDelete(null);
    }
  };

  // ==========================================
  // XỬ LÝ CẬP NHẬT GIAO DỊCH
  // ==========================================
  const handleEditClick = (e, tx) => {
    e.stopPropagation();
    setEditFormData({
        transaction_id: tx.transaction_id,
        amount: Math.floor(Number(tx.amount)).toString(),
        category_id: tx.category_id,
        date: tx.date,
        note: tx.note || '',
        transaction_type: tx.transaction_type // Lưu lại để filter dropdown
    });
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e) => {
      e.preventDefault();
      setIsSubmitting(true);

      const payload = {
          amount: parseCurrency(editFormData.amount),
          category_id: Number(editFormData.category_id),
          date: editFormData.date,
          note: editFormData.note
      };

      const promise = axiosClient.put(`/transactions/${editFormData.transaction_id}`, payload);

      toast.promise(promise, {
          loading: 'Đang cập nhật...',
          success: 'Cập nhật thành công! ✏️',
          error: (err) => `Lỗi: ${err.response?.data?.detail || "Cập nhật thất bại"}`
      });

      try {
          await promise;
          setIsEditModalOpen(false);
          fetchData(); // Tải lại toàn bộ dữ liệu để đồng bộ UI và số liệu
      } catch (error) {
          console.error(error);
      } finally {
          setIsSubmitting(false);
      }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen pb-20 text-indigo-600">
        <Loader2 className="animate-spin" size={40} />
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen pb-24 lg:py-8 animate-fade-in">
      <div className="max-w-4xl mx-auto space-y-6 px-4 lg:px-0">

        {/* Header & Filter */}
        <div className="bg-white p-5 lg:p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mt-4 lg:mt-0">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Lịch sử giao dịch</h2>
            <p className="text-sm text-gray-500 mt-1">Quản lý các khoản thu chi của bạn</p>
          </div>

          <div className="flex flex-col sm:flex-row flex-wrap gap-3 w-full lg:w-auto items-start sm:items-center">

            {/* Lọc theo Loại (Thu/Chi) */}
            <div className="flex gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0 hide-scrollbar">
                <button onClick={() => handleTypeChange('all')} className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${filterType === 'all' ? 'bg-slate-800 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>Tất cả</button>
                <button onClick={() => handleTypeChange('expense')} className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${filterType === 'expense' ? 'bg-rose-500 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>Chi phí</button>
                <button onClick={() => handleTypeChange('income')} className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${filterType === 'income' ? 'bg-emerald-500 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>Thu nhập</button>
            </div>

            {/* Lọc theo Danh mục */}
            <div className="flex items-center gap-2 w-full sm:w-auto min-w-[180px] max-w-xs">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                    <Filter size={18} />
                </div>
                <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="flex-1 bg-gray-50 border border-gray-200 text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 font-medium cursor-pointer truncate"
                >
                    <option value="all">Mọi danh mục</option>
                    {categoriesList
                        .filter(c => filterType === 'all' || c.type === filterType)
                        .map(c => (
                            <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                        ))
                    }
                </select>
            </div>
          </div>
        </div>

        {/* Transaction List */}
        <div className="space-y-3">
            {filteredTransactions.length === 0 ? (
              <div className="text-center py-16 text-gray-500 bg-white rounded-3xl border border-dashed border-gray-200">
                Không tìm thấy giao dịch nào phù hợp.
              </div>
            ) : (
              filteredTransactions.map(tx => {
                const isIncome = tx.transaction_type === 'income';
                const catInfo = categoryMap[tx.category_id] || { name: 'Khác', icon: '❓' };
                const walletName = walletMap[tx.wallet_id] || 'Ví ẩn';
                const isDeletingThis = deletingId === tx.transaction_id;

                return (
                  <div key={tx.transaction_id} className={`flex items-center justify-between p-4 lg:p-5 bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md transition-all ${isDeletingThis ? 'opacity-50 pointer-events-none' : ''}`}>
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 lg:w-14 lg:h-14 rounded-full flex items-center justify-center text-xl lg:text-2xl border border-gray-100 ${isIncome ? 'bg-emerald-50' : 'bg-rose-50'}`}>
                        {catInfo.icon}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800 lg:text-lg">{catInfo.name}</p>
                        <p className="text-xs lg:text-sm text-gray-500 mt-0.5">{walletName} • {tx.date}</p>
                        {tx.note && <p className="text-xs text-gray-400 mt-1 italic line-clamp-1">"{tx.note}"</p>}
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1 sm:gap-3 lg:gap-4">
                        <div className={`font-bold text-right lg:text-lg ${isIncome ? 'text-emerald-600' : 'text-slate-800'}`}>
                           {isIncome ? '+' : '-'}{formatCurrency(tx.amount)}
                        </div>
                        {/* Nhóm nút Hành động */}
                        <div className="flex items-center -mr-2 sm:mr-0">
                            <button
                                onClick={(e) => handleEditClick(e, tx)}
                                disabled={isDeletingThis}
                                className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
                                title="Sửa giao dịch"
                            >
                                <Edit2 size={18} />
                            </button>
                            <button
                                onClick={(e) => handleDeleteClick(e, tx)}
                                disabled={isDeletingThis}
                                className="p-2 text-gray-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-colors"
                                title="Xóa giao dịch"
                            >
                                {isDeletingThis ? <Loader2 size={18} className="animate-spin text-rose-500" /> : <Trash2 size={18} />}
                            </button>
                        </div>
                    </div>
                  </div>
                );
              })
            )}
        </div>
      </div>

      {/* ========================================== */}
      {/* MODAL CẬP NHẬT GIAO DỊCH */}
      {/* ========================================== */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-slide-up">

            <div className="flex justify-between items-center p-5 lg:p-6 border-b border-gray-100">
              <h3 className="font-bold text-xl text-slate-800 flex items-center gap-2">
                 <Edit2 className="text-indigo-600" /> Cập nhật giao dịch
              </h3>
              <button onClick={() => setIsEditModalOpen(false)} className="text-gray-400 hover:text-rose-500 transition-colors bg-gray-50 p-2 rounded-full">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-5 lg:p-6 space-y-5 bg-gray-50/50">
              {/* Số tiền */}
              <div className={`p-4 rounded-2xl border ${editFormData.transaction_type === 'income' ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
                  <label className={`text-sm font-semibold block mb-1.5 ${editFormData.transaction_type === 'income' ? 'text-emerald-700' : 'text-rose-700'}`}>
                      Số tiền {editFormData.transaction_type === 'income' ? 'thu' : 'chi'} <span className="text-rose-500">*</span>
                  </label>
                  <CurrencyInput
                      required
                      value={editFormData.amount}
                      onChange={(e) => setEditFormData({...editFormData, amount: e.target.value})}
                      placeholder="VD: 50.000"
                      className={`w-full border-b-2 bg-transparent py-2 text-2xl font-bold focus:outline-none transition-colors ${editFormData.transaction_type === 'income' ? 'border-emerald-200 text-emerald-800 focus:border-emerald-500' : 'border-rose-200 text-rose-800 focus:border-rose-500'}`}
                  />
              </div>

              {/* Danh mục & Ngày */}
              <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600 block mb-1.5">Danh mục</label>
                    <select
                      value={editFormData.category_id}
                      onChange={(e) => setEditFormData({...editFormData, category_id: e.target.value})}
                      className="w-full bg-white border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none rounded-xl p-3 cursor-pointer text-slate-700 font-medium truncate"
                    >
                        {categoriesList
                            .filter(c => c.type === editFormData.transaction_type)
                            .map(c => (
                                <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                            ))
                        }
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600 block mb-1.5">Ngày giao dịch</label>
                    <input
                        type="date" required
                        value={editFormData.date}
                        onChange={(e) => setEditFormData({...editFormData, date: e.target.value})}
                        className="w-full bg-white border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none rounded-xl p-3 font-medium text-slate-700"
                    />
                 </div>
              </div>

              {/* Ghi chú */}
              <div>
                <label className="text-sm font-medium text-gray-600 block mb-1.5">Ghi chú</label>
                <input
                  type="text"
                  value={editFormData.note}
                  onChange={(e) => setEditFormData({...editFormData, note: e.target.value})}
                  placeholder="Ghi chú thêm..."
                  className="w-full bg-white border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none rounded-xl p-3 text-slate-800 font-medium"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 rounded-xl font-bold transition-colors mt-2 shadow-sm shadow-indigo-200 disabled:opacity-70 flex justify-center items-center gap-2"
              >
                {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : 'Lưu thay đổi'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* POPUP XÁC NHẬN XÓA */}
      {/* ========================================== */}
      {isDeleteConfirmOpen && transactionToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-slide-up p-6 text-center">
             <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
                 <AlertTriangle size={32} className="text-rose-600" />
             </div>
             <h3 className="text-xl font-bold text-slate-800 mb-2">Xóa giao dịch này?</h3>
             <p className="text-sm text-gray-500 mb-6 leading-relaxed">
                 Bạn có chắc chắn muốn xóa khoản {transactionToDelete.transaction_type === 'income' ? 'thu nhập' : 'chi tiêu'} <span className="font-bold text-slate-700">{formatCurrency(transactionToDelete.amount)}</span> này? Số tiền sẽ tự động được hoàn lại vào ví.
             </p>
             <div className="flex gap-3">
                 <button
                     onClick={() => { setIsDeleteConfirmOpen(false); setTransactionToDelete(null); }}
                     className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-xl font-bold transition-colors"
                 >
                     Hủy bỏ
                 </button>
                 <button
                     onClick={executeDelete}
                     className="flex-1 bg-rose-600 hover:bg-rose-700 text-white py-3 rounded-xl font-bold transition-colors flex justify-center items-center gap-2 shadow-sm shadow-rose-200"
                 >
                     Xác nhận Xóa
                 </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}