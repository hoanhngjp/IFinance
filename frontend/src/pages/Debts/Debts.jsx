import React, { useState, useEffect } from 'react';
import { ArrowDownLeft, ArrowUpRight, Plus, AlertCircle } from 'lucide-react';
import axiosClient from '../../api/axiosClient';

const formatCurrency = (amount) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

export default function Debts() {
  // Đồng bộ với Enum của Backend: 'payable' (Đi vay) và 'receivable' (Cho vay)
  const [activeTab, setActiveTab] = useState('payable');
  const [debts, setDebts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDebts = async () => {
      try {
        const response = await axiosClient.get('/debts');
        // Backend trả về { status: 'success', data: [...] }
        setDebts(response.data);
      } catch (error) {
        console.error("Lỗi tải danh sách nợ:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchDebts();
  }, []);

  const currentDebts = debts.filter(d => d.type === activeTab);

  return (
    <div className="min-h-screen bg-gray-50 pb-20 lg:p-8 animate-fade-in">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="bg-white px-6 py-4 lg:px-0 lg:py-0 lg:mb-8 flex justify-between items-center border-b lg:border-none sticky top-0 z-10 lg:static">
          <h2 className="text-xl lg:text-3xl font-bold text-slate-800">Sổ Nợ</h2>
          <button className="bg-indigo-600 hover:bg-indigo-700 transition-colors text-white px-4 py-2 rounded-xl flex items-center gap-2 font-medium shadow-sm">
            <Plus size={20} /> <span className="hidden sm:inline">Thêm khoản nợ</span>
          </button>
        </div>

        {/* Tổng quan Nợ */}
        <div className="grid grid-cols-2 gap-4 px-6 lg:px-0 mb-6 mt-6 lg:mt-0">
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden group cursor-pointer">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-125 transition-transform"><ArrowDownLeft size={64} /></div>
            <p className="text-gray-500 font-medium mb-1 relative z-10">Tổng đi vay</p>
            <p className="text-2xl font-bold text-slate-800 relative z-10">
              {formatCurrency(debts.filter(d => d.type === 'payable').reduce((sum, d) => sum + Number(d.remaining_amount), 0))}
            </p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden group cursor-pointer">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-125 transition-transform"><ArrowUpRight size={64} /></div>
            <p className="text-gray-500 font-medium mb-1 relative z-10">Tổng cho vay</p>
            <p className="text-2xl font-bold text-slate-800 relative z-10">
              {formatCurrency(debts.filter(d => d.type === 'receivable').reduce((sum, d) => sum + Number(d.remaining_amount), 0))}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6 lg:px-0 mb-6">
          <div className="flex bg-gray-200/60 p-1.5 rounded-xl">
            <button onClick={() => setActiveTab('payable')} className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${activeTab === 'payable' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-slate-700'}`}>Tôi đi vay</button>
            <button onClick={() => setActiveTab('receivable')} className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${activeTab === 'receivable' ? 'bg-white shadow-sm text-emerald-600' : 'text-gray-500 hover:text-slate-700'}`}>Tôi cho vay</button>
          </div>
        </div>

        {/* Danh sách */}
        <div className="px-6 lg:px-0">
          {isLoading ? (
            <div className="text-center py-10 text-gray-500">Đang tải dữ liệu...</div>
          ) : currentDebts.length === 0 ? (
            <div className="text-center py-10 bg-white rounded-2xl border border-gray-100 text-gray-500">Không có khoản nợ nào.</div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
              {currentDebts.map(debt => {
                const total = Number(debt.total_amount);
                const remaining = Number(debt.remaining_amount);
                const paid = total - remaining;
                const progress = (paid / total) * 100;

                // Cảnh báo nếu đã quá hạn
                const isOverdue = debt.due_date && new Date(debt.due_date) < new Date() && remaining > 0;

                return (
                  <div key={debt.debt_id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h4 className="font-bold text-slate-800 lg:text-lg">{debt.creditor_name}</h4>
                        <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
                          Hạn trả: {debt.due_date || 'Không có hạn'}
                          {isOverdue && <AlertCircle size={14} className="text-rose-500" />}
                        </p>
                      </div>
                      <span className="text-lg font-bold text-slate-800">{formatCurrency(total)}</span>
                    </div>

                    <div className="mt-5">
                      <div className="flex justify-between text-sm font-medium mb-2">
                        <span className="text-indigo-600">Đã trả: {formatCurrency(paid)}</span>
                        <span className="text-gray-400">Còn lại: {formatCurrency(remaining)}</span>
                      </div>
                      <div className="w-full bg-gray-100 h-3 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-500 ${activeTab === 'payable' ? 'bg-indigo-500' : 'bg-emerald-500'}`} style={{ width: `${progress}%` }}></div>
                      </div>
                    </div>

                    <div className="mt-6 pt-5 border-t border-gray-50 flex gap-3">
                      <button className="flex-1 bg-gray-50 hover:bg-gray-100 text-slate-700 py-2.5 rounded-xl text-sm font-semibold transition-colors">Chi tiết</button>
                      <button disabled={remaining === 0} className={`flex-1 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${activeTab === 'payable' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
                        {remaining === 0 ? 'Đã xong' : (activeTab === 'payable' ? 'Thanh toán' : 'Ghi nhận thu')}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}