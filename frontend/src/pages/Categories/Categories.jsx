import React, { useState, useEffect } from 'react';
import { LayoutGrid, Plus, X, Loader2, FolderTree, ChevronRight, Search, Trash2, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';
import axiosClient from '../../api/axiosClient';
import EmojiPicker from 'emoji-picker-react';

export default function Categories() {
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // State UI
  const [activeTab, setActiveTab] = useState('expense');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);

  // State Tìm kiếm/Lọc
  const [searchTerm, setSearchTerm] = useState('');

  // State Form
  const [formData, setFormData] = useState({
    name: '',
    type: 'expense',
    parent_id: '',
    icon: '📦'
  });

  const resetFormData = (type = activeTab) => {
    setFormData({
      name: '',
      type,
      parent_id: '',
      icon: '📦'
    });
    setEditingCategory(null);
    setShowEmojiPicker(false);
  };

  const openCreateModal = () => {
    resetFormData(activeTab);
    setIsModalOpen(true);
  };

  const openEditModal = (e, category) => {
    e.stopPropagation();
    setEditingCategory(category);
    setFormData({
      name: category.name || '',
      type: category.type || activeTab,
      parent_id: category.parent_id ? String(category.parent_id) : '',
      icon: category.icon || '📦'
    });
    setShowEmojiPicker(false);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    resetFormData(activeTab);
  };

  const fetchCategories = async () => {
    try {
      const res = await axiosClient.get('/categories/');
      const data = res.data || res;
      setCategories(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Lỗi tải danh mục:", error);
      toast.error("Không thể tải danh sách danh mục");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    if (isModalOpen && !editingCategory) {
      setFormData(prev => ({ ...prev, type: activeTab, parent_id: '' }));
      setShowEmojiPicker(false);
    }
  }, [activeTab, isModalOpen, editingCategory]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const categoryName = formData.name.trim();
    if (!categoryName) return toast.error("Vui lòng nhập tên danh mục!");

    setIsSubmitting(true);
    const submitPromise = editingCategory
      ? axiosClient.put(`/categories/${editingCategory.category_id}`, {
          name: categoryName,
          icon: formData.icon
        })
      : axiosClient.post('/categories/', {
          name: categoryName,
          type: formData.type,
          icon: formData.icon,
          parent_id: formData.parent_id ? Number(formData.parent_id) : null
        });

    toast.promise(submitPromise, {
      loading: editingCategory ? 'Đang cập nhật danh mục...' : 'Đang tạo danh mục...',
      success: editingCategory ? 'Cập nhật danh mục thành công! ✏️' : 'Tạo danh mục cá nhân thành công! 🎉',
      error: (err) => `Lỗi: ${err.response?.data?.detail || (editingCategory ? 'Không thể cập nhật danh mục' : 'Không thể tạo danh mục')}`
    });

    try {
      await submitPromise;
      closeModal();
      fetchCategories();
    } catch (error) { console.error(error); }
    finally { setIsSubmitting(false); }
  };

  // Hàm xử lý Xóa danh mục
  const handleDelete = async (e, categoryId, categoryName) => {
    e.stopPropagation();
    if (!window.confirm(`Bạn có chắc chắn muốn xóa danh mục "${categoryName}" không?`)) return;

    const deletePromise = axiosClient.delete(`/categories/${categoryId}`);

    toast.promise(deletePromise, {
        loading: 'Đang xóa...',
        success: 'Đã xóa danh mục thành công! 🗑️',
        error: (err) => err.response?.data?.detail || 'Lỗi khi xóa danh mục'
    });

    try {
        await deletePromise;
        fetchCategories(); // Load lại danh sách sau khi xóa
    } catch (error) {
        console.error("Lỗi xóa:", error);
    }
  };

  if (isLoading) return <div className="flex justify-center items-center h-screen text-indigo-600"><Loader2 className="animate-spin" size={40} /></div>;

  // ==========================================
  // LOGIC LỌC (FILTER & SEARCH)
  // ==========================================
  const filteredCategories = categories
    .filter(c => c.type === activeTab)
    .map(parent => {
      // Tìm xem từ khóa có khớp với tên danh mục cha không
      const parentMatch = parent.name.toLowerCase().includes(searchTerm.toLowerCase());

      // Lọc các danh mục con khớp với từ khóa
      const matchingSubs = parent.subcategories ? parent.subcategories.filter(sub =>
        sub.name.toLowerCase().includes(searchTerm.toLowerCase())
      ) : [];

      // Nếu cha khớp -> Giữ lại cha và TOÀN BỘ con (hoặc chỉ con khớp tùy bạn, ở đây mình giữ con khớp)
      // Nếu con khớp -> Giữ lại cha (dù cha không khớp) và các con khớp
      if (parentMatch || matchingSubs.length > 0) {
        return {
          ...parent,
          // Nếu cha khớp và search có nội dung, hiển thị tất cả con. Nếu không chỉ hiển thị con khớp.
          subcategories: parentMatch && searchTerm ? parent.subcategories : matchingSubs
        };
      }
      return null;
    })
    .filter(Boolean); // Loại bỏ các giá trị null (không khớp)

  const modalParentOptions = categories.filter(c => c.type === formData.type);

  return (
    <div className="p-4 lg:p-8 bg-gray-50 min-h-screen animate-fade-in pb-24">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* HEADER */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-5 lg:p-6 rounded-3xl shadow-sm border border-gray-100 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <LayoutGrid className="text-indigo-600" /> Quản lý Danh mục
            </h1>
            <p className="text-gray-500 mt-1">Tùy chỉnh các nhóm thu chi theo cách của bạn</p>
          </div>
          <button
              onClick={openCreateModal}
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-medium shadow-sm transition-colors"
          >
              <Plus size={18} /> Thêm mới
          </button>
        </div>

        {/* BỘ LỌC VÀ TÌM KIẾM */}
        <div className="flex flex-col md:flex-row gap-4">
            {/* Tabs */}
            <div className="flex gap-2 bg-white p-2 rounded-2xl shadow-sm border border-gray-100 w-full md:w-1/2">
                <button
                    onClick={() => setActiveTab('expense')}
                    className={`flex-1 py-2.5 rounded-xl font-medium transition-all ${activeTab === 'expense' ? 'bg-rose-50 text-rose-600 shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                    Chi phí
                </button>
                <button
                    onClick={() => setActiveTab('income')}
                    className={`flex-1 py-2.5 rounded-xl font-medium transition-all ${activeTab === 'income' ? 'bg-emerald-50 text-emerald-600 shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                    Thu nhập
                </button>
            </div>

            {/* Thanh Tìm kiếm */}
            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-2xl shadow-sm border border-gray-100 w-full md:w-1/2">
                <Search className="text-gray-400" size={20} />
                <input
                    type="text"
                    placeholder="Tìm kiếm danh mục..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="flex-1 bg-transparent border-none focus:ring-0 text-slate-700 outline-none placeholder:text-gray-400"
                />
                {searchTerm && (
                    <button onClick={() => setSearchTerm('')} className="text-gray-400 hover:text-rose-500"><X size={16}/></button>
                )}
            </div>
        </div>

        {/* DANH SÁCH TREE CATEOGRIES */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
           {filteredCategories.length === 0 ? (
             <div className="p-10 text-center text-gray-500 flex flex-col items-center">
                 <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-3"><Search className="text-gray-300" size={24}/></div>
                 Không tìm thấy danh mục nào phù hợp.
             </div>
           ) : (
             <div className="divide-y divide-gray-100">
               {filteredCategories.map(parent => (
                 <div key={parent.category_id} className="p-4 hover:bg-gray-50 transition-colors group">
                    {/* Thẻ Cha */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center text-2xl shadow-sm group-hover:bg-white transition-colors">
                                {parent.icon}
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 text-lg">{parent.name}</h3>
                                <p className="text-xs text-gray-400 font-medium">Danh mục gốc {parent.user_id ? '(Tự tạo)' : '(Hệ thống)'}</p>
                            </div>
                        </div>
                        {/* Nút Xóa Thẻ Cha (Chỉ hiện nếu là tự tạo) */}
                        {parent.user_id && (
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                              <button
                                onClick={(e) => openEditModal(e, parent)}
                                className="p-2 text-gray-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                title="Sửa danh mục này"
                              >
                                <Pencil size={18} />
                              </button>
                              <button
                                onClick={(e) => handleDelete(e, parent.category_id, parent.name)}
                                className="p-2 text-gray-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                                title="Xóa danh mục này"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                        )}
                    </div>

                    {/* Thẻ Con */}
                    {parent.subcategories && parent.subcategories.length > 0 && (
                      <div className="mt-3 pl-6 ml-6 border-l-2 border-gray-100 space-y-2">
                         {parent.subcategories.map(sub => (
                           <div key={sub.category_id} className="flex items-center gap-3 py-2 px-3 rounded-xl hover:bg-gray-100 transition-colors group/sub">
                             <span className="text-gray-300"><FolderTree size={16} /></span>
                             <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-lg border border-gray-100 shadow-sm">
                               {sub.icon}
                             </div>
                             <span className="font-medium text-slate-700 flex-1">{sub.name}</span>

                             {sub.user_id && <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider hidden sm:block">Tự tạo</span>}

                             {/* Nút Xóa Thẻ Con (Chỉ hiện nếu là tự tạo) */}
                             {sub.user_id && (
                              <div className="flex items-center gap-1 opacity-0 group-hover/sub:opacity-100">
                                <button
                                  onClick={(e) => openEditModal(e, sub)}
                                  className="p-1.5 text-gray-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                  title="Sửa danh mục này"
                                >
                                  <Pencil size={16} />
                                </button>
                                <button
                                  onClick={(e) => handleDelete(e, sub.category_id, sub.name)}
                                  className="p-1.5 text-gray-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                                  title="Xóa danh mục này"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                             )}
                           </div>
                         ))}
                      </div>
                    )}
                 </div>
               ))}
             </div>
           )}
        </div>
      </div>

      {/* ========================================== */}
      {/* MODAL THÊM DANH MỤC (GIỮ NGUYÊN NHƯ CŨ) */}
      {/* ========================================== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl animate-slide-up flex flex-col max-h-[90vh]">

            <div className="flex justify-between items-center p-5 lg:p-6 border-b border-gray-100">
              <h3 className="font-bold text-xl text-slate-800 flex items-center gap-2">
                 {editingCategory ? <Pencil className="text-indigo-600" /> : <Plus className="text-indigo-600" />} {editingCategory ? 'Cập nhật danh mục' : 'Tạo danh mục mới'}
              </h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-rose-500 transition-colors bg-gray-50 p-2 rounded-full">
                <X size={20} />
              </button>
            </div>

            <div className="overflow-y-auto p-5 lg:p-6">
              <form onSubmit={handleSubmit} className="space-y-5">
                {!editingCategory && (
                <div className="flex bg-gray-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, type: 'expense', parent_id: ''})}
                    className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${formData.type === 'expense' ? 'bg-white text-rose-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    Chi phí
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, type: 'income', parent_id: ''})}
                    className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${formData.type === 'income' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    Thu nhập
                  </button>
                </div>
                )}

                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1.5">Tên danh mục <span className="text-rose-500">*</span></label>
                  <input
                      type="text"
                      required maxLength={50}
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      placeholder="VD: Tiền bỉm sữa, Trà sữa..."
                      className="w-full bg-white border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none rounded-xl p-3 text-slate-800 font-medium transition-all"
                  />
                </div>

                {!editingCategory && (
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1.5">Trực thuộc (Không bắt buộc)</label>
                  <select
                      value={formData.parent_id}
                      onChange={(e) => setFormData({...formData, parent_id: e.target.value})}
                      className="w-full bg-white border border-gray-200 focus:ring-2 focus:ring-indigo-500 rounded-xl p-3 text-slate-700 font-medium outline-none cursor-pointer"
                  >
                      <option value="">-- Tạo thành Danh mục gốc --</option>
                      {modalParentOptions.map(c => (
                          <option key={c.category_id} value={c.category_id}>{c.icon} {c.name}</option>
                      ))}
                  </select>
                  <p className="text-xs text-gray-400 mt-1.5 flex items-center gap-1"><ChevronRight size={12}/> Để trống nếu đây là danh mục lớn.</p>
                </div>
                )}

                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-2">Chọn Biểu tượng (Icon)</label>
                  <div className="relative">
                    <button
                        type="button"
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        className="w-16 h-16 rounded-2xl bg-gray-50 border border-gray-200 text-3xl flex items-center justify-center hover:bg-gray-100 hover:border-indigo-300 transition-all shadow-sm"
                    >
                        {formData.icon}
                    </button>
                    {showEmojiPicker && (
                        <div className="absolute top-full mt-2 left-0 z-50 shadow-2xl rounded-2xl overflow-hidden border border-gray-100">
                          <EmojiPicker
                              onEmojiClick={(emojiData) => {
                                  setFormData({...formData, icon: emojiData.emoji});
                                  setShowEmojiPicker(false);
                              }}
                              autoFocusSearch={false} searchDisabled={true} skinTonesDisabled={true} height={300} width={320}
                          />
                        </div>
                    )}
                  </div>
                </div>

                <button type="submit" disabled={isSubmitting} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 rounded-xl font-bold transition-colors mt-4 shadow-sm shadow-indigo-200 disabled:opacity-70 flex justify-center items-center gap-2">
                  {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : (editingCategory ? 'Lưu thay đổi' : 'Lưu danh mục')}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}