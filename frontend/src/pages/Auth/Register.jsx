import React, { useState } from 'react';
import { Mail, Lock, User, ArrowRight, Landmark, AlertCircle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import axiosClient from '../../api/axiosClient';

export default function Register() {
  const [formData, setFormData] = useState({ username: '', fullName: '', email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [globalError, setGlobalError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  // Logic kiểm tra dữ liệu tuân thủ chuẩn Backend Pydantic
  const validateField = (field, value) => {
    if (field === 'username') {
      if (!value.trim()) return 'Vui lòng nhập tên đăng nhập';
      if (value.trim().length < 3) return 'Tên đăng nhập phải có ít nhất 3 ký tự';
      if (/\s/.test(value)) return 'Tên đăng nhập không được chứa khoảng trắng';
      return '';
    }
    if (field === 'fullName') {
      if (!value.trim()) return 'Vui lòng nhập họ và tên';
      if (value.trim().length < 2) return 'Họ và tên phải có ít nhất 2 ký tự';
      return '';
    }
    if (field === 'email') {
      if (!value.trim()) return 'Vui lòng nhập email';
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) return 'Email không hợp lệ';
      return '';
    }
    if (field === 'password') {
      if (!value) return 'Vui lòng nhập mật khẩu';
      if (value.length < 6) return 'Mật khẩu phải có ít nhất 6 ký tự';
      return '';
    }
    return '';
  };

  const handleChange = (field, value) => {
    setFormData({ ...formData, [field]: value });
    if (globalError) setGlobalError('');

    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: validateField(field, value) }));
    }
  };

  const handleBlur = (field, value) => {
    setErrors((prev) => ({ ...prev, [field]: validateField(field, value) }));
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setGlobalError('');

    // Kiểm tra toàn bộ form trước khi gửi API
    const newErrors = {
      username: validateField('username', formData.username),
      fullName: validateField('fullName', formData.fullName),
      email: validateField('email', formData.email),
      password: validateField('password', formData.password),
    };

    if (Object.values(newErrors).some(err => err !== '')) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);
    try {
      await axiosClient.post('/auth/register', {
        username: formData.username.trim(),
        email: formData.email.trim(),
        password: formData.password,
        full_name: formData.fullName.trim()
      });

      const loginData = new URLSearchParams();
      loginData.append('username', formData.username.trim());
      loginData.append('password', formData.password);

      const loginResponse = await axiosClient.post('/auth/login', loginData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });

      localStorage.setItem('access_token', loginResponse.access_token);
      localStorage.setItem('refresh_token', loginResponse.refresh_token);
      navigate('/');

    } catch (err) {
      if (err.response?.data?.detail) {
        const errDetail = err.response.data.detail;
        setGlobalError(typeof errDetail === 'string' ? errDetail : "Dữ liệu nhập vào chưa hợp lệ.");
      } else {
        setGlobalError("Có lỗi xảy ra, vui lòng thử lại sau.");
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
      setGlobalError(err.response?.data?.detail || "Đăng ký bằng Google thất bại.");
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

        {globalError && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl flex items-center gap-2 text-sm">
            <AlertCircle size={16} />
            <span>{globalError}</span>
          </div>
        )}

        <form className="space-y-4" onSubmit={handleRegister}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Tên đăng nhập (Username)</label>
            <div className="relative">
              <User size={18} className="absolute inset-y-0 left-4 top-3.5 text-gray-400" />
              <input
                type="text"
                value={formData.username}
                onChange={(e) => handleChange('username', e.target.value)}
                onBlur={(e) => handleBlur('username', e.target.value)}
                className={`w-full pl-11 pr-4 py-3 bg-gray-50 border ${errors.username ? 'border-rose-500 focus:ring-rose-500' : 'border-gray-200 focus:ring-indigo-500'} rounded-xl focus:ring-2 focus:bg-white transition-all outline-none`}
                placeholder="nguyenvana"
              />
            </div>
            {errors.username && <p className="text-rose-500 text-xs mt-1.5 flex items-center gap-1"><AlertCircle size={14}/> {errors.username}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Họ và tên</label>
            <div className="relative">
              <User size={18} className="absolute inset-y-0 left-4 top-3.5 text-gray-400" />
              <input
                type="text"
                value={formData.fullName}
                onChange={(e) => handleChange('fullName', e.target.value)}
                onBlur={(e) => handleBlur('fullName', e.target.value)}
                className={`w-full pl-11 pr-4 py-3 bg-gray-50 border ${errors.fullName ? 'border-rose-500 focus:ring-rose-500' : 'border-gray-200 focus:ring-indigo-500'} rounded-xl focus:ring-2 focus:bg-white transition-all outline-none`}
                placeholder="Nguyễn Văn A"
              />
            </div>
            {errors.fullName && <p className="text-rose-500 text-xs mt-1.5 flex items-center gap-1"><AlertCircle size={14}/> {errors.fullName}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
            <div className="relative">
              <Mail size={18} className="absolute inset-y-0 left-4 top-3.5 text-gray-400" />
              <input
                type="email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                onBlur={(e) => handleBlur('email', e.target.value)}
                className={`w-full pl-11 pr-4 py-3 bg-gray-50 border ${errors.email ? 'border-rose-500 focus:ring-rose-500' : 'border-gray-200 focus:ring-indigo-500'} rounded-xl focus:ring-2 focus:bg-white transition-all outline-none`}
                placeholder="email@example.com"
              />
            </div>
            {errors.email && <p className="text-rose-500 text-xs mt-1.5 flex items-center gap-1"><AlertCircle size={14}/> {errors.email}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Mật khẩu</label>
            <div className="relative">
              <Lock size={18} className="absolute inset-y-0 left-4 top-3.5 text-gray-400" />
              <input
                type="password"
                value={formData.password}
                onChange={(e) => handleChange('password', e.target.value)}
                onBlur={(e) => handleBlur('password', e.target.value)}
                className={`w-full pl-11 pr-4 py-3 bg-gray-50 border ${errors.password ? 'border-rose-500 focus:ring-rose-500' : 'border-gray-200 focus:ring-indigo-500'} rounded-xl focus:ring-2 focus:bg-white transition-all outline-none`}
                placeholder="••••••••"
              />
            </div>
            {errors.password && <p className="text-rose-500 text-xs mt-1.5 flex items-center gap-1"><AlertCircle size={14}/> {errors.password}</p>}
          </div>

          <button type="submit" disabled={isLoading} className="w-full bg-indigo-600 text-white py-3.5 rounded-xl font-semibold mt-6 flex justify-center items-center gap-2 hover:bg-indigo-700 transition-all disabled:opacity-70 shadow-sm shadow-indigo-200">
            {isLoading ? "Đang xử lý..." : "Đăng ký"} <ArrowRight size={18} />
          </button>
        </form>

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
              onError={() => setGlobalError('Lỗi kết nối với Google.')}
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