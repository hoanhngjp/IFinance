import React, { useState } from 'react';
import { Mail, Lock, User, ArrowRight, Landmark } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export default function Register() {
  const [formData, setFormData] = useState({ fullName: '', email: '', password: '' });
  const navigate = useNavigate();

  const handleRegister = (e) => {
    e.preventDefault();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center px-6 py-12 lg:py-0 animate-fade-in">
      <div className="max-w-md w-full mx-auto lg:bg-white lg:p-8 lg:rounded-3xl lg:shadow-xl lg:border border-gray-100">
        
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200 mb-4 transform -rotate-3">
            <Landmark size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Tạo tài khoản mới</h1>
          <p className="text-gray-500 mt-1 text-center text-sm">Bắt đầu hành trình quản lý tài chính</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4 bg-white p-6 lg:p-0 rounded-3xl shadow-sm lg:shadow-none border border-gray-100 lg:border-none">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Họ và tên</label>
            <div className="relative">
              <User size={18} className="absolute inset-y-0 left-4 top-3.5 text-gray-400" />
              <input type="text" required onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                placeholder="Nguyễn Văn A" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
            <div className="relative">
              <Mail size={18} className="absolute inset-y-0 left-4 top-3.5 text-gray-400" />
              <input type="email" required onChange={(e) => setFormData({...formData, email: e.target.value})}
                className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                placeholder="email@example.com" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Mật khẩu</label>
            <div className="relative">
              <Lock size={18} className="absolute inset-y-0 left-4 top-3.5 text-gray-400" />
              <input type="password" required onChange={(e) => setFormData({...formData, password: e.target.value})}
                className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                placeholder="••••••••" />
            </div>
          </div>

          <button type="submit" className="w-full bg-indigo-600 text-white py-3.5 rounded-xl font-semibold mt-6 flex justify-center gap-2 hover:bg-indigo-700 transition-all">
            Đăng ký <ArrowRight size={18} />
          </button>
        </form>

        <div className="mt-8 text-center text-sm text-gray-500">
          Đã có tài khoản? <Link to="/login" className="text-indigo-600 font-semibold hover:underline">Đăng nhập</Link>
        </div>
      </div>
    </div>
  );
}