import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, PieChart, PlusCircle, MessageSquare, User } from 'lucide-react';

export default function BottomNav() {
  const location = useLocation();
  const hideNavRoutes = ['/login', '/register', '/add'];

  if (hideNavRoutes.includes(location.pathname)) return null;

  const NavItem = ({ to, icon: Icon, label, className: extraClass = '' }) => {
    const isActive = location.pathname === to;
    return (
      <Link to={to} className={`${extraClass} flex flex-col items-center justify-center w-14 transition-colors ${isActive ? 'text-indigo-600' : 'text-gray-400 hover:text-indigo-400'}`}>
        <Icon size={24} className={`mb-1 transition-transform duration-200 ${isActive ? 'scale-110' : ''}`} />
        <span className="text-[10px] font-medium">{label}</span>
      </Link>
    );
  };

  return (
    <div className="lg:hidden absolute bottom-0 w-full bg-white border-t border-gray-200 px-6 py-3 flex justify-between items-center z-50 rounded-t-2xl shadow-[0_-4px_15px_rgba(0,0,0,0.05)]">
      <NavItem to="/" icon={Home} label="Trang chủ" className="tour-dashboard-mobile" />
      <NavItem to="/transactions" icon={PieChart} label="Giao dịch" />

      <Link to="/add" className="tour-add-transaction-mobile relative -top-6 bg-indigo-600 text-white p-4 rounded-full shadow-lg hover:bg-indigo-700 transition-transform transform hover:scale-105 active:scale-95">
        <PlusCircle size={32} />
      </Link>

      <NavItem to="/ai-chat" icon={MessageSquare} label="Trợ lý AI" className="tour-ai-chat-mobile" />
      <NavItem to="/profile" icon={User} label="Tài khoản" />
    </div>
  );
}