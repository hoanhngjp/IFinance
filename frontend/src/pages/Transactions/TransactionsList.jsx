import React from 'react';
import { Filter, Download } from 'lucide-react';

const formatCurrency = (amount) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

export default function TransactionsList() {
  const transactions = [
    { id: 1, type: 'expense', amount: 50000, category: 'Ăn uống', wallet: 'Tiền mặt', date: '10/03/2026', icon: '🍜' },
    { id: 2, type: 'income', amount: 15000000, category: 'Lương', wallet: 'VCB', date: '05/03/2026', icon: '💰' },
    { id: 3, type: 'expense', amount: 300000, category: 'Giải trí', wallet: 'Thẻ Tín Dụng', date: '02/03/2026', icon: '🎬' },
  ];

  return (
    <div className="p-6 lg:p-8 bg-gray-50 min-h-screen pb-20">
      <div className="max-w-4xl mx-auto">

        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl lg:text-3xl font-bold text-slate-800">Lịch sử Giao dịch</h2>
          <div className="hidden md:flex gap-3">
            <button className="flex items-center gap-2 bg-white border border-gray-200 px-4 py-2 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50"><Filter size={16}/> Bộ lọc</button>
            <button className="flex items-center gap-2 bg-white border border-gray-200 px-4 py-2 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50"><Download size={16}/> Xuất Excel</button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-1.5 flex mb-6">
          <button className="flex-1 py-2 bg-indigo-50 text-indigo-600 font-semibold rounded-lg text-sm transition-colors">Tất cả</button>
          <button className="flex-1 py-2 text-gray-500 font-medium rounded-lg text-sm hover:text-gray-800 transition-colors">Thu</button>
          <button className="flex-1 py-2 text-gray-500 font-medium rounded-lg text-sm hover:text-gray-800 transition-colors">Chi</button>
        </div>

        <div className="space-y-3">
          {transactions.map(tx => {
            const isIncome = tx.type === 'income';
            return (
              <div key={tx.id} className="flex items-center justify-between p-4 lg:p-5 bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 lg:w-14 lg:h-14 rounded-full bg-gray-50 flex items-center justify-center text-xl lg:text-2xl border border-gray-100">{tx.icon}</div>
                  <div>
                    <p className="font-semibold text-slate-800 lg:text-lg">{tx.category}</p>
                    <p className="text-xs lg:text-sm text-gray-500 mt-0.5">{tx.wallet} • {tx.date}</p>
                  </div>
                </div>
                <div className={`font-semibold lg:text-lg ${isIncome ? 'text-emerald-500' : 'text-slate-800'}`}>
                  {isIncome ? '+' : '-'}{formatCurrency(tx.amount)}
                </div>
              </div>
            )
          })}
        </div>

      </div>
    </div>
  );
}