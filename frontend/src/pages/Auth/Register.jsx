import React, { useState } from 'react';
import { Mail, Lock, User, ArrowRight, Landmark, AlertCircle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import axiosClient from '../../api/axiosClient';

export default function Register() {
  const [formData, setFormData] = useState({ username: '', fullName: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  // Đăng ký truyền thống
  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await axiosClient.post('/auth/register', {
        username: formData.username,
        email: formData.email,
        password: formData.password,
        full_name: formData.fullName
      });

      const loginData = new URLSearchParams();
      loginData.append('username', formData.username);
      loginData.append('password', formData.password);

      const loginResponse = await axiosClient.post('/auth/login', loginData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });

      localStorage.setItem('access_token', loginResponse.access_token);
      localStorage.setItem('refresh_token', loginResponse.refresh_token);
      navigate('/');

    } catch (err) {
      if (err.response && err.response.data && err.response.data.detail) {
        setError(err.response.data.detail);
      } else {
        setError("Có lỗi xảy ra, vui lòng thử lại sau.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Đăng nhập/Đăng ký Google
  const handleGoogleSuccess = async (credentialResponse) => {
    setError('');
    setIsLoading(true);
    try {
      const response = await axiosClient.post('/auth/google', {
        token: credentialResponse.credential
      });

      localStorage.setItem('access_token', response.access_token);
      localStorage.setItem('refresh_token', response.refresh_token);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.detail || "Đăng ký bằng Google thất bại.");
    } finally {
      setIsLoading(false);
    }
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

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl flex items-center gap-2 text-sm">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form className="space-y-4" onSubmit={handleRegister}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Tên đăng nhập (Username)</label>
            <div className="relative">
              <User size={18} className="absolute inset-y-0 left-4 top-3.5 text-gray-400" />
              <input type="text" required value={formData.username} onChange={(e) => setFormData({...formData, username: e.target.value})}
                className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                placeholder="nguyenvana" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Họ và tên</label>
            <div className="relative">
              <User size={18} className="absolute inset-y-0 left-4 top-3.5 text-gray-400" />
              <input type="text" required value={formData.fullName} onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                placeholder="Nguyễn Văn A" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
            <div className="relative">
              <Mail size={18} className="absolute inset-y-0 left-4 top-3.5 text-gray-400" />
              <input type="email" required value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})}
                className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                placeholder="email@example.com" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Mật khẩu</label>
            <div className="relative">
              <Lock size={18} className="absolute inset-y-0 left-4 top-3.5 text-gray-400" />
              <input type="password" required value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})}
                className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                placeholder="••••••••" />
            </div>
          </div>

          <button type="submit" disabled={isLoading} className="w-full bg-indigo-600 text-white py-3.5 rounded-xl font-semibold mt-6 flex justify-center items-center gap-2 hover:bg-indigo-700 transition-all disabled:opacity-70">
            {isLoading ? "Đang xử lý..." : "Đăng ký"} <ArrowRight size={18} />
          </button>
        </form>

        {/* Nút Đăng ký bằng Google */}
        <div className="mt-8">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-3 bg-white lg:bg-white bg-gray-50 text-gray-500">Hoặc tiếp tục với</span>
            </div>
          </div>

          <div className="mt-6 flex justify-center w-full">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => setError('Lỗi kết nối với Google.')}
              useOneTap
              theme="outline"
              size="large"
              width="100%"
              text="signup_with"
            />
          </div>
        </div>

        <p className="mt-8 text-center text-sm text-gray-600">
          Đã có tài khoản? <Link to="/login" className="text-indigo-600 font-semibold hover:underline">Đăng nhập ngay</Link>
        </p>
      </div>
    </div>
  );
}