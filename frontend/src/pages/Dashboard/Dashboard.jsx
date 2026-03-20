import React from 'react';
import { User, ArrowDownRight, ArrowUpRight, Wallet, Landmark, CreditCard } from 'lucide-react';
import { Link } from 'react-router-dom';

const formatCurrency = (amount) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

export default function Dashboard() {
  const wallets = [
    { id: 1, name: 'Tiền mặt', type: 'cash', balance: 2500000, icon: Wallet },
    { id: 2, name: 'Vietcombank', type: 'bank', balance: 18500000, icon: Landmark },
    { id: 3, name: 'Thẻ Tín Dụng', type: 'credit', balance: -5000000, icon: CreditCard },
  ];

  const recentTxs = [
    { id: 1, type: 'expense', amount: 50000, category: 'Ăn uống', wallet: 'Tiền mặt', date: 'Hôm nay', icon: '🍜' },
    { id: 2, type: 'expense', amount: 120000, category: 'Di chuyển', wallet: 'Momo', date: 'Hôm qua', icon: '⛽' },
    { id: 3, type: 'income', amount: 15000000, category: 'Lương', wallet: 'VCB', date: '05/03/2026', icon: '💰' },
  ];

  return (
    // Max-w-7xl giúp nội dung không bị bè ra quá mức trên màn hình Ultrawide
    <div className="animate-fade-in mx-auto max-w-7xl">

      {/* Khu vực Tổng quan (Hero Section) */}
      <div className="bg-indigo-600 lg:rounded-3xl lg:m-6 rounded-b-3xl p-6 lg:p-8 text-white shadow-md">
        <div className="flex justify-between items-center mb-6">
          <div>
            <p className="text-indigo-200 text-sm lg:text-base">Chào buổi sáng,</p>
            <h1 className="text-xl lg:text-2xl font-semibold">Minh Hiếu</h1>
          </div>
          <Link to="/profile" className="lg:hidden w-10 h-10 bg-indigo-500 rounded-full border-2 border-indigo-300 flex items-center justify-center">
            <User size={20} className="text-white" />
          </Link>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="text-center lg:text-left">
            <p className="text-indigo-200 text-sm mb-1">Tổng số dư khả dụng</p>
            <h2 className="text-4xl lg:text-5xl font-bold tracking-tight">{formatCurrency(21000000)}</h2>
          </div>

          <div className="bg-white/10 rounded-2xl p-4 lg:p-6 flex justify-between lg:gap-8 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className="bg-emerald-500/20 p-2 lg:p-3 rounded-full"><ArrowDownRight size={20} className="text-emerald-400" /></div>
              <div>
                <p className="text-xs lg:text-sm text-indigo-200">Thu (Tháng này)</p>
                <p className="font-semibold lg:text-xl text-white">{formatCurrency(15000000)}</p>
              </div>
            </div>
            <div className="w-px bg-indigo-400/30"></div>
            <div className="flex items-center gap-3">
               <div>
                <p className="text-xs lg:text-sm text-indigo-200 text-right">Chi (Tháng này)</p>
                <p className="font-semibold lg:text-xl text-white">{formatCurrency(4500000)}</p>
              </div>
              <div className="bg-rose-500/20 p-2 lg:p-3 rounded-full"><ArrowUpRight size={20} className="text-rose-400" /></div>
            </div>
          </div>
        </div>
      </div>

      {/* Grid chia 2 cột trên PC (Cột Ví chiếm 1/3, Cột Giao dịch chiếm 2/3) */}
      <div className="p-6 lg:px-6 lg:py-0 grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Ví của tôi */}
        <div className="lg:col-span-1">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-lg">Ví của tôi</h3>
            <button className="text-indigo-600 text-sm font-medium hover:underline">Quản lý</button>
          </div>
          {/* Trên Mobile: Cuộn ngang. Trên PC: Danh sách dọc (grid 1 cột) hoặc grid 2 cột */}
          <div className="flex lg:flex-col gap-4 overflow-x-auto lg:overflow-visible pb-2 hide-scrollbar">
            {wallets.map(wallet => (
              <div key={wallet.id} className="min-w-[140px] lg:w-full bg-white border border-gray-100 p-4 lg:p-5 rounded-2xl shadow-sm flex lg:items-center gap-4 flex-col lg:flex-row transition-hover hover:shadow-md">
                <div className={`w-fit p-3 rounded-xl ${wallet.type === 'credit' ? 'bg-orange-100 text-orange-600' : 'bg-indigo-100 text-indigo-600'}`}>
                  <wallet.icon size={20} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">{wallet.name}</p>
                  <p className={`font-semibold text-lg lg:mt-0.5 ${wallet.balance < 0 ? 'text-rose-600' : 'text-slate-800'}`}>
                    {formatCurrency(wallet.balance)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Giao dịch gần đây */}
        <div className="lg:col-span-2">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-lg">Giao dịch gần đây</h3>
            <Link to="/transactions" className="text-indigo-600 text-sm font-medium hover:underline">Xem tất cả</Link>
          </div>
          <div className="space-y-3">
            {recentTxs.map(tx => (
              <div key={tx.id} className="flex items-center justify-between p-4 lg:p-5 bg-white border border-gray-100 rounded-2xl shadow-sm hover:bg-gray-50 transition-colors cursor-pointer">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 lg:w-14 lg:h-14 rounded-full bg-gray-50 flex items-center justify-center text-xl lg:text-2xl border border-gray-100">
                    {tx.icon}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800 lg:text-lg">{tx.category}</p>
                    <p className="text-xs lg:text-sm text-gray-500 mt-0.5">{tx.wallet} • {tx.date}</p>
                  </div>
                </div>
                <div className={`font-semibold lg:text-lg ${tx.type === 'income' ? 'text-emerald-500' : 'text-slate-800'}`}>
                  {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}