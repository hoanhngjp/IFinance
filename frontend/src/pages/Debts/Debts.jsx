import React, { useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Plus, AlertCircle } from 'lucide-react';

const formatCurrency = (amount) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

export default function Debts() {
  const [activeTab, setActiveTab] = useState('borrowed');
  const mockDebts = [
    { id: 1, type: 'borrowed', name: 'Vay ngân hàng mua xe', amount: 50000000, paid: 15000000, dueDate: '2026-12-01', status: 'active' },
    { id: 2, type: 'borrowed', name: 'Mượn tiền đóng trọ', amount: 2000000, paid: 0, dueDate: '2026-04-10', status: 'warning' },
    { id: 3, type: 'lent', name: 'Cho Lan mượn', amount: 3000000, paid: 1000000, dueDate: '2026-05-01', status: 'active' },
  ];

  const currentDebts = mockDebts.filter(d => d.type === activeTab);

  return (
    <div className="min-h-screen bg-gray-50 pb-20 lg:p-8 animate-fade-in">
      <div className="max-w-6xl mx-auto">

        <div className="flex items-center justify-between mb-6 lg:mb-8 px-6 lg:px-0 mt-4 lg:mt-0">
          <h2 className="text-2xl lg:text-3xl font-bold text-slate-800">Quản lý Sổ Nợ</h2>
          <button className="bg-indigo-600 text-white px-4 py-2 rounded-xl hover:bg-indigo-700 transition-colors flex items-center gap-2 text-sm font-semibold">
            <Plus size={18} /> <span className="hidden md:inline">Thêm khoản nợ</span>
          </button>
        </div>

        <div className="px-6 lg:px-0 mb-6">
          <div className="flex bg-gray-200/80 p-1.5 rounded-xl max-w-md">
            <button onClick={() => setActiveTab('borrowed')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${activeTab === 'borrowed' ? 'bg-white shadow text-rose-600' : 'text-gray-500 hover:text-gray-700'}`}>
              <ArrowDownLeft size={18} /> Đi vay (Nợ)
            </button>
            <button onClick={() => setActiveTab('lent')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${activeTab === 'lent' ? 'bg-white shadow text-emerald-600' : 'text-gray-500 hover:text-gray-700'}`}>
              <ArrowUpRight size={18} /> Cho vay
            </button>
          </div>
        </div>

        <div className="px-6 lg:px-0 mb-8">
          <div className={`p-6 lg:p-8 rounded-3xl text-white shadow-lg ${activeTab === 'borrowed' ? 'bg-gradient-to-br from-rose-500 to-rose-600 shadow-rose-200' : 'bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-emerald-200'}`}>
            <p className="text-white/80 font-medium mb-2">Tổng tiền {activeTab === 'borrowed' ? 'bạn đang nợ' : 'người khác nợ bạn'}</p>
            <h3 className="text-4xl lg:text-5xl font-bold">{activeTab === 'borrowed' ? formatCurrency(52000000) : formatCurrency(3000000)}</h3>
          </div>
        </div>

        {/* Chia 2 cột trên PC */}
        <div className="px-6 lg:px-0">
          <h4 className="font-semibold text-gray-700 mb-4 text-lg">Chi tiết các khoản</h4>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
            {currentDebts.map(debt => {
              const progress = (debt.paid / debt.amount) * 100;
              return (
                <div key={debt.id} className="bg-white p-5 lg:p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h5 className="font-bold text-slate-800 lg:text-lg">{debt.name}</h5>
                      <p className="text-sm text-gray-500 mt-1 flex items-center gap-1.5">
                        {debt.status === 'warning' && <AlertCircle size={14} className="text-orange-500"/>}
                        Hạn trả: {debt.dueDate}
                      </p>
                    </div>
                    <span className="text-lg font-bold text-slate-800">{formatCurrency(debt.amount)}</span>
                  </div>

                  <div className="mt-5">
                    <div className="flex justify-between text-sm font-medium mb-2">
                      <span className="text-indigo-600">Đã trả: {formatCurrency(debt.paid)}</span>
                      <span className="text-gray-400">Còn lại: {formatCurrency(debt.amount - debt.paid)}</span>
                    </div>
                    <div className="w-full bg-gray-100 h-3 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${activeTab === 'borrowed' ? 'bg-indigo-500' : 'bg-emerald-500'}`} style={{ width: `${progress}%` }}></div>
                    </div>
                  </div>

                  <div className="mt-6 pt-5 border-t border-gray-50 flex gap-3">
                    <button className="flex-1 bg-gray-50 hover:bg-gray-100 text-slate-700 py-2.5 rounded-xl text-sm font-semibold transition-colors">Chi tiết</button>
                    <button className={`flex-1 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm ${activeTab === 'borrowed' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
                      {activeTab === 'borrowed' ? 'Thanh toán' : 'Ghi nhận thu'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

      </div>
    </div>
  );
}