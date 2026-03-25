import React, { useState, useEffect } from 'react';
import { User, Settings, Bell, Shield, LogOut, ChevronRight, HelpCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axiosClient from '../../api/axiosClient'; // Import axios client

export default function Profile() {
  const navigate = useNavigate();
  // State lưu thông tin user
  const [userInfo, setUserInfo] = useState({ full_name: 'Đang tải...', username: '...' });

  useEffect(() => {
    // Gọi API lấy thông tin cá nhân
    const fetchProfile = async () => {
      try {
        const response = await axiosClient.get('/auth/me');
        setUserInfo(response); // response chính là data trả về do interceptor đã hứng
      } catch (error) {
        console.error("Lỗi lấy thông tin:", error);
      }
    };
    fetchProfile();
  }, []);

  const handleLogout = () => {
    // Xóa token và đá về trang login
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    navigate('/login');
  };

  const menuItems = [
    { icon: Settings, label: 'Cài đặt chung', color: 'text-gray-600 bg-gray-100' },
    { icon: Bell, label: 'Thông báo', color: 'text-blue-600 bg-blue-100' },
    { icon: Shield, label: 'Bảo mật tài khoản', color: 'text-emerald-600 bg-emerald-100' },
    { icon: HelpCircle, label: 'Trung tâm hỗ trợ', color: 'text-purple-600 bg-purple-100' },
  ];

  return (
    <div className="bg-gray-50 min-h-screen pb-20 animate-fade-in lg:py-10">
      <div className="max-w-2xl mx-auto">
        {/* Header Avatar */}
        <div className="bg-indigo-600 px-6 pt-10 pb-20 lg:rounded-[40px] rounded-b-[40px] relative">
          <h2 className="text-white text-xl lg:text-2xl font-semibold text-center mb-8">Hồ sơ cá nhân</h2>
          <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center">
            <div className="w-24 h-24 bg-white rounded-full p-1.5 shadow-lg">
              <div className="w-full h-full bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600">
                <User size={40} />
              </div>
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="pt-16 pb-6 px-6 text-center">
          {/* Hiển thị tên thật từ Database */}
          <h3 className="text-xl font-bold text-slate-800">{userInfo.full_name || userInfo.username}</h3>
          <p className="text-gray-500 text-sm mt-1">@{userInfo.username}</p>
        </div>

        {/* Menu */}
        <div className="px-6 space-y-3">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 ml-2">Cài đặt & Tùy chọn</p>
          {menuItems.map((item, index) => (
            <div key={index} className="flex items-center justify-between p-4 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-indigo-100 active:scale-[0.98] transition-all cursor-pointer group">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl ${item.color} group-hover:scale-110 transition-transform`}>
                  <item.icon size={20} />
                </div>
                <span className="font-semibold text-slate-700 group-hover:text-indigo-600 transition-colors">{item.label}</span>
              </div>
              <ChevronRight size={20} className="text-gray-400 group-hover:text-indigo-600 transition-colors" />
            </div>
          ))}

          <button onClick={handleLogout} className="w-full flex items-center justify-between p-4 mt-8 bg-white rounded-2xl border border-rose-100 shadow-sm active:scale-[0.98] transition-transform cursor-pointer group hover:bg-rose-50">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-rose-100 text-rose-600 group-hover:scale-110 transition-transform">
                <LogOut size={20} />
              </div>
              <span className="font-semibold text-rose-600">Đăng xuất</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}