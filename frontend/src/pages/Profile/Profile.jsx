import React from 'react';
import { User, Settings, Bell, Shield, LogOut, ChevronRight, HelpCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Profile() {
  const navigate = useNavigate();

  const handleLogout = () => {
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
          <h2 className="text-white text-xl lg:text-2xl font-semibold text-center mb-6">Tài khoản của tôi</h2>
        </div>

        <div className="px-6 lg:px-8 -mt-16 relative z-10">
          <div className="bg-white rounded-3xl p-6 lg:p-8 shadow-lg border border-gray-100 flex flex-col items-center">
            <div className="w-24 h-24 bg-indigo-100 rounded-full flex items-center justify-center mb-4 border-4 border-white shadow-md">
              <User size={40} className="text-indigo-600" />
            </div>
            <h3 className="text-2xl font-bold text-slate-800">Minh Hiếu</h3>
            <p className="text-gray-500 font-medium">user@example.com</p>
            <button className="mt-5 bg-indigo-50 text-indigo-600 px-8 py-2.5 rounded-full text-sm font-bold hover:bg-indigo-100 transition-colors">
              Chỉnh sửa hồ sơ
            </button>
          </div>
        </div>

        {/* Menu Items */}
        <div className="px-6 lg:px-8 mt-8 space-y-3">
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
              <div className="p-3 rounded-xl bg-rose-100 text-rose-600">
                <LogOut size={20} />
              </div>
              <span className="font-bold text-rose-600">Đăng xuất</span>
            </div>
          </button>
        </div>

      </div>
    </div>
  );
}