import React, { useState } from 'react';
import { User, Lock, ArrowRight, Landmark, AlertCircle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import axiosClient from '../../api/axiosClient';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [globalError, setGlobalError] = useState('');
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  // Logic kiểm tra dữ liệu
  const validateField = (field, value) => {
    if (field === 'username') {
      return value.trim() ? '' : 'Vui lòng nhập email hoặc username';
    }
    if (field === 'password') {
      if (!value) return 'Vui lòng nhập mật khẩu';
      if (value.length < 6) return 'Mật khẩu phải có ít nhất 6 ký tự';
      return '';
    }
    return '';
  };

  const handleChange = (field, value) => {
    if (field === 'username') setUsername(value);
    if (field === 'password') setPassword(value);

    // Xóa lỗi toàn cục khi người dùng bắt đầu gõ lại
    if (globalError) setGlobalError('');

    // Nếu field đang có lỗi, kiểm tra realtime để xóa lỗi ngay khi người dùng gõ đúng
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: validateField(field, value) }));
    }
  };

  const handleBlur = (field, value) => {
    setErrors((prev) => ({ ...prev, [field]: validateField(field, value) }));
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setGlobalError('');

    // Kiểm tra lần cuối trước khi submit
    const userErr = validateField('username', username);
    const passErr = validateField('password', password);

    if (userErr || passErr) {
      setErrors({ username: userErr, password: passErr });
      return;
    }

    setIsLoading(true);
    try {
      const formData = new URLSearchParams();
      formData.append('username', username);
      formData.append('password', password);

      const response = await axiosClient.post('/auth/login', formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });

      localStorage.setItem('access_token', response.access_token);
      localStorage.setItem('refresh_token', response.refresh_token);
      navigate('/');
    } catch (err) {
      if (err.response && err.response.status === 401) {
        setGlobalError("Sai tài khoản hoặc mật khẩu.");
      } else {
        setGlobalError("Không thể kết nối đến máy chủ.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setGlobalError('');
    setIsLoading(true);
    try {
      const response = await axiosClient.post('/auth/google', {
        token: credentialResponse.credential
      });
      localStorage.setItem('access_token', response.access_token);
      localStorage.setItem('refresh_token', response.refresh_token);
      navigate('/');
    } catch (err) {
      setGlobalError(err.response?.data?.detail || "Đăng nhập bằng Google thất bại.");
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

        {globalError && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl flex items-center gap-2 text-sm">
            <AlertCircle size={16} />
            <span>{globalError}</span>
          </div>
        )}

        <form className="space-y-5" onSubmit={handleLogin}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email hoặc Username</label>
            <div className="relative">
              <User size={18} className="absolute inset-y-0 left-4 top-3.5 text-gray-400" />
              <input
                type="text"
                value={username}
                onChange={(e) => handleChange('username', e.target.value)}
                onBlur={(e) => handleBlur('username', e.target.value)}
                className={`w-full pl-11 pr-4 py-3 bg-gray-50 border ${errors.username ? 'border-rose-500 focus:ring-rose-500' : 'border-gray-200 focus:ring-indigo-500'} rounded-xl focus:ring-2 focus:bg-white transition-all outline-none`}
                placeholder="Nhập email hoặc username"
              />
            </div>
            {errors.username && <p className="text-rose-500 text-xs mt-1.5 flex items-center gap-1"><AlertCircle size={14}/> {errors.username}</p>}
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-sm font-medium text-gray-700">Mật khẩu</label>
              <a href="#" className="text-xs text-indigo-600 font-medium hover:underline">Quên mật khẩu?</a>
            </div>
            <div className="relative">
              <Lock size={18} className="absolute inset-y-0 left-4 top-3.5 text-gray-400" />
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => handleChange('password', e.target.value)}
                onBlur={(e) => handleBlur('password', e.target.value)}
                className={`w-full pl-11 pr-4 py-3 bg-gray-50 border ${errors.password ? 'border-rose-500 focus:ring-rose-500' : 'border-gray-200 focus:ring-indigo-500'} rounded-xl focus:ring-2 focus:bg-white transition-all outline-none`}
                placeholder="••••••••"
              />
            </div>
            {errors.password && <p className="text-rose-500 text-xs mt-1.5 flex items-center gap-1"><AlertCircle size={14}/> {errors.password}</p>}
          </div>

          <button type="submit" disabled={isLoading} className="w-full bg-indigo-600 text-white py-3.5 rounded-xl font-semibold mt-6 flex items-center justify-center gap-2 hover:bg-indigo-700 active:scale-[0.98] transition-all disabled:opacity-70 shadow-sm shadow-indigo-200">
            {isLoading ? "Đang xử lý..." : "Đăng nhập"} <ArrowRight size={18} />
          </button>
        </form>

        <div className="mt-8">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-3 bg-white lg:bg-white bg-gray-50 text-gray-500">Hoặc đăng nhập bằng</span>
            </div>
          </div>

          <div className="mt-6 flex justify-center w-full">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => setGlobalError('Lỗi kết nối với Google.')}
              useOneTap
              theme="outline"
              size="large"
              width="100%"
              text="signin_with"
            />
          </div>
        </div>

        <p className="mt-8 text-center text-sm text-gray-600">
          Chưa có tài khoản? <Link to="/register" className="text-indigo-600 font-semibold hover:underline">Tạo ngay</Link>
        </p>

      </div>
    </div>
  );
}