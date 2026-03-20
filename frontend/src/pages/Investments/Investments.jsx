import React from 'react';
import { TrendingUp, Coins, Activity, Plus } from 'lucide-react';

export default function Investments() {
  const investments = [
    { id: 1, name: 'Vàng SJC', type: 'gold', principal: 50000000, currentValue: 55000000, roi: 10.0 },
    { id: 2, name: 'Cổ phiếu FPT', type: 'stock', principal: 15000000, currentValue: 14200000, roi: -5.3 },
    { id: 3, name: 'Chứng chỉ quỹ VNDAF', type: 'fund', principal: 10000000, currentValue: 11500000, roi: 15.0 },
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-20 lg:p-8">
      <div className="max-w-5xl mx-auto">

        <div className="bg-white px-6 py-4 lg:px-0 lg:py-0 lg:mb-6 flex justify-between items-center border-b lg:border-none sticky top-0 z-10 lg:static">
          <h2 className="text-xl lg:text-3xl font-bold text-slate-800">Danh mục Đầu tư</h2>
          <button className="bg-indigo-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-semibold hover:bg-indigo-700 transition-colors"><Plus size={18}/> <span className="hidden md:inline">Mua thêm</span></button>
        </div>

        <div className="p-6 lg:p-0">
          <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 rounded-3xl p-6 lg:p-8 text-white mb-8 shadow-lg shadow-indigo-200">
            <p className="text-indigo-200 text-sm lg:text-base font-medium mb-2">Tổng giá trị tài sản đầu tư</p>
            <h3 className="text-4xl lg:text-5xl font-bold">80.700.000 ₫</h3>
            <div className="flex items-center gap-2 mt-4 text-sm bg-white/20 w-fit px-4 py-1.5 rounded-full font-medium">
              <TrendingUp size={16} className="text-emerald-300" />
              <span>Lợi nhuận: +5.700.000 ₫</span>
            </div>
          </div>

          <h4 className="font-semibold text-gray-700 mb-4 text-lg">Chi tiết danh mục</h4>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
            {investments.map(inv => {
              const isProfitable = inv.roi >= 0;
              return (
                <div key={inv.id} className="bg-white p-5 lg:p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 lg:p-4 rounded-full ${inv.type === 'gold' ? 'bg-yellow-100 text-yellow-600' : 'bg-blue-100 text-blue-600'}`}>
                      {inv.type === 'gold' ? <Coins size={24} /> : <Activity size={24} />}
                    </div>
                    <div>
                      <h5 className="font-bold text-slate-800 lg:text-lg">{inv.name}</h5>
                      <p className="text-xs lg:text-sm text-gray-500 mt-1">Vốn: {inv.principal.toLocaleString()} ₫</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-slate-800 lg:text-lg">{inv.currentValue.toLocaleString()} ₫</p>
                    <p className={`text-sm lg:text-base font-semibold mt-0.5 ${isProfitable ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {isProfitable ? '+' : ''}{inv.roi}%
                    </p>
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