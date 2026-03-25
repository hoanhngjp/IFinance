import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, PieChart, MessageSquare, User, Landmark, Briefcase, Repeat, Target } from 'lucide-react';

const menuItems = [
  { to: '/', icon: Home, label: 'Trang chủ' },
  { to: '/transactions', icon: PieChart, label: 'Giao dịch' },
  { to: '/debts', icon: Landmark, label: 'Sổ Nợ' },
  { to: '/budgets', icon: Target, label: 'Ngân sách' },
  { to: '/investments', icon: Briefcase, label: 'Đầu tư' },
  { to: '/subs', icon: Repeat, label: 'Đăng ký định kỳ' },
  { to: '/ai-chat', icon: MessageSquare, label: 'Trợ lý AI' },
];

export default function Sidebar() {
  const location = useLocation();
  const hideNavRoutes = ['/login', '/register', '/add'];

  if (hideNavRoutes.includes(location.pathname)) return null;

  return (
    <div className="hidden lg:flex w-64 bg-white border-r border-gray-200 flex-col h-screen shadow-sm z-20">
      <div className="p-6 flex items-center gap-3">
        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
          <Landmark size={24} className="text-white" />
        </div>
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">IFinance</h1>
      </div>

      <div className="flex-1 px-4 space-y-2 overflow-y-auto">
        <p className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 mt-4">Menu Chính</p>
        {menuItems.map((item) => {
          const isActive = location.pathname === item.to;
          return (
            <Link key={item.to} to={item.to} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${isActive ? 'bg-indigo-50 text-indigo-600 font-semibold' : 'text-gray-500 hover:bg-gray-50 hover:text-indigo-600'}`}>
              <item.icon size={20} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>

      <div className="p-4 border-t border-gray-100">
        <Link to="/profile" className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${location.pathname === '/profile' ? 'bg-indigo-50 text-indigo-600 font-semibold' : 'text-gray-500 hover:bg-gray-50 hover:text-indigo-600'}`}>
          <User size={20} />
          <span>Tài khoản</span>
        </Link>
      </div>
    </div>
  );
}