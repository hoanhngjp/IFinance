import React, { useState, useEffect } from 'react';
import { Filter, Download } from 'lucide-react';
import axiosClient from '../../api/axiosClient';

const formatCurrency = (amount) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

export default function TransactionsList() {
  const [transactions, setTransactions] = useState([]);
  const [walletMap, setWalletMap] = useState({});
  const [categoryMap, setCategoryMap] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  // State quản lý bộ lọc (all, income, expense)
  const [filterType, setFilterType] = useState('all');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [walletsRes, categoriesRes, txRes] = await Promise.all([
          axiosClient.get('/wallets'),
          axiosClient.get('/categories'),
          axiosClient.get('/transactions?limit=100')
        ]);

        const wMap = {};
        walletsRes.data.forEach(w => { wMap[w.wallet_id] = w.name; });
        setWalletMap(wMap);

        const cMap = {};
        const flattenCategories = (cats) => {
          cats.forEach(c => {
            cMap[c.category_id] = { name: c.name, icon: c.icon || '📌' };
            if (c.subcategories && c.subcategories.length > 0) flattenCategories(c.subcategories);
          });
        };
        flattenCategories(categoriesRes.data);
        setCategoryMap(cMap);

        setTransactions(txRes.data);
      } catch (error) {
        console.error("Lỗi tải Lịch sử giao dịch:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  // HÀM LỌC: Tính toán mảng giao dịch sau khi lọc
  const filteredTransactions = transactions.filter(tx => {
    if (filterType === 'all') return true;
    return tx.transaction_type === filterType;
  });

  // HÀM XUẤT FILE CSV
  const exportToCSV = () => {
    if (filteredTransactions.length === 0) {
      alert("Không có dữ liệu để xuất!");
      return;
    }

    // 1. Tạo Header cho file CSV
    const headers = ['Ngay', 'Loai', 'Danh muc', 'Vi tien', 'So tien', 'Ghi chu'];

    // 2. Chuyển đổi dữ liệu JSON thành chuỗi CSV
    const csvRows = filteredTransactions.map(tx => {
      const type = tx.transaction_type === 'income' ? 'Thu nhap' : 'Chi phi';
      const category = categoryMap[tx.category_id]?.name || 'Khac';
      const wallet = walletMap[tx.wallet_id] || 'Vi an';
      // Bọc Ghi chú trong dấu ngoặc kép để tránh lỗi nếu người dùng nhập dấu phẩy vào ghi chú
      const note = `"${tx.note || ''}"`;

      return [tx.date, type, category, wallet, tx.amount, note].join(',');
    });

    // 3. Ghép Header và Body, thêm BOM (\ufeff) để Excel không bị lỗi font Tiếng Việt
    const csvContent = "\ufeff" + [headers.join(','), ...csvRows].join('\n');

    // 4. Ép trình duyệt tải file xuống
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Lich_su_giao_dich_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();

    // Dọn dẹp URL rác
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 lg:p-8 bg-gray-50 min-h-screen pb-20 animate-fade-in">
      <div className="max-w-4xl mx-auto">

        {/* Header & Nút Xuất File */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl lg:text-3xl font-bold text-slate-800">Lịch sử Giao dịch</h2>
          <div className="flex gap-3">
            <button onClick={exportToCSV} className="flex items-center gap-2 bg-white border border-gray-200 px-4 py-2 rounded-xl text-sm font-medium hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm">
              <Download size={16} /> <span className="hidden sm:inline">Xuất file CSV</span>
            </button>
          </div>
        </div>

        {/* Tab Lọc (Tất cả / Thu / Chi) */}
        <div className="flex bg-gray-200/60 p-1.5 rounded-xl mb-6 max-w-sm">
          <button onClick={() => setFilterType('all')} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${filterType === 'all' ? 'bg-white shadow-sm text-slate-800' : 'text-gray-500 hover:text-slate-700'}`}>Tất cả</button>
          <button onClick={() => setFilterType('income')} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${filterType === 'income' ? 'bg-white shadow-sm text-emerald-600' : 'text-gray-500 hover:text-slate-700'}`}>Thu nhập</button>
          <button onClick={() => setFilterType('expense')} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${filterType === 'expense' ? 'bg-white shadow-sm text-rose-600' : 'text-gray-500 hover:text-slate-700'}`}>Chi phí</button>
        </div>

        {isLoading ? (
          <div className="text-center py-10 text-gray-500">Đang tải dữ liệu...</div>
        ) : (
          <div className="space-y-3">
            {filteredTransactions.length === 0 ? (
               <div className="text-center py-10 bg-white rounded-2xl border border-gray-100 text-gray-500">Không tìm thấy giao dịch nào phù hợp.</div>
            ) : (
              filteredTransactions.map(tx => {
                const isIncome = tx.transaction_type === 'income';
                const catInfo = categoryMap[tx.category_id] || { name: 'Khác', icon: '❓' };
                const walletName = walletMap[tx.wallet_id] || 'Ví ẩn';

                return (
                  <div key={tx.transaction_id} className="flex items-center justify-between p-4 lg:p-5 bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 lg:w-14 lg:h-14 rounded-full bg-gray-50 flex items-center justify-center text-xl lg:text-2xl border border-gray-100">{catInfo.icon}</div>
                      <div>
                        <p className="font-semibold text-slate-800 lg:text-lg">{catInfo.name}</p>
                        <p className="text-xs lg:text-sm text-gray-500 mt-0.5">{walletName} • {tx.date}</p>
                      </div>
                    </div>
                    <div className={`font-semibold lg:text-lg ${isIncome ? 'text-emerald-600' : 'text-slate-800'}`}>
                      {isIncome ? '+' : '-'}{formatCurrency(tx.amount)}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}