import React, { useState, useEffect } from 'react';
import { Filter, Trash2, Loader2, AlertTriangle, Edit2, X, ChevronLeft, ChevronRight, Calendar, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import axiosClient from '../../api/axiosClient';
import CurrencyInput from '../../components/CurrencyInput';
import ImportModal from '../../components/ImportModal';

const formatCurrency = (amount) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

// Hàm loại bỏ định dạng tiền tệ trước khi gửi API
const parseCurrency = (value) => {
    if (!value) return 0;
    return Number(value.toString().replace(/[^0-9]/g, ''));
};

export default function TransactionsList() {
  const [transactions, setTransactions] = useState([]);
  const [walletMap, setWalletMap] = useState({});
  const [walletsList, setWalletsList] = useState([]); // Needed for ImportModal
  const [categoryMap, setCategoryMap] = useState({});
  const [categoriesList, setCategoriesList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingTx, setIsFetchingTx] = useState(false); // Trạng thái loading riêng cho mảng giao dịch

  // ==========================================
  // STATE: PHÂN TRANG VÀ BỘ LỌC (SERVER-SIDE)
  // ==========================================
  const [page, setPage] = useState(1);
  const [size] = useState(20); // Mặc định 20 giao dịch 1 trang
  const [totalItems, setTotalItems] = useState(0);

  const [filterType, setFilterType] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Trạng thái loading phụ
  const [deletingId, setDeletingId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // State quản lý Popup Xóa & Sửa
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    transaction_id: null,
    amount: '',
    category_id: '',
    date: '',
    note: '',
    transaction_type: 'expense'
  });

  // ==========================================
  // LẤY DỮ LIỆU METADATA (VÍ, DANH MỤC) - CHỈ CHẠY 1 LẦN
  // ==========================================
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const [walletsRes, categoriesRes] = await Promise.all([
          axiosClient.get('/wallets/'),
          axiosClient.get('/categories/')
        ]);

        const walletsData = walletsRes.data || walletsRes || [];
        const categoriesData = categoriesRes.data || categoriesRes || [];

        const wMap = {};
        if (Array.isArray(walletsData)) {
            walletsData.forEach(w => { wMap[w.wallet_id] = w.name; });
            setWalletsList(walletsData);
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
      } catch (error) {
        console.error("Lỗi tải metadata:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchMetadata();
  }, []);

  // ==========================================
  // LẤY DỮ LIỆU GIAO DỊCH - CHẠY LẠI MỖI KHI FILTER HOẶC PAGE THAY ĐỔI
  // ==========================================
  const fetchTransactions = async () => {
    // Chặn gọi API nếu ngày bắt đầu > ngày kết thúc
    if (startDate && endDate && startDate > endDate) {
        toast.error("Ngày bắt đầu không được lớn hơn ngày kết thúc!");
        return;
    }

    try {
      setIsFetchingTx(true);
      // Xây dựng query params gửi xuống Backend
      let query = `?page=${page}&size=${size}`;
      if (filterType !== 'all') query += `&type=${filterType}`;
      if (filterCategory !== 'all') query += `&category_id=${filterCategory}`;
      if (startDate) query += `&start_date=${startDate}`;
      if (endDate) query += `&end_date=${endDate}`;

      const txRes = await axiosClient.get(`/transactions/${query}`);

      let txData = [];
      let total = 0;

      // Bóc tách dữ liệu theo chuẩn phân trang API Design
      if (txRes?.data?.items) {
          txData = txRes.data.items;
          total = txRes.data.total;
      } else if (txRes?.items) {
          txData = txRes.items;
          total = txRes.total;
      } else if (Array.isArray(txRes?.data)) {
          txData = txRes.data;
      } else if (Array.isArray(txRes)) {
          txData = txRes;
      }

      setTransactions(txData);
      setTotalItems(total);

    } catch (error) {
      console.error("Lỗi tải dữ liệu giao dịch:", error);
      toast.error("Không thể tải danh sách giao dịch");
    } finally {
      setIsFetchingTx(false);
    }
  };

  // Lắng nghe sự thay đổi của Filter và Page để gọi lại API
  useEffect(() => {
    if (!isLoading) {
       fetchTransactions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filterType, filterCategory, startDate, endDate, isLoading]);


  // ==========================================
  // HÀM XỬ LÝ THAY ĐỔI FILTER (RESET PAGE VỀ 1)
  // ==========================================
  const handleFilterChange = (setter, value) => {
      setter(value);
      setPage(1); // Bắt buộc reset về trang 1 khi đổi bộ lọc
  };

  const handleTypeChange = (type) => {
      setFilterType(type);
      setFilterCategory('all'); // Đổi loại (Thu/Chi) thì reset luôn Danh mục
      setPage(1);
  };

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
      fetchTransactions(); // Tải lại trang hiện tại để đồng bộ tổng số lượng
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
        transaction_type: tx.transaction_type
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
          fetchTransactions(); // Tải lại để đồng bộ số liệu UI
      } catch (error) {
          console.error(error);
      } finally {
          setIsSubmitting(false);
      }
  };

  // Tính toán số trang
  const totalPages = Math.ceil(totalItems / size) || 1;

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

        {/* HEADER & FILTER */}
        <div className="bg-white p-5 lg:p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col gap-5 mt-4 lg:mt-0">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-800">Lịch sử giao dịch</h2>
              <p className="text-sm text-gray-500 mt-1">Quản lý và tra cứu các khoản thu chi của bạn</p>
            </div>
            <button
                onClick={() => setIsImportModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl font-bold shadow-sm transition-colors w-full sm:w-auto justify-center"
            >
               <Download size={18} /> Nhập dữ liệu tự động
            </button>
          </div>

          <div className="flex flex-col xl:flex-row flex-wrap gap-4 w-full">
            {/* Bộ lọc Loại (Thu/Chi) */}
            <div className="flex gap-2 w-full xl:w-auto overflow-x-auto pb-1 sm:pb-0 hide-scrollbar shrink-0">
                <button onClick={() => handleTypeChange('all')} className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${filterType === 'all' ? 'bg-slate-800 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>Tất cả</button>
                <button onClick={() => handleTypeChange('expense')} className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${filterType === 'expense' ? 'bg-rose-500 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>Chi phí</button>
                <button onClick={() => handleTypeChange('income')} className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${filterType === 'income' ? 'bg-emerald-500 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>Thu nhập</button>
            </div>

            {/* Nhóm Bộ lọc Ngày & Danh mục */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full xl:w-auto flex-1">
                {/* Lọc khoảng thời gian */}
                <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 w-full sm:w-auto shrink-0">
                   <Calendar size={18} className="text-indigo-600" />
                   <input
                      type="date"
                      value={startDate}
                      onChange={(e) => handleFilterChange(setStartDate, e.target.value)}
                      className="bg-transparent text-sm focus:outline-none text-slate-700 w-full sm:w-auto"
                   />
                   <span className="text-gray-400 font-medium">-</span>
                   <input
                      type="date"
                      value={endDate}
                      onChange={(e) => handleFilterChange(setEndDate, e.target.value)}
                      className="bg-transparent text-sm focus:outline-none text-slate-700 w-full sm:w-auto"
                   />
                </div>

                {/* Lọc theo Danh mục */}
                <div className="flex items-center gap-2 w-full sm:flex-1 min-w-[180px]">
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                        <Filter size={18} />
                    </div>
                    <select
                        value={filterCategory}
                        onChange={(e) => handleFilterChange(setFilterCategory, e.target.value)}
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
        </div>

        {/* TRANSACTION LIST */}
        <div className="space-y-3 relative min-h-[200px]">
            {isFetchingTx && (
                <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] z-10 flex items-center justify-center rounded-3xl">
                    <Loader2 className="animate-spin text-indigo-600" size={32} />
                </div>
            )}

            {transactions.length === 0 && !isFetchingTx ? (
              <div className="text-center py-16 text-gray-500 bg-white rounded-3xl border border-dashed border-gray-200">
                Không tìm thấy giao dịch nào phù hợp.
              </div>
            ) : (
              transactions.map(tx => {
                const catInfo = categoryMap[tx.category_id] || { name: 'Khác', icon: '❓', type: 'expense' };
                const isIncome = tx.transaction_type === 'income' || catInfo.type === 'income';
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

        {/* PAGINATION (ĐIỀU HƯỚNG TRANG) */}
        {totalPages > 1 && (
            <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-gray-100 shadow-sm mt-6">
                <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1 || isFetchingTx}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-slate-700 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                    <ChevronLeft size={18} /> Trước
                </button>
                <div className="text-sm font-semibold text-gray-500">
                    Trang <span className="text-indigo-600">{page}</span> / {totalPages}
                </div>
                <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages || isFetchingTx}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-slate-700 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                    Sau <ChevronRight size={18} />
                </button>
            </div>
        )}
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

      {/* MODAL NHẬP LIỆU HÀNG LOẠT */}
      <ImportModal 
          isOpen={isImportModalOpen} 
          onClose={() => setIsImportModalOpen(false)} 
          onSuccess={fetchTransactions}
          wallets={walletsList}
          categoriesList={categoriesList}
      />
    </div>
  );
}