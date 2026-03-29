import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Home, PieChart, MessageSquare, User, Landmark,
  Briefcase, Repeat, Target, Wallet, LayoutGrid, LogOut
} from 'lucide-react';
import axiosClient from '../api/axiosClient';

const menuItems = [
  { to: '/', icon: Home, label: 'Trang chủ' },
  { to: '/transactions', icon: PieChart, label: 'Giao dịch' },
  { to: '/wallets', icon: Wallet, label: 'Ví tiền' },
  { to: '/debts', icon: Landmark, label: 'Sổ Nợ' },
  { to: '/budgets', icon: Target, label: 'Ngân sách' },
  { to: '/investments', icon: Briefcase, label: 'Đầu tư' },
  { to: '/subs', icon: Repeat, label: 'Đăng ký định kỳ' },
  { to: '/ai-chat', icon: MessageSquare, label: 'Trợ lý AI' },
  { to: '/categories', icon: LayoutGrid, label: 'Danh mục' },
  { to: '/profile', icon: User, label: 'Hồ sơ' }, // <-- Thêm dòng này để xuất hiện trên Desktop
];

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const hideNavRoutes = ['/login', '/register', '/add'];

  if (hideNavRoutes.includes(location.pathname)) return null;

  const handleLogout = async () => {
    try {
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        await axiosClient.post('/auth/logout', { refresh_token: refreshToken });
      }
    } catch (error) {
      console.error("Lỗi khi đăng xuất:", error);
    } finally {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      navigate('/login');
    }
  };

  return (
    <div className="hidden lg:flex w-64 bg-white border-r border-gray-200 flex-col h-screen shadow-sm z-20">
      <div className="p-6 flex items-center gap-3">
        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
          <Landmark size={24} className="text-white" />
        </div>
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">IFinance</h1>
      </div>

      <div className="flex-1 px-4 space-y-1 overflow-y-auto hide-scrollbar">
        <p className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 mt-4">Menu Chính</p>
        {menuItems.map((item) => {
          const isActive = location.pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                isActive
                  ? 'bg-indigo-50 text-indigo-600 font-semibold'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-indigo-600'
              }`}
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Khu vực chân trang Sidebar */}
      <div className="p-4 border-t border-gray-100 space-y-1">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 px-4 py-3 rounded-xl text-rose-500 hover:bg-rose-50 transition-colors font-semibold"
        >
          <LogOut size={20} />
          <span>Đăng xuất</span>
        </button>
      </div>
    </div>
  );
}