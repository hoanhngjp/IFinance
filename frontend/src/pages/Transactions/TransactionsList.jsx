import React, { useState, useEffect } from 'react';
import { Filter, Download, Trash2, Loader2 } from 'lucide-react';
import axiosClient from '../../api/axiosClient';

const formatCurrency = (amount) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

export default function TransactionsList() {
  const [transactions, setTransactions] = useState([]);
  const [walletMap, setWalletMap] = useState({});
  const [categoryMap, setCategoryMap] = useState({});
  const [categoriesList, setCategoriesList] = useState([]); // Chứa danh sách mảng category để render Dropdown
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);

  // State quản lý bộ lọc
  const [filterType, setFilterType] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all'); // State mới cho bộ lọc danh mục

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [walletsRes, categoriesRes, txRes] = await Promise.all([
          axiosClient.get('/wallets'),
          axiosClient.get('/categories'),
          axiosClient.get('/transactions?limit=100')
        ]);

        const walletsData = walletsRes.data || walletsRes;
        const categoriesData = categoriesRes.data || categoriesRes;
        const txData = txRes.data || txRes;

        const wMap = {};
        walletsData.forEach(w => { wMap[w.wallet_id] = w.name; });
        setWalletMap(wMap);

        const cMap = {};
        const cList = []; // Mảng dùng cho dropdown
        const flattenCategories = (cats) => {
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
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  // Hàm chuyển tab Thu/Chi -> Tự động reset bộ lọc danh mục về "Tất cả"
  const handleTypeChange = (type) => {
      setFilterType(type);
      setFilterCategory('all');
  };

  // LOGIC LỌC GIAO DỊCH (Kết hợp giữa Type và Category)
  const filteredTransactions = transactions.filter(tx => {
    const matchType = filterType === 'all' || tx.transaction_type === filterType;
    const matchCategory = filterCategory === 'all' || tx.category_id.toString() === filterCategory;
    return matchType && matchCategory;
  });

  const handleDelete = async (e, transactionId) => {
    e.stopPropagation();
    const isConfirm = window.confirm("Bạn có chắc chắn muốn xóa giao dịch này? Số tiền sẽ được hoàn lại vào ví.");
    if (!isConfirm) return;

    setDeletingId(transactionId);
    try {
      await axiosClient.delete(`/transactions/${transactionId}`);
      setTransactions(prev => prev.filter(tx => tx.transaction_id !== transactionId));
    } catch (error) {
      alert("Lỗi khi xóa giao dịch: " + (error.response?.data?.detail || "Vui lòng thử lại"));
      console.error(error);
    } finally {
      setDeletingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64 text-indigo-600">
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen pb-20 lg:p-8 animate-fade-in">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header & Filter */}
        <div className="bg-white p-4 lg:p-6 rounded-2xl lg:rounded-3xl border border-gray-100 shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Lịch sử giao dịch</h2>
            <p className="text-sm text-gray-500 mt-1">Quản lý các khoản thu chi của bạn</p>
          </div>

          <div className="flex flex-col sm:flex-row flex-wrap gap-3 w-full lg:w-auto items-start sm:items-center">

            {/* Lọc theo Loại (Thu/Chi) - Có ẩn thanh cuộn nếu xem trên màn hình siêu nhỏ */}
            <div className="flex gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
                <button onClick={() => handleTypeChange('all')} className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${filterType === 'all' ? 'bg-slate-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>Tất cả</button>
                <button onClick={() => handleTypeChange('expense')} className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${filterType === 'expense' ? 'bg-rose-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>Chi phí</button>
                <button onClick={() => handleTypeChange('income')} className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${filterType === 'income' ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>Thu nhập</button>
            </div>

            {/* Lọc theo Danh mục */}
            <div className="flex items-center gap-2 w-full sm:w-auto min-w-[180px] max-w-xs">
                <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                    <Filter size={16} />
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
              <div className="text-center py-10 text-gray-500 bg-white rounded-2xl border border-gray-100">Không tìm thấy giao dịch nào phù hợp.</div>
            ) : (
              filteredTransactions.map(tx => {
                const isIncome = tx.transaction_type === 'income';
                const catInfo = categoryMap[tx.category_id] || { name: 'Khác', icon: '❓' };
                const walletName = walletMap[tx.wallet_id] || 'Ví ẩn';
                const isDeletingThis = deletingId === tx.transaction_id;

                return (
                  <div key={tx.transaction_id} className={`flex items-center justify-between p-4 lg:p-5 bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer ${isDeletingThis ? 'opacity-50 pointer-events-none' : ''}`}>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 lg:w-14 lg:h-14 rounded-full bg-gray-50 flex items-center justify-center text-xl lg:text-2xl border border-gray-100">{catInfo.icon}</div>
                      <div>
                        <p className="font-semibold text-slate-800 lg:text-lg">{catInfo.name}</p>
                        <p className="text-xs lg:text-sm text-gray-500 mt-0.5">{walletName} • {tx.date}</p>
                        {tx.note && <p className="text-xs text-gray-400 mt-1 italic">"{tx.note}"</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className={`font-semibold text-right lg:text-lg ${isIncome ? 'text-emerald-600' : 'text-slate-800'}`}>
                        {isIncome ? '+' : '-'}{formatCurrency(tx.amount)}
                        </div>
                        <button
                            onClick={(e) => handleDelete(e, tx.transaction_id)}
                            disabled={isDeletingThis}
                            className="p-2 text-gray-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors flex-shrink-0"
                            title="Xóa giao dịch"
                        >
                            {isDeletingThis ? <Loader2 size={20} className="animate-spin text-rose-500" /> : <Trash2 size={20} />}
                        </button>
                    </div>
                  </div>
                );
              })
            )}
        </div>
      </div>
    </div>
  );
}