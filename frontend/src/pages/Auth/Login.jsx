import React, { useState } from 'react';
import { Mail, Lock, ArrowRight, Landmark } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();
    navigate('/'); // Giả lập login thành công chuyển về Dashboard
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center px-6 py-12 lg:py-0 animate-fade-in">
      <div className="max-w-md w-full mx-auto lg:bg-white lg:p-8 lg:rounded-3xl lg:shadow-xl lg:border border-gray-100">

        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200 mb-4 transform rotate-3">
            <Landmark size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">IFinance</h1>
          <p className="text-gray-500 mt-2 text-center text-sm">Quản lý tài chính thông minh <br/> với trợ lý AI của riêng bạn</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5 bg-white p-6 lg:p-0 rounded-3xl shadow-sm lg:shadow-none border border-gray-100 lg:border-none">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
            <div className="relative">
              <Mail size={18} className="absolute inset-y-0 left-4 top-3.5 text-gray-400" />
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                placeholder="nhap@email.com" />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-sm font-medium text-gray-700">Mật khẩu</label>
              <a href="#" className="text-xs text-indigo-600 font-medium hover:underline">Quên mật khẩu?</a>
            </div>
            <div className="relative">
              <Lock size={18} className="absolute inset-y-0 left-4 top-3.5 text-gray-400" />
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                placeholder="••••••••" />
            </div>
          </div>

          <button type="submit" className="w-full bg-indigo-600 text-white py-3.5 rounded-xl font-semibold mt-6 flex items-center justify-center gap-2 hover:bg-indigo-700 active:scale-[0.98] transition-all">
            Đăng nhập <ArrowRight size={18} />
          </button>
        </form>

        <div className="mt-8 text-center text-sm text-gray-500">
          Chưa có tài khoản? <Link to="/register" className="text-indigo-600 font-semibold hover:underline">Đăng ký ngay</Link>
        </div>
      </div>
    </div>
  );
}