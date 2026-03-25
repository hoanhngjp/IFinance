import React, { useState, useEffect } from 'react';
import { User, ArrowDownRight, ArrowUpRight, Wallet, Landmark, CreditCard, Activity } from 'lucide-react';
import { Link } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';

const formatCurrency = (amount) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

// Hàm chọn icon Ví dựa trên type
const getWalletIcon = (type) => {
  if (type === 'cash') return Wallet;
  if (type === 'bank') return Landmark;
  if (type === 'credit') return CreditCard;
  return Activity;
};

export default function Dashboard() {
  const [wallets, setWallets] = useState([]);
  const [recentTxs, setRecentTxs] = useState([]);
  const [walletMap, setWalletMap] = useState({});
  const [categoryMap, setCategoryMap] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // Dùng Promise.all để gọi song song 3 API, tăng tốc độ load web
        const [walletsRes, categoriesRes, txRes] = await Promise.all([
          axiosClient.get('/wallets/'),
          axiosClient.get('/categories/'),
          axiosClient.get('/transactions/?limit=5') // Chỉ lấy 5 giao dịch gần nhất
        ]);

        setWallets(walletsRes.data);

        // 1. Tạo Map để tra cứu Tên Ví nhanh
        const wMap = {};
        walletsRes.data.forEach(w => { wMap[w.wallet_id] = w.name; });
        setWalletMap(wMap);

        // 2. Tạo Map để tra cứu Tên & Icon Danh mục (Dùng đệ quy vì danh mục có cha-con)
        const cMap = {};
        const flattenCategories = (cats) => {
          cats.forEach(c => {
            cMap[c.category_id] = { name: c.name, icon: c.icon || '📌' };
            if (c.subcategories && c.subcategories.length > 0) {
              flattenCategories(c.subcategories);
            }
          });
        };
        flattenCategories(categoriesRes.data);
        setCategoryMap(cMap);

        // 3. Đổ dữ liệu Giao dịch
        setRecentTxs(txRes.data);

      } catch (error) {
        console.error("Lỗi tải Dashboard:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (isLoading) {
    return <div className="min-h-screen flex justify-center items-center bg-gray-50">Đang tải dữ liệu...</div>;
  }

  // Tính tổng tài sản
  const totalBalance = wallets.reduce((sum, wallet) => sum + Number(wallet.balance), 0);

  return (
    <div className="p-6 lg:p-8 bg-gray-50 min-h-screen animate-fade-in pb-20 lg:pb-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6 lg:mb-8">
          <div>
            <p className="text-gray-500 text-sm font-medium lg:text-base mb-1">Tổng tài sản</p>
            <h2 className="text-3xl lg:text-4xl font-bold text-slate-800 tracking-tight">{formatCurrency(totalBalance)}</h2>
          </div>
          <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm border border-gray-100 text-indigo-600 lg:hidden">
            <User size={24} />
          </div>
        </div>

        {/* Cụm chức năng nhanh */}
        <div className="grid grid-cols-2 gap-3 lg:gap-4 mb-8">
          <div className="bg-emerald-500 p-4 lg:p-5 rounded-2xl text-white shadow-sm shadow-emerald-200 hover:bg-emerald-600 transition-colors cursor-pointer">
            <div className="bg-white/20 w-10 h-10 lg:w-12 lg:h-12 rounded-full flex items-center justify-center mb-3">
              <ArrowDownRight size={24} />
            </div>
            <p className="font-semibold lg:text-lg mb-1">Thu nhập</p>
            <p className="text-emerald-100 text-sm font-medium">Thêm khoản thu</p>
          </div>
          <div className="bg-rose-500 p-4 lg:p-5 rounded-2xl text-white shadow-sm shadow-rose-200 hover:bg-rose-600 transition-colors cursor-pointer">
            <div className="bg-white/20 w-10 h-10 lg:w-12 lg:h-12 rounded-full flex items-center justify-center mb-3">
              <ArrowUpRight size={24} />
            </div>
            <p className="font-semibold lg:text-lg mb-1">Chi tiêu</p>
            <p className="text-rose-100 text-sm font-medium">Thêm khoản chi</p>
          </div>
        </div>

        {/* Nội dung chính */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          {/* Lịch sử giao dịch */}
          <div className="lg:col-span-2">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-lg lg:text-xl text-slate-800">Giao dịch gần đây</h3>
              <Link to="/transactions" className="text-indigo-600 text-sm font-medium hover:underline">Xem tất cả</Link>
            </div>
            <div className="space-y-3">
              {recentTxs.length === 0 ? (
                <div className="text-center p-6 bg-white rounded-2xl border border-gray-100 text-gray-500">Chưa có giao dịch nào</div>
              ) : (
                recentTxs.map(tx => {
                  const isIncome = tx.transaction_type === 'income';
                  const catInfo = categoryMap[tx.category_id] || { name: 'Khác', icon: '❓' };
                  const walletName = walletMap[tx.wallet_id] || 'Ví ẩn';

                  return (
                    <div key={tx.transaction_id} className="flex items-center justify-between p-4 lg:p-5 bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 lg:w-14 lg:h-14 rounded-full bg-gray-50 flex items-center justify-center text-xl lg:text-2xl border border-gray-100">
                          {catInfo.icon}
                        </div>
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
          </div>

          {/* Danh sách Ví */}
          <div className="lg:col-span-1">
            <div className="flex justify-between items-center mb-4 mt-6 lg:mt-0">
              <h3 className="font-semibold text-lg lg:text-xl text-slate-800">Ví của tôi</h3>
              <button className="text-indigo-600 text-sm font-medium hover:underline">Quản lý</button>
            </div>
            <div className="space-y-3">
              {wallets.map(wallet => {
                const IconComponent = getWalletIcon(wallet.type);
                return (
                  <div key={wallet.wallet_id} className="p-4 lg:p-5 bg-white border border-gray-100 rounded-2xl shadow-sm hover:border-indigo-100 transition-colors">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
                        <IconComponent size={20} />
                      </div>
                      <span className="font-semibold text-slate-700">{wallet.name}</span>
                    </div>
                    <p className="text-lg lg:text-xl font-bold text-slate-800">{formatCurrency(wallet.balance)}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}