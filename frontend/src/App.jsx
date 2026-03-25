import React from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, Outlet } from 'react-router-dom';
import { PlusCircle } from 'lucide-react';

// Import Components Layout
import Sidebar from './components/Sidebar';
import BottomNav from './components/BottomNav';

// Import Pages
import Login from './pages/Auth/Login';
import Register from './pages/Auth/Register';
import Dashboard from './pages/Dashboard/Dashboard';
import TransactionsList from './pages/Transactions/TransactionsList';
import AddTransaction from './pages/Transactions/AddTransaction';
import Debts from './pages/Debts/Debts';
import Investments from './pages/Investments/Investments';
import Subscriptions from './pages/Subscriptions/Subscriptions';
import AIChat from './pages/AIChat/AIChat';
import Profile from './pages/Profile/Profile';
import Budgets from './pages/Budgets/Budgets';

// Component phụ cho Header trên Desktop
function DesktopHeader() {
  const location = useLocation();
  const hideHeaderRoutes = ['/login', '/register', '/add'];
  if (hideHeaderRoutes.includes(location.pathname)) return null;

  return (
    <div className="hidden lg:flex justify-end items-center px-8 py-4 bg-white/50 backdrop-blur-sm border-b border-gray-100 z-10 absolute top-0 w-full">
      <Link to="/add" className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-indigo-700 transition-colors flex items-center gap-2 shadow-sm">
        <PlusCircle size={20} /> Thêm giao dịch
      </Link>
    </div>
  );
}

// ==========================================
// TẠO LAYOUT CHÍNH: Chứa Sidebar và BottomNav
// ==========================================
function MainLayout() {
  return (
    <div className="flex h-screen bg-gray-50 font-sans text-slate-800 overflow-hidden">

      <Sidebar />

      <div className="flex-1 flex flex-col relative w-full lg:max-w-none">
        <DesktopHeader />

        <div className="flex-1 overflow-y-auto pb-20 lg:pb-6 lg:pt-16">
          {/* <Outlet /> chính là nơi React Router sẽ render các trang con (Dashboard, Transactions...) vào đây */}
          <Outlet />
        </div>

        <BottomNav />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ==========================================
            NHÓM 1: AUTH ROUTES (KHÔNG CÓ SIDEBAR)
            ========================================== */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />


        {/* ==========================================
            NHÓM 2: MAIN ROUTES (BỌC TRONG LAYOUT CÓ SIDEBAR)
            ========================================== */}
        <Route element={<MainLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/transactions" element={<TransactionsList />} />
          <Route path="/add" element={<AddTransaction />} />
          <Route path="/debts" element={<Debts />} />
          <Route path="/investments" element={<Investments />} />
          <Route path="/subs" element={<Subscriptions />} />
          <Route path="/ai-chat" element={<AIChat />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/budgets" element={<Budgets />} />
        </Route>

      </Routes>
    </BrowserRouter>
  );
}