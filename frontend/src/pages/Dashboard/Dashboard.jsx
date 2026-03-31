import React, { useState, useEffect, useMemo } from 'react';
import { User, Wallet, Landmark, CreditCard, Activity, TrendingUp, TrendingDown, Loader2, Calendar, MousePointerClick } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PieChart, Pie, Cell, Tooltip as PieTooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as BarTooltip, ResponsiveContainer } from 'recharts';
import axiosClient from '../../api/axiosClient';

const formatCurrency = (amount) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
const COLORS = ['#6366f1', '#10b981', '#f43f5e', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899'];

const getWalletIcon = (type) => {
  if (type === 'cash') return Wallet;
  if (type === 'bank') return Landmark;
  if (type === 'credit') return CreditCard;
  return Activity;
};

export default function Dashboard() {
  const [isLoading, setIsLoading] = useState(true);

  // States chứa dữ liệu thô (Raw Data) từ API
  const [rawWallets, setRawWallets] = useState([]);
  const [rawTxs, setRawTxs] = useState([]);
  const [categoryMap, setCategoryMap] = useState({});

  // States Tương tác (Filters)
  const [timeRange, setTimeRange] = useState('3_months'); // Đổi mặc định sang 3 tháng để luôn thấy dữ liệu
  const [activeCard, setActiveCard] = useState('expense');

  // State cho Tùy chỉnh thời gian
  const [customStartDate, setCustomStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [customEndDate, setCustomEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  // 1. GỌI API 1 LẦN DUY NHẤT
  useEffect(() => {
    const fetchRawData = async () => {
      try {
        const [walletsRes, categoriesRes, txRes] = await Promise.all([
          axiosClient.get('/wallets/'),
          axiosClient.get('/categories/'),
          axiosClient.get('/transactions/?page=1&size=2000')
        ]);

        const walletsData = walletsRes.data || walletsRes || [];
        setRawWallets(Array.isArray(walletsData) ? walletsData : []);

        let txData = [];
        if (txRes?.data?.items) txData = txRes.data.items;
        else if (txRes?.items) txData = txRes.items;
        else if (Array.isArray(txRes?.data)) txData = txRes.data;
        else if (Array.isArray(txRes)) txData = txRes;

        setRawTxs(txData);

        const categoriesData = categoriesRes.data || categoriesRes || [];
        const cMap = {};
        const flattenCategories = (cats) => {
          if (!Array.isArray(cats)) return;
          cats.forEach(c => {
            cMap[c.category_id] = { name: c.name, icon: c.icon || '📌' };
            if (c.subcategories && Array.isArray(c.subcategories)) flattenCategories(c.subcategories);
          });
        };
        flattenCategories(categoriesData);
        setCategoryMap(cMap);

      } catch (error) {
        console.error("Lỗi tải dữ liệu Dashboard:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchRawData();
  }, []);

  // 2. XỬ LÝ DỮ LIỆU ĐỘNG (FIX LỖI MÚI GIỜ)
  const dashboardData = useMemo(() => {
    if (!rawTxs && !rawWallets) return null;

    const now = new Date();
    // Khóa cứng endDate ở 23:59:59 của ngày hiện tại
    let endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    // Khóa cứng startDate ở 00:00:00 của ngày hiện tại
    let startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);

    // Xử lý bộ lọc thời gian an toàn
    if (timeRange === '7_days') {
        startDate.setDate(endDate.getDate() - 7);
    } else if (timeRange === 'this_month') {
        startDate.setDate(1);
    } else if (timeRange === 'last_month') {
        startDate = new Date(endDate.getFullYear(), endDate.getMonth() - 1, 1, 0, 0, 0);
        endDate = new Date(endDate.getFullYear(), endDate.getMonth(), 0, 23, 59, 59, 999);
    } else if (timeRange === '3_months') {
        startDate.setMonth(endDate.getMonth() - 3);
    } else if (timeRange === 'custom') {
        const [sy, sm, sd] = customStartDate.split('-');
        startDate = new Date(sy, sm - 1, sd, 0, 0, 0);
        const [ey, em, ed] = customEndDate.split('-');
        endDate = new Date(ey, em - 1, ed, 23, 59, 59, 999);
    }

    // Lọc giao dịch chuẩn xác không lệch múi giờ
    const filteredTxs = rawTxs.filter(tx => {
        if (timeRange === 'all_time') return true;

        // Cắt chuỗi YYYY-MM-DD để tạo ngày giờ chuẩn local
        const [y, m, d] = tx.date.split('-');
        const txDate = new Date(y, m - 1, d, 0, 0, 0);

        return txDate.getTime() >= startDate.getTime() && txDate.getTime() <= endDate.getTime();
    });

    // Tính Tổng quan
    let totalInc = 0;
    let totalExp = 0;
    filteredTxs.forEach(tx => {
        if (tx.transaction_type === 'income') totalInc += Number(tx.amount || 0);
        else totalExp += Number(tx.amount || 0);
    });
    const totalBalance = rawWallets.reduce((sum, w) => sum + Number(w.balance || 0), 0);

    // Xử lý Biểu đồ Tròn
    let pie = [];
    if (activeCard === 'balance') {
        pie = rawWallets.filter(w => w.balance > 0).map(w => ({ name: w.name, value: Number(w.balance) }));
    } else {
        const catStats = {};
        filteredTxs.forEach(tx => {
            if (tx.transaction_type === activeCard) {
                const catName = categoryMap[tx.category_id]?.name || 'Khác';
                catStats[catName] = (catStats[catName] || 0) + Number(tx.amount || 0);
            }
        });
        pie = Object.keys(catStats).map(k => ({ name: k, value: catStats[k] }));
    }

    // Xử lý Biểu đồ Cột
    const dStats = {};
    const diffDays = timeRange === 'all_time' ? 999 : (endDate - startDate) / (1000 * 60 * 60 * 24);
    const groupByMonth = timeRange === '3_months' || timeRange === 'all_time' || diffDays > 31;

    filteredTxs.forEach(tx => {
        const [y, m, d] = tx.date.split('-');
        const txDate = new Date(y, m - 1, d);

        let key = '';
        let display = '';

        if (groupByMonth) {
            key = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}`;
            display = `Th${txDate.getMonth() + 1}/${txDate.getFullYear().toString().slice(-2)}`;
        } else {
            key = tx.date;
            display = `${txDate.getDate()}/${txDate.getMonth() + 1}`;
        }

        if (!dStats[key]) dStats[key] = { date: display, rawDate: key, income: 0, expense: 0 };

        if (tx.transaction_type === 'income') dStats[key].income += Number(tx.amount || 0);
        else dStats[key].expense += Number(tx.amount || 0);
    });

    const bar = Object.values(dStats).sort((a, b) => a.rawDate.localeCompare(b.rawDate));
    const sortedTx = [...rawTxs].sort((a, b) => new Date(b.date) - new Date(a.date));

    return { totalBalance, totalInc, totalExp, pie, bar, recentTxs: sortedTx.slice(0, 5) };
  }, [rawTxs, rawWallets, timeRange, activeCard, categoryMap, customStartDate, customEndDate]);

  if (isLoading) {
    return <div className="flex justify-center items-center h-screen text-indigo-600"><Loader2 className="animate-spin" size={40} /></div>;
  }

  const pieTitle = activeCard === 'balance' ? 'Cơ cấu các ví tiền' : activeCard === 'income' ? 'Cơ cấu thu nhập' : 'Cơ cấu chi tiêu';

  return (
    <div className="p-4 lg:p-8 bg-gray-50 min-h-screen animate-fade-in pb-24">
      <div className="max-w-6xl mx-auto space-y-6 lg:space-y-8">

        {/* ================= HEADER & FILTER ================= */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-5 lg:p-6 rounded-3xl shadow-sm border border-gray-100 gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center border-2 border-white shadow-sm">
              <User size={24} />
            </div>
            <div>
              <p className="text-gray-500 text-sm font-medium">Chào buổi sáng,</p>
              <h1 className="text-xl lg:text-2xl font-bold text-slate-800">Người dùng thân mến! 👋</h1>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full md:w-auto">
             <div className="flex items-center bg-gray-50 p-1.5 rounded-xl border border-gray-200 w-full sm:w-auto">
                 <Calendar size={18} className="text-gray-500 ml-2 shrink-0" />
                 <select
                    value={timeRange}
                    onChange={(e) => setTimeRange(e.target.value)}
                    className="bg-transparent border-none text-sm font-medium text-slate-700 focus:ring-0 cursor-pointer outline-none py-1.5 pr-2 w-full"
                 >
                    <option value="7_days">7 ngày qua</option>
                    <option value="this_month">Tháng này</option>
                    <option value="last_month">Tháng trước</option>
                    <option value="3_months">3 tháng qua</option>
                    <option value="all_time">Tất cả thời gian</option>
                    <option value="custom">Tùy chỉnh...</option>
                 </select>
             </div>

             {timeRange === 'custom' && (
                 <div className="flex items-center gap-2 animate-fade-in w-full sm:w-auto bg-white border border-gray-200 p-1 rounded-xl">
                    <input
                        type="date"
                        value={customStartDate}
                        onChange={e => setCustomStartDate(e.target.value)}
                        className="bg-transparent text-sm border-none focus:ring-0 text-slate-700 font-medium py-1 px-2 w-full sm:w-auto outline-none cursor-pointer"
                    />
                    <span className="text-gray-300">→</span>
                    <input
                        type="date"
                        value={customEndDate}
                        onChange={e => setCustomEndDate(e.target.value)}
                        className="bg-transparent text-sm border-none focus:ring-0 text-slate-700 font-medium py-1 px-2 w-full sm:w-auto outline-none cursor-pointer"
                    />
                 </div>
             )}
          </div>
        </div>

        {/* ================= 3 THẺ TỔNG QUAN (CLICKABLE) ================= */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div
            onClick={() => setActiveCard('balance')}
            className={`cursor-pointer transition-all duration-300 relative overflow-hidden p-6 rounded-3xl ${activeCard === 'balance' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 scale-100 ring-2 ring-offset-2 ring-indigo-600' : 'bg-white text-slate-800 border border-gray-100 hover:border-indigo-300 hover:bg-indigo-50'}`}
          >
            {activeCard === 'balance' && <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white opacity-10 rounded-full blur-2xl"></div>}
            <div className="flex justify-between items-start mb-4 relative z-10">
              <div className={`p-2.5 rounded-xl ${activeCard === 'balance' ? 'bg-white/20 text-white backdrop-blur-sm' : 'bg-indigo-100 text-indigo-600'}`}><Wallet size={24} /></div>
              {activeCard === 'balance' && <MousePointerClick size={18} className="text-indigo-200 animate-pulse" />}
            </div>
            <p className={`font-medium relative z-10 ${activeCard === 'balance' ? 'text-indigo-100' : 'text-gray-500'}`}>Tổng số dư (Tất cả)</p>
            <h3 className="text-2xl lg:text-3xl font-bold mt-1 relative z-10">{formatCurrency(dashboardData?.totalBalance)}</h3>
          </div>

          <div
             onClick={() => setActiveCard('income')}
             className={`cursor-pointer transition-all duration-300 p-6 rounded-3xl ${activeCard === 'income' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200 ring-2 ring-offset-2 ring-emerald-500' : 'bg-white text-slate-800 border border-gray-100 hover:border-emerald-300 hover:bg-emerald-50'}`}
          >
            <div className="flex justify-between items-start mb-4">
              <div className={`p-2.5 rounded-xl ${activeCard === 'income' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-600'}`}><TrendingUp size={24} /></div>
              {activeCard === 'income' && <MousePointerClick size={18} className="text-emerald-200 animate-pulse" />}
            </div>
            <p className={`font-medium ${activeCard === 'income' ? 'text-emerald-100' : 'text-gray-500'}`}>Tổng Thu {timeRange === 'this_month' ? '(Tháng này)' : '(Kỳ chọn)'}</p>
            <h3 className="text-2xl lg:text-3xl font-bold mt-1">{formatCurrency(dashboardData?.totalInc)}</h3>
          </div>

          <div
             onClick={() => setActiveCard('expense')}
             className={`cursor-pointer transition-all duration-300 p-6 rounded-3xl ${activeCard === 'expense' ? 'bg-rose-500 text-white shadow-lg shadow-rose-200 ring-2 ring-offset-2 ring-rose-500' : 'bg-white text-slate-800 border border-gray-100 hover:border-rose-300 hover:bg-rose-50'}`}
          >
            <div className="flex justify-between items-start mb-4">
              <div className={`p-2.5 rounded-xl ${activeCard === 'expense' ? 'bg-white/20 text-white' : 'bg-rose-100 text-rose-600'}`}><TrendingDown size={24} /></div>
              {activeCard === 'expense' && <MousePointerClick size={18} className="text-rose-200 animate-pulse" />}
            </div>
            <p className={`font-medium ${activeCard === 'expense' ? 'text-rose-100' : 'text-gray-500'}`}>Tổng Chi {timeRange === 'this_month' ? '(Tháng này)' : '(Kỳ chọn)'}</p>
            <h3 className="text-2xl lg:text-3xl font-bold mt-1">{formatCurrency(dashboardData?.totalExp)}</h3>
          </div>
        </div>

        {/* ================= KHU VỰC BIỂU ĐỒ ================= */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm transition-all">
            <h3 className="font-bold text-slate-800 mb-6 text-lg">{pieTitle}</h3>
            {dashboardData?.pie.length > 0 ? (
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={dashboardData.pie} cx="50%" cy="50%" innerRadius={65} outerRadius={100} paddingAngle={5} dataKey="value">
                      {dashboardData.pie.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={activeCard === 'income' ? '#10b981' : activeCard === 'balance' ? '#6366f1' : COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <PieTooltip formatter={(value) => formatCurrency(value)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-gray-400">Chưa có dữ liệu</div>
            )}
          </div>

          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm transition-all">
            <h3 className="font-bold text-slate-800 mb-6 text-lg">Biến động thời gian qua</h3>
            {dashboardData?.bar.length > 0 ? (
                <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dashboardData.bar} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(value) => `${value / 1000}k`} tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} />
                    <BarTooltip formatter={(value) => formatCurrency(value)} cursor={{fill: '#f8fafc'}} />

                    {(activeCard === 'income' || activeCard === 'balance') && (
                        <Bar dataKey="income" name="Thu nhập" fill="#10b981" radius={[4, 4, 0, 0]} barSize={activeCard === 'balance' ? 8 : 16} />
                    )}

                    {(activeCard === 'expense' || activeCard === 'balance') && (
                        <Bar dataKey="expense" name="Chi phí" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={activeCard === 'balance' ? 8 : 16} />
                    )}
                    </BarChart>
                </ResponsiveContainer>
                </div>
            ) : (
                 <div className="h-[280px] flex items-center justify-center text-gray-400">Chưa có giao dịch trong kỳ này</div>
            )}
          </div>
        </div>

        {/* ================= GIAO DỊCH GẦN ĐÂY & DANH SÁCH VÍ ================= */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-lg lg:text-xl text-slate-800">Giao dịch mới nhất</h3>
              <Link to="/transactions" className="text-indigo-600 text-sm font-medium hover:underline">Xem tất cả</Link>
            </div>
            <div className="space-y-3">
              {dashboardData?.recentTxs.length === 0 ? (
                <div className="bg-white p-8 rounded-3xl border border-gray-100 text-center text-gray-500 shadow-sm">
                  Chưa có giao dịch nào. <Link to="/transactions/add" className="text-indigo-600 font-medium">Thêm ngay!</Link>
                </div>
              ) : (
                dashboardData?.recentTxs.map(tx => {
                  const isIncome = tx.transaction_type === 'income';
                  const catInfo = categoryMap[tx.category_id] || { name: 'Khác', icon: '❓' };
                  const walletName = rawWallets.find(w => w.wallet_id === tx.wallet_id)?.name || 'Ví ẩn';

                  return (
                    <div key={tx.transaction_id} className="flex items-center justify-between p-4 lg:p-5 bg-white border border-gray-100 rounded-3xl shadow-sm hover:shadow-md transition-all">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center text-xl border border-gray-100">
                          {catInfo.icon}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800">{catInfo.name}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{walletName} • {tx.date}</p>
                        </div>
                      </div>
                      <div className={`font-semibold ${isIncome ? 'text-emerald-600' : 'text-slate-800'}`}>
                        {isIncome ? '+' : '-'}{formatCurrency(tx.amount)}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="flex justify-between items-center mb-4 mt-6 lg:mt-0">
              <h3 className="font-semibold text-lg lg:text-xl text-slate-800">Ví của tôi</h3>
            </div>
            <div className="space-y-3">
              {rawWallets.map(wallet => {
                const IconComponent = getWalletIcon(wallet.type);
                return (
                  <div key={wallet.wallet_id} className="p-4 lg:p-5 bg-white border border-gray-100 rounded-3xl shadow-sm hover:border-indigo-100 transition-colors">
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