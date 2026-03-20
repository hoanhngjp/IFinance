import React from 'react';
import { Calendar, MonitorPlay, Music, Plus, Zap } from 'lucide-react';

export default function Subscriptions() {
  const subs = [
    { id: 1, name: 'Netflix Premium', amount: 260000, cycle: 'monthly', nextDue: '2026-04-01', active: true, icon: MonitorPlay, color: 'text-rose-600 bg-rose-100' },
    { id: 2, name: 'Spotify Premium', amount: 59000, cycle: 'monthly', nextDue: '2026-03-25', active: true, icon: Music, color: 'text-emerald-600 bg-emerald-100' },
    { id: 3, name: 'ChatGPT Plus', amount: 500000, cycle: 'monthly', nextDue: '2026-04-10', active: true, icon: Zap, color: 'text-purple-600 bg-purple-100' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-20 lg:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="bg-white px-6 py-4 lg:px-0 lg:py-0 lg:mb-8 flex justify-between items-center border-b lg:border-none sticky top-0 z-10 lg:static">
          <h2 className="text-xl lg:text-3xl font-bold text-slate-800">Đăng ký định kỳ</h2>
          <button className="bg-indigo-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-semibold hover:bg-indigo-700"><Plus size={18}/><span className="hidden md:inline">Thêm gói</span></button>
        </div>

        <div className="px-6 lg:px-0">
          <p className="text-sm lg:text-base text-gray-500 mb-6 bg-blue-50 text-blue-700 p-4 rounded-xl border border-blue-100">
            Hệ thống sẽ tự động trừ tiền vào Ví tương ứng khi đến ngày thanh toán.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
            {subs.map(sub => (
              <div key={sub.id} className="bg-white p-5 lg:p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-5">
                  <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-2xl ${sub.color}`}><sub.icon size={24} /></div>
                    <div>
                      <h5 className="font-bold text-slate-800">{sub.name}</h5>
                      <p className="text-xs text-gray-500 mt-0.5">Hàng tháng</p>
                    </div>
                  </div>
                </div>
                <div className="mb-4">
                  <span className="text-2xl font-bold text-slate-800">{sub.amount.toLocaleString()} ₫</span>
                </div>

                <div className="flex items-center justify-between border-t border-gray-100 pt-4 mt-2">
                  <div className="flex items-center gap-1.5 text-sm text-orange-500 font-medium bg-orange-50 px-3 py-1.5 rounded-lg">
                    <Calendar size={16} /> {sub.nextDue}
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" defaultChecked={sub.active} />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}