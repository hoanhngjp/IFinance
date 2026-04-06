import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, Loader2, Trash2, Sparkles, CheckCircle, X } from 'lucide-react';
import toast from 'react-hot-toast';
import axiosClient from '../../api/axiosClient';

const formatCurrency = (amount) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

// ==========================================
// HÀM FORMAT MARKDOWN CƠ BẢN CHO CHATBOT
// ==========================================
const formatMessage = (text) => {
  if (!text) return null;
  const parts = text.split(/(\*\*.*?\*\*)/g);

  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index} className="font-bold text-slate-800">{part.slice(2, -2)}</strong>;
    }
    return <span key={index}>{part}</span>;
  });
};

export default function AIChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState(localStorage.getItem('ai_session_id') || null);

  // State phục vụ Modal xác nhận giao dịch từ AI
  const [wallets, setWallets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [pendingTxs, setPendingTxs] = useState([]);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isSavingTx, setIsSavingTx] = useState(false);

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Load Metadata (Ví, Danh mục) để dịch ID thành tên trong Popup
  useEffect(() => {
      const fetchMetadata = async () => {
          try {
              const [wRes, cRes] = await Promise.all([
                  axiosClient.get('/wallets/'),
                  axiosClient.get('/categories/')
              ]);
              setWallets(wRes.data || []);
              setCategories(cRes.data || []);
          } catch (e) {
              console.error("Lỗi tải metadata", e);
          }
      };
      fetchMetadata();
  }, []);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!sessionId) {
        setMessages([{
          id: 'welcome',
          sender: 'bot',
          text: 'Xin chào! Mình là Trợ lý tài chính IFinance. Bạn muốn hỏi gì về tình hình thu chi hay ghi nhận giao dịch mới không?'
        }]);
        return;
      }

      try {
        const response = await axiosClient.get(`/ai/chat/${sessionId}`);
        const historyData = response.data?.data || response.data || [];
        if (historyData.length > 0) {
          setMessages(historyData);
        }
      } catch (error) {
        console.error("Lỗi tải lịch sử chat:", error);
      }
    };

    fetchHistory();
  }, [sessionId]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userText = input.trim();
    setInput('');

    setMessages(prev => [...prev, { sender: 'user', text: userText }]);
    setIsLoading(true);

    try {
      const response = await axiosClient.post('/ai/chat', {
        message: userText,
        session_id: sessionId
      });

      const responseData = response.data?.data || response.data || response;

      if (!sessionId && responseData.session_id) {
        setSessionId(responseData.session_id);
        localStorage.setItem('ai_session_id', responseData.session_id);
      }

      setMessages(prev => [...prev, { sender: 'bot', text: responseData.reply }]);

      // KIỂM TRA ACTION TỪ AI ĐỂ MỞ POPUP XÁC NHẬN
      if (responseData.action === 'add_transaction' && responseData.action_data?.length > 0) {
          setPendingTxs(responseData.action_data);
          setIsConfirmModalOpen(true);
      }

    } catch (error) {
      console.error("Lỗi gọi AI:", error);
      setMessages(prev => [...prev, { sender: 'bot', text: 'Xin lỗi, kết nối đến AI đang bị gián đoạn. Vui lòng thử lại sau!' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearChat = () => {
    if (window.confirm("Bạn có chắc chắn muốn xóa phiên trò chuyện này và bắt đầu lại?")) {
      localStorage.removeItem('ai_session_id');
      setSessionId(null);
      setMessages([{
        id: 'welcome',
        sender: 'bot',
        text: 'Phiên trò chuyện đã được làm mới. Bạn cần mình giúp gì nào?'
      }]);
    }
  };

  // HÀM LƯU GIAO DỊCH SAU KHI USER BẤM XÁC NHẬN
  const handleConfirmTransactions = async () => {
      setIsSavingTx(true);
      try {
          // Lặp qua mảng pendingTxs do AI trả về để đẩy lên Backend
          for (const tx of pendingTxs) {
              await axiosClient.post('/transactions/', {
                  amount: tx.amount,
                  transaction_type: tx.transaction_type,
                  category_id: tx.category_id,
                  wallet_id: tx.wallet_id,
                  note: tx.note || 'AI tự động ghi nhận',
                  date: new Date().toISOString().split('T')[0]
              });
          }
          toast.success(`Đã lưu thành công ${pendingTxs.length} giao dịch!`);
          setIsConfirmModalOpen(false);
          setPendingTxs([]);

          // Thêm một tin nhắn báo thành công vào khung chat để UX mượt hơn
          setMessages(prev => [...prev, { sender: 'bot', text: '✅ Các giao dịch của bạn đã được lưu vào hệ thống an toàn.' }]);
      } catch (error) {
          toast.error("Lỗi khi lưu giao dịch: " + (error.response?.data?.detail || error.message));
      } finally {
          setIsSavingTx(false);
      }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20 lg:p-8 animate-fade-in flex flex-col h-screen lg:h-auto">
      <div className="max-w-4xl mx-auto w-full flex-1 bg-white lg:rounded-3xl lg:shadow-xl overflow-hidden border-x lg:border border-gray-100 flex flex-col">

        {/* Header */}
        <div className="bg-white px-6 py-4 flex items-center justify-between border-b shrink-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center">
              <Sparkles size={24} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 leading-tight">Trợ lý AI</h2>
              <p className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Đang hoạt động
              </p>
            </div>
          </div>
          <button onClick={handleClearChat} className="p-2 text-gray-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors">
            <Trash2 size={20} />
          </button>
        </div>

        {/* Khung hiển thị tin nhắn */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-6 bg-slate-50/50">
          {messages.map((msg, index) => {
            const isUser = msg.sender === 'user';
            return (
              <div key={index} className={`flex gap-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
                {!isUser && (
                  <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0 mt-1 shadow-sm">
                    <Bot size={18} />
                  </div>
                )}

                <div className={`max-w-[85%] lg:max-w-[75%] px-5 py-3.5 rounded-2xl ${
                  isUser ? 'bg-indigo-600 text-white rounded-tr-sm shadow-md' : 'bg-white text-slate-700 rounded-tl-sm shadow-sm border border-gray-100'
                }`}>
                  <p className="whitespace-pre-wrap leading-relaxed text-sm lg:text-base">
                    {formatMessage(msg.text)}
                  </p>
                </div>

                {isUser && (
                  <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center shrink-0 mt-1">
                    <User size={18} />
                  </div>
                )}
              </div>
            );
          })}
          {isLoading && (
            <div className="flex gap-4 justify-start animate-fade-in">
              <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0 mt-1 shadow-sm"><Bot size={18} /></div>
              <div className="bg-white px-5 py-4 rounded-2xl rounded-tl-sm shadow-sm border border-gray-100 flex items-center gap-2">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></span>
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Khu vực nhập tin nhắn */}
        <div className="p-4 bg-white border-t shrink-0">
          <form onSubmit={handleSendMessage} className="flex gap-3 max-w-4xl mx-auto relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Nhập câu lệnh (VD: Sáng nay ăn phở 50k bằng tiền mặt...)"
              disabled={isLoading || isSavingTx}
              className="flex-1 bg-gray-50 border border-gray-200 text-slate-800 text-sm lg:text-base rounded-2xl pl-5 pr-14 py-3.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all disabled:opacity-50"
            />
            <button type="submit" disabled={!input.trim() || isLoading || isSavingTx} className="absolute right-2 top-1.5 bottom-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:text-gray-500 text-white w-10 flex items-center justify-center rounded-xl transition-colors shadow-sm">
              {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} className="ml-1" />}
            </button>
          </form>
        </div>
      </div>

      {/* ========================================== */}
      {/* MODAL XÁC NHẬN LƯU GIAO DỊCH TỪ AI */}
      {/* ========================================== */}
      {isConfirmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-slide-up flex flex-col max-h-[85vh]">

            <div className="flex justify-between items-center p-5 lg:p-6 border-b border-gray-100 shrink-0">
              <h3 className="font-bold text-xl text-slate-800 flex items-center gap-2">
                 <Sparkles className="text-indigo-600" /> AI Đề xuất Giao dịch
              </h3>
              <button
                onClick={() => { setIsConfirmModalOpen(false); setPendingTxs([]); }}
                className="text-gray-400 hover:text-rose-500 transition-colors bg-gray-50 p-2 rounded-full"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5 lg:p-6 overflow-y-auto flex-1 bg-slate-50/50 space-y-3">
                {pendingTxs.map((tx, idx) => {
                    const walletName = wallets.find(w => w.wallet_id === tx.wallet_id)?.name || 'Ví mặc định';
                    const categoryObj = categories.find(c => c.category_id === tx.category_id);
                    const categoryName = categoryObj ? `${categoryObj.icon || '📌'} ${categoryObj.name}` : 'Chưa phân loại';
                    const isIncome = tx.transaction_type === 'income';

                    return (
                        <div key={idx} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center">
                            <div>
                                <p className="font-bold text-slate-800">{categoryName}</p>
                                <p className="text-xs text-gray-500 mt-1">{walletName} • {tx.note}</p>
                            </div>
                            <div className={`font-bold text-lg ${isIncome ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {isIncome ? '+' : '-'}{formatCurrency(tx.amount)}
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="p-5 lg:p-6 border-t border-gray-100 shrink-0 bg-white">
                <button
                    onClick={handleConfirmTransactions}
                    disabled={isSavingTx}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 rounded-xl font-bold transition-colors shadow-sm shadow-indigo-200 disabled:opacity-70 flex justify-center items-center gap-2"
                >
                    {isSavingTx ? <Loader2 className="animate-spin" size={20} /> : <><CheckCircle size={20} /> Lưu {pendingTxs.length} giao dịch</>}
                </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}