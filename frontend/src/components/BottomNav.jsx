import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Home, PieChart, PlusCircle, MessageSquare,
  LayoutGrid, Wallet, CreditCard, Target,
  TrendingUp, RefreshCw, Tag, User, X
} from 'lucide-react';

const MORE_ITEMS = [
  { to: '/wallets',      icon: Wallet,      label: 'Ví tiền' },
  { to: '/debts',        icon: CreditCard,  label: 'Nợ' },
  { to: '/budgets',      icon: Target,      label: 'Ngân sách' },
  { to: '/investments',  icon: TrendingUp,  label: 'Đầu tư' },
  { to: '/subs',         icon: RefreshCw,   label: 'Đăng ký' },
  { to: '/categories',   icon: Tag,         label: 'Danh mục' },
  { to: '/profile',      icon: User,        label: 'Tài khoản' },
];

export default function BottomNav() {
  const location = useLocation();
  const [showMore, setShowMore] = useState(false);
  const hideNavRoutes = ['/login', '/register', '/add'];

  React.useEffect(() => {
    if (showMore) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [showMore]);

  if (hideNavRoutes.includes(location.pathname)) return null;

  const isMoreActive = MORE_ITEMS.some(item => item.to === location.pathname);

  const NavItem = ({ to, icon: Icon, label, className: extraClass = '' }) => {
    const isActive = location.pathname === to;
    return (
      <Link
        to={to}
        className={`${extraClass} flex flex-col items-center justify-center w-14 transition-colors ${isActive ? 'text-indigo-600' : 'text-gray-400 hover:text-indigo-400'}`}
      >
        <Icon size={24} className={`mb-1 transition-transform duration-200 ${isActive ? 'scale-110' : ''}`} />
        <span className="text-[10px] font-medium">{label}</span>
      </Link>
    );
  };

  return (
    <>
      {/* Backdrop */}
      {showMore && (
        <div
          className="lg:hidden fixed inset-0 bg-black/30 z-40 backdrop-blur-sm"
          onClick={() => setShowMore(false)}
        />
      )}

      {/* More Sheet */}
      <div
        className={`lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl transition-transform duration-300 ease-out ${showMore ? 'translate-y-0' : 'translate-y-full'}`}
        onTouchMove={e => e.stopPropagation()}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        <div className="flex items-center justify-between px-5 py-3">
          <span className="text-sm font-semibold text-gray-700">Tất cả tính năng</span>
          <button
            onClick={() => setShowMore(false)}
            className="p-1.5 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-4 gap-y-4 px-4 pb-8 pt-1">
          {MORE_ITEMS.map(({ to, icon: Icon, label }) => {
            const isActive = location.pathname === to;
            return (
              <Link
                key={to}
                to={to}
                onClick={() => setShowMore(false)}
                className={`flex flex-col items-center gap-1.5 py-2 rounded-xl transition-colors ${isActive ? 'text-indigo-600 bg-indigo-50' : 'text-gray-500 hover:text-indigo-500 hover:bg-gray-50'}`}
              >
                <div className={`p-2.5 rounded-xl ${isActive ? 'bg-indigo-100' : 'bg-gray-100'}`}>
                  <Icon size={20} />
                </div>
                <span className="text-[10px] font-medium text-center leading-tight">{label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Bottom Nav Bar */}
      <div className="lg:hidden absolute bottom-0 w-full bg-white border-t border-gray-200 px-6 py-3 flex justify-between items-center z-50 rounded-t-2xl shadow-[0_-4px_15px_rgba(0,0,0,0.05)]">
        <NavItem to="/" icon={Home} label="Trang chủ" className="tour-dashboard-mobile" />
        <NavItem to="/transactions" icon={PieChart} label="Giao dịch" />

        <Link
          to="/add"
          className="tour-add-transaction-mobile relative -top-6 bg-indigo-600 text-white p-4 rounded-full shadow-lg hover:bg-indigo-700 transition-transform transform hover:scale-105 active:scale-95"
        >
          <PlusCircle size={32} />
        </Link>

        <NavItem to="/ai-chat" icon={MessageSquare} label="Trợ lý AI" className="tour-ai-chat-mobile" />

        <button
          onClick={() => setShowMore(prev => !prev)}
          className={`flex flex-col items-center justify-center w-14 transition-colors ${isMoreActive || showMore ? 'text-indigo-600' : 'text-gray-400 hover:text-indigo-400'}`}
        >
          <LayoutGrid size={24} className={`mb-1 transition-transform duration-200 ${isMoreActive || showMore ? 'scale-110' : ''}`} />
          <span className="text-[10px] font-medium">Thêm</span>
        </button>
      </div>
    </>
  );
}
