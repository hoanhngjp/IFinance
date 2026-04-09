import React, { useState, useEffect } from 'react';
import { User, Settings, Shield, LogOut, ChevronRight, Edit2, Key, Mail, Calendar, X, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import axiosClient from '../../api/axiosClient';

export default function Profile() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [userInfo, setUserInfo] = useState({ full_name: '', username: '', email: '', created_at: '' });

  // States cho Modals
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isChangePassOpen, setIsChangePassOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // States form dữ liệu
  const [editName, setEditName] = useState('');
  const [passForm, setPassForm] = useState({ old_password: '', new_password: '', confirm_password: '' });

  // States lỗi Validation
  const [errors, setErrors] = useState({});

  // ==========================================
  // 1. DATA FETCHING
  // ==========================================
  const fetchProfile = async () => {
    try {
      const response = await axiosClient.get('/users/me');
      const data = response.data?.data || response.data;
      setUserInfo(data);
    } catch (error) {
      console.error("Lỗi lấy thông tin:", error);
      toast.error("Không thể tải thông tin hồ sơ");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  // ==========================================
  // 2. VALIDATION LOGIC
  // ==========================================
  const validateName = (name) => {
    if (!name || !name.trim()) return "Tên hiển thị không được để trống";
    if (name.trim().length < 2) return "Tên phải có ít nhất 2 ký tự";
    return "";
  };

  const validatePassField = (field, value, formState = passForm) => {
    if (field === 'old_password') {
      return value ? "" : "Vui lòng nhập mật khẩu hiện tại";
    }
    if (field === 'new_password') {
      if (!value) return "Vui lòng nhập mật khẩu mới";
      if (value.length < 6) return "Mật khẩu mới phải có ít nhất 6 ký tự";
      return "";
    }
    if (field === 'confirm_password') {
      if (!value) return "Vui lòng xác nhận mật khẩu mới";
      if (value !== formState.new_password) return "Mật khẩu xác nhận không khớp";
      return "";
    }
    return "";
  };

  // ==========================================
  // 3. EVENT HANDLERS HỒ SƠ
  // ==========================================
  const openEditModal = () => {
    setEditName(''); // Dọn trống input để hiển thị placeholder
    setErrors({});
    setIsEditProfileOpen(true);
  };

  const handleNameChange = (e) => {
    const val = e.target.value;
    setEditName(val);
    if (errors.name) {
      setErrors({ ...errors, name: validateName(val) });
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    const errorMsg = validateName(editName);

    if (errorMsg) {
      setErrors({ ...errors, name: errorMsg });
      return toast.error("Vui lòng kiểm tra lại thông tin nhập");
    }

    setIsSubmitting(true);
    const promise = axiosClient.put('/users/me', { full_name: editName.trim() });

    toast.promise(promise, {
      loading: 'Đang cập nhật...',
      success: 'Đã cập nhật tên hiển thị! ✨',
      error: 'Lỗi khi cập nhật thông tin.'
    });

    try {
      await promise;
      setIsEditProfileOpen(false);
      fetchProfile();
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ==========================================
  // 4. EVENT HANDLERS MẬT KHẨU
  // ==========================================
  const openPassModal = () => {
    setPassForm({ old_password: '', new_password: '', confirm_password: '' });
    setErrors({});
    setIsChangePassOpen(true);
  };

  const handlePassChange = (field, value) => {
    const newForm = { ...passForm, [field]: value };
    setPassForm(newForm);

    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: validatePassField(field, value, newForm) }));
    }

    // Ràng buộc chéo: Nếu sửa mật khẩu mới, kiểm tra lại luôn ô xác nhận nếu nó đang có lỗi hoặc đã có data
    if (field === 'new_password' && newForm.confirm_password) {
      setErrors((prev) => ({
        ...prev,
        confirm_password: validatePassField('confirm_password', newForm.confirm_password, newForm)
      }));
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();

    const oldErr = validatePassField('old_password', passForm.old_password);
    const newErr = validatePassField('new_password', passForm.new_password);
    const confErr = validatePassField('confirm_password', passForm.confirm_password);

    if (oldErr || newErr || confErr) {
      setErrors({
        old_password: oldErr,
        new_password: newErr,
        confirm_password: confErr
      });
      return toast.error("Vui lòng sửa các lỗi hiển thị trên form");
    }

    setIsSubmitting(true);
    try {
      const res = await axiosClient.put('/users/me/password', passForm);
      toast.success(res.data?.message || "Đổi mật khẩu thành công!");
      setIsChangePassOpen(false);
    } catch (error) {
      // Bắt an toàn cấu trúc lỗi của FastAPI
      const errDetail = error.response?.data?.detail;
      let errorMessage = "Lỗi hệ thống khi đổi mật khẩu";

      if (typeof errDetail === 'string') {
        // Lỗi 400/401, 404... do Backend tự định nghĩa (Trả về String)
        errorMessage = errDetail;
      } else if (Array.isArray(errDetail)) {
        // Lỗi 422 của Pydantic Validation (Trả về Array Object)
        // Lấy thông báo lỗi của field đầu tiên bị vi phạm
        errorMessage = errDetail[0].msg === "String should have at least 6 characters"
            ? "Mật khẩu nhập vào quá ngắn (cần ít nhất 6 ký tự)"
            : "Dữ liệu nhập vào không hợp lệ";
      }
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ==========================================
  // 5. EVENT HANDLER ĐĂNG XUẤT
  // ==========================================
  const handleLogout = async () => {
    try {
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        await axiosClient.post('/auth/logout', { refresh_token: refreshToken });
      }
    } catch (error) {
      console.error("Lỗi khi đăng xuất:", error);
    } finally {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      navigate('/login');
    }
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-screen text-indigo-600"><Loader2 className="animate-spin" size={40} /></div>;
  }

  const avatarLetter = (userInfo.full_name ? userInfo.full_name.charAt(0) : userInfo.username?.charAt(0) || 'U').toUpperCase();

  return (
    <div className="bg-gray-50 min-h-screen pb-24 animate-fade-in lg:py-10">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* HEADER */}
        <div className="bg-white lg:rounded-[32px] rounded-b-[32px] shadow-sm border border-gray-100 overflow-hidden">
            <div className="h-32 lg:h-40 bg-gradient-to-r from-indigo-500 to-purple-600 relative">
                <button onClick={openEditModal} className="absolute top-4 right-4 bg-white/20 hover:bg-white/30 backdrop-blur-md text-white p-2 rounded-xl transition-colors" title="Chỉnh sửa hồ sơ">
                    <Edit2 size={20} />
                </button>
            </div>

            <div className="px-6 pb-8 relative flex flex-col items-center">
                <div className="w-24 h-24 lg:w-28 lg:h-28 bg-white rounded-full p-1.5 shadow-lg -mt-12 lg:-mt-14 mb-4 relative">
                    <div className="w-full h-full bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full flex items-center justify-center text-indigo-600 text-3xl lg:text-4xl font-extrabold border border-indigo-50">
                        {avatarLetter}
                    </div>
                </div>

                <h3 className="text-2xl font-bold text-slate-800">{userInfo.full_name || userInfo.username}</h3>
                <p className="text-indigo-600 font-medium bg-indigo-50 px-3 py-1 rounded-full mt-2 text-sm">@{userInfo.username}</p>

                <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-6 mt-6 text-sm text-gray-500">
                    <div className="flex items-center gap-2"><Mail size={16} /> {userInfo.email}</div>
                    <div className="hidden sm:block w-1.5 h-1.5 bg-gray-300 rounded-full"></div>
                    <div className="flex items-center gap-2"><Calendar size={16} /> Tham gia: {new Date(userInfo.created_at).toLocaleDateString('vi-VN')}</div>
                </div>
            </div>
        </div>

        {/* MENU TÙY CHỌN */}
        <div className="px-4 lg:px-0 space-y-3">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 ml-2">Cài đặt tài khoản</p>

          <div onClick={openEditModal} className="flex items-center justify-between p-4 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-indigo-100 active:scale-[0.99] transition-all cursor-pointer group">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl text-blue-600 bg-blue-50 group-hover:scale-110 transition-transform`}><User size={20} /></div>
                <span className="font-semibold text-slate-700 group-hover:text-indigo-600 transition-colors">Thông tin cá nhân</span>
              </div>
              <ChevronRight size={20} className="text-gray-400 group-hover:text-indigo-600 transition-colors" />
          </div>

          <div onClick={openPassModal} className="flex items-center justify-between p-4 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-indigo-100 active:scale-[0.99] transition-all cursor-pointer group">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl text-emerald-600 bg-emerald-50 group-hover:scale-110 transition-transform`}><Key size={20} /></div>
                <span className="font-semibold text-slate-700 group-hover:text-indigo-600 transition-colors">Đổi mật khẩu</span>
              </div>
              <ChevronRight size={20} className="text-gray-400 group-hover:text-indigo-600 transition-colors" />
          </div>

          <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-indigo-100 active:scale-[0.99] transition-all cursor-pointer group">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl text-purple-600 bg-purple-50 group-hover:scale-110 transition-transform`}><Settings size={20} /></div>
                <span className="font-semibold text-slate-700 group-hover:text-indigo-600 transition-colors">Cài đặt ứng dụng</span>
              </div>
              <ChevronRight size={20} className="text-gray-400 group-hover:text-indigo-600 transition-colors" />
          </div>

          <button onClick={handleLogout} className="w-full flex items-center justify-between p-4 mt-8 bg-white rounded-2xl border border-rose-100 shadow-sm active:scale-[0.99] transition-all cursor-pointer group hover:bg-rose-50">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-rose-100 text-rose-600 group-hover:scale-110 transition-transform"><LogOut size={20} /></div>
              <span className="font-semibold text-rose-600">Đăng xuất</span>
            </div>
          </button>
        </div>
      </div>

      {/* ========================================== */}
      {/* MODAL CẬP NHẬT THÔNG TIN */}
      {/* ========================================== */}
      {isEditProfileOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-slide-up flex flex-col">
            <div className="flex justify-between items-center p-5 lg:p-6 border-b border-gray-100 shrink-0">
              <h3 className="font-bold text-xl text-slate-800 flex items-center gap-2"><User className="text-indigo-600" /> Chỉnh sửa hồ sơ</h3>
              <button onClick={() => setIsEditProfileOpen(false)} className="text-gray-400 hover:text-rose-500 transition-colors bg-gray-50 p-2 rounded-full"><X size={20} /></button>
            </div>

            <form onSubmit={handleUpdateProfile} className="p-5 lg:p-6 space-y-5">
                <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1.5">Tên hiển thị mới</label>
                    <input
                        type="text"
                        value={editName}
                        onChange={handleNameChange}
                        onBlur={() => setErrors({ ...errors, name: validateName(editName) })}
                        className={`w-full bg-gray-50 border ${errors.name ? 'border-rose-500 focus:ring-rose-500' : 'border-gray-200 focus:ring-indigo-500'} focus:bg-white focus:ring-2 outline-none rounded-xl p-3 font-medium text-slate-800 transition-colors`}
                        placeholder={userInfo.full_name || 'Nhập tên hiển thị...'}
                    />
                    {errors.name && (
                      <p className="text-rose-500 text-xs mt-1.5 flex items-center gap-1">
                        <AlertCircle size={14} /> {errors.name}
                      </p>
                    )}
                </div>
                <div className="bg-blue-50 p-3 rounded-xl border border-blue-100 flex items-start gap-3">
                    <Shield size={18} className="text-blue-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-700 leading-relaxed">Email và Username không thể thay đổi để đảm bảo an toàn cho tài khoản của bạn.</p>
                </div>
                <button type="submit" disabled={isSubmitting} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 rounded-xl font-bold transition-colors shadow-sm shadow-indigo-200 disabled:opacity-70 flex justify-center items-center gap-2">
                    {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : <><CheckCircle size={20} /> Lưu thay đổi</>}
                </button>
            </form>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL ĐỔI MẬT KHẨU */}
      {/* ========================================== */}
      {isChangePassOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-slide-up flex flex-col">
            <div className="flex justify-between items-center p-5 lg:p-6 border-b border-gray-100 shrink-0">
              <h3 className="font-bold text-xl text-slate-800 flex items-center gap-2"><Key className="text-emerald-600" /> Đổi mật khẩu</h3>
              <button onClick={() => setIsChangePassOpen(false)} className="text-gray-400 hover:text-rose-500 transition-colors bg-gray-50 p-2 rounded-full"><X size={20} /></button>
            </div>

            <form onSubmit={handleChangePassword} className="p-5 lg:p-6 space-y-4">
                <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1.5">Mật khẩu hiện tại</label>
                    <input
                        type="password"
                        value={passForm.old_password}
                        onChange={(e) => handlePassChange('old_password', e.target.value)}
                        onBlur={() => setErrors({ ...errors, old_password: validatePassField('old_password', passForm.old_password) })}
                        className={`w-full bg-gray-50 border ${errors.old_password ? 'border-rose-500 focus:ring-rose-500' : 'border-gray-200 focus:ring-emerald-500'} focus:bg-white focus:ring-2 outline-none rounded-xl p-3 text-slate-800 transition-colors`}
                        placeholder="••••••••"
                    />
                    {errors.old_password && (
                      <p className="text-rose-500 text-xs mt-1.5 flex items-center gap-1">
                        <AlertCircle size={14} /> {errors.old_password}
                      </p>
                    )}
                </div>
                <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1.5">Mật khẩu mới</label>
                    <input
                        type="password"
                        value={passForm.new_password}
                        onChange={(e) => handlePassChange('new_password', e.target.value)}
                        onBlur={() => setErrors({ ...errors, new_password: validatePassField('new_password', passForm.new_password) })}
                        className={`w-full bg-gray-50 border ${errors.new_password ? 'border-rose-500 focus:ring-rose-500' : 'border-gray-200 focus:ring-emerald-500'} focus:bg-white focus:ring-2 outline-none rounded-xl p-3 text-slate-800 transition-colors`}
                        placeholder="••••••••"
                    />
                    {errors.new_password && (
                      <p className="text-rose-500 text-xs mt-1.5 flex items-center gap-1">
                        <AlertCircle size={14} /> {errors.new_password}
                      </p>
                    )}
                </div>
                <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1.5">Xác nhận mật khẩu mới</label>
                    <input
                        type="password"
                        value={passForm.confirm_password}
                        onChange={(e) => handlePassChange('confirm_password', e.target.value)}
                        onBlur={() => setErrors({ ...errors, confirm_password: validatePassField('confirm_password', passForm.confirm_password) })}
                        className={`w-full bg-gray-50 border ${errors.confirm_password ? 'border-rose-500 focus:ring-rose-500' : 'border-gray-200 focus:ring-emerald-500'} focus:bg-white focus:ring-2 outline-none rounded-xl p-3 text-slate-800 transition-colors`}
                        placeholder="••••••••"
                    />
                    {errors.confirm_password && (
                      <p className="text-rose-500 text-xs mt-1.5 flex items-center gap-1">
                        <AlertCircle size={14} /> {errors.confirm_password}
                      </p>
                    )}
                </div>

                <button type="submit" disabled={isSubmitting} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 rounded-xl font-bold transition-colors mt-6 shadow-sm shadow-emerald-200 disabled:opacity-70 flex justify-center items-center gap-2">
                    {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : <><Shield size={20} /> Đổi mật khẩu an toàn</>}
                </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}