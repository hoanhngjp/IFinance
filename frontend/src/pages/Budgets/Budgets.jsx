import React, { useState, useEffect } from 'react';
import { Target, AlertTriangle, Plus } from 'lucide-react';
import axiosClient from '../../api/axiosClient';

const formatCurrency = (amount) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

export default function Budgets() {
  const [budgets, setBudgets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchBudgets = async () => {
      try {
        // Gọi API lấy tiến độ ngân sách tháng này
        const response = await axiosClient.get('/budgets/progress?period=monthly');
        setBudgets(response.data);
      } catch (error) {
        console.error("Lỗi tải ngân sách:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchBudgets();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 pb-20 lg:p-8 animate-fade-in">
      <div className="max-w-4xl mx-auto">
        
        <div className="bg-white px-6 py-4 lg:px-0 lg:py-0 lg:mb-8 flex justify-between items-center border-b lg:border-none sticky top-0 z-10 lg:static">
          <h2 className="text-xl lg:text-3xl font-bold text-slate-800">Ngân sách Tháng</h2>
          <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 font-medium shadow-sm transition-colors">
            <Plus size={20} /> <span className="hidden sm:inline">Tạo ngân sách</span>
          </button>
        </div>

        <div className="px-6 lg:px-0 mt-6 lg:mt-0">
          {isLoading ? (
            <div className="text-center py-10 text-gray-500">Đang tải dữ liệu...</div>
          ) : budgets.length === 0 ? (
            <div className="text-center py-10 bg-white rounded-2xl border border-gray-100 text-gray-500">
              <Target size={48} className="mx-auto text-gray-300 mb-3" />
              Bạn chưa thiết lập ngân sách nào cho tháng này.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {budgets.map(budget => {
                const limit = Number(budget.amount_limit);
                const spent = Number(budget.spent);
                const remaining = Number(budget.remaining);
                const progress = Math.min((spent / limit) * 100, 100);
                
                // Nếu backend trả cờ warning = true -> Đổi màu đỏ
                const barColor = budget.warning ? 'bg-rose-500' : 'bg-indigo-500';

                return (
                  <div key={budget.budget_id} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-center mb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-gray-50 rounded-xl text-xl">📌</div>
                        <div>
                          <h3 className="font-bold text-slate-800">{budget.category_name}</h3>
                          <p className="text-sm text-gray-500 mt-0.5">Giới hạn: {formatCurrency(limit)}</p>
                        </div>
                      </div>
                      {budget.warning && <AlertTriangle className="text-rose-500 animate-pulse" size={24} />}
                    </div>

                    <div className="mt-6">
                      <div className="flex justify-between text-sm font-medium mb-2">
                        <span className={budget.warning ? 'text-rose-600' : 'text-slate-700'}>
                          Đã tiêu: {formatCurrency(spent)}
                        </span>
                        <span className="text-gray-400">
                          Còn lại: {remaining > 0 ? formatCurrency(remaining) : '0 ₫'}
                        </span>
                      </div>
                      <div className="w-full bg-gray-100 h-3.5 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-1000 ${barColor}`} style={{ width: `${progress}%` }}></div>
                      </div>
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