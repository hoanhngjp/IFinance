import React, { useState } from 'react';
import { User, Lock, ArrowRight, Landmark, AlertCircle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';

export default function Login() {
  // Thay email thành username vì Backend hỗ trợ login bằng cả Username hoặc Email
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // Backend FastAPI OAuth2 yêu cầu dữ liệu dạng x-www-form-urlencoded
      const formData = new URLSearchParams();
      formData.append('username', username); // Có thể nhập email hoặc username vào đây
      formData.append('password', password);

      const response = await axiosClient.post('/auth/login', formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      // Lưu Token vào Local Storage
      localStorage.setItem('access_token', response.access_token);
      localStorage.setItem('refresh_token', response.refresh_token);

      // Chuyển hướng về trang chủ (Dashboard)
      navigate('/');
    } catch (err) {
      if (err.response && err.response.status === 401) {
        setError("Sai tài khoản hoặc mật khẩu.");
      } else {
        setError("Không thể kết nối đến máy chủ.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center px-6 py-12 lg:py-0 animate-fade-in">
      <div className="max-w-md w-full mx-auto lg:bg-white lg:p-8 lg:rounded-3xl lg:shadow-xl lg:border border-gray-100">

        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200 mb-4 transform rotate-3">
            <Landmark size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">IFinance</h1>
          <p className="text-gray-500 mt-2 text-center text-sm">Quản lý tài chính cá nhân thông minh</p>
        </div>

        {/* Hiển thị lỗi */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl flex items-center gap-2 text-sm">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form className="space-y-5" onSubmit={handleLogin}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email hoặc Username</label>
            <div className="relative">
              {/* Thay icon Mail thành User cho đúng ngữ nghĩa */}
              <User size={18} className="absolute inset-y-0 left-4 top-3.5 text-gray-400" />
              <input type="text" required value={username} onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                placeholder="Nhập email hoặc username" />
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

          <button type="submit" disabled={isLoading} className="w-full bg-indigo-600 text-white py-3.5 rounded-xl font-semibold mt-6 flex items-center justify-center gap-2 hover:bg-indigo-700 active:scale-[0.98] transition-all disabled:opacity-70">
            {isLoading ? "Đang đăng nhập..." : "Đăng nhập"} <ArrowRight size={18} />
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-gray-600">
          Chưa có tài khoản? <Link to="/register" className="text-indigo-600 font-semibold hover:underline">Tạo ngay</Link>
        </p>

      </div>
    </div>
  );
}