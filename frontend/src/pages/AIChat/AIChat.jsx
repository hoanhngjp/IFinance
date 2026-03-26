import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, Loader2, Trash2, Sparkles } from 'lucide-react';
import axiosClient from '../../api/axiosClient';

// ==========================================
// HÀM FORMAT MARKDOWN CƠ BẢN CHO CHATBOT
// ==========================================
const formatMessage = (text) => {
  if (!text) return null;
  // Tách chuỗi dựa trên cặp dấu **...**
  const parts = text.split(/(\*\*.*?\*\*)/g);

  return parts.map((part, index) => {
    // Nếu đoạn text được bọc bởi **, cắt bỏ dấu sao và in đậm
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index} className="font-bold text-slate-800">{part.slice(2, -2)}</strong>;
    }
    // Trả về text thường
    return <span key={index}>{part}</span>;
  });
};

export default function AIChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState(localStorage.getItem('ai_session_id') || null);

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!sessionId) {
        setMessages([{
          id: 'welcome',
          sender: 'bot',
          text: 'Xin chào! Mình là Trợ lý tài chính IFinance. Bạn muốn hỏi gì về tình hình thu chi hay cần tư vấn tiết kiệm không?'
        }]);
        return;
      }

      try {
        const response = await axiosClient.get(`/ai/chat/${sessionId}`);
        // Xử lý bóc tách data an toàn
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

      // ==========================================
      // FIX LỖI MẤT SESSION ID TẠI ĐÂY
      // ==========================================
      const responseData = response.data?.data || response.data || response;

      // Lưu lại Session ID nếu là lần chat đầu tiên
      if (!sessionId && responseData.session_id) {
        setSessionId(responseData.session_id);
        localStorage.setItem('ai_session_id', responseData.session_id);
      }

      // Thêm tin nhắn phản hồi của Bot
      setMessages(prev => [...prev, { sender: 'bot', text: responseData.reply }]);

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

                {/* Áp dụng hàm formatMessage vào thẻ p */}
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
              placeholder="Nhập câu hỏi của bạn..."
              disabled={isLoading}
              className="flex-1 bg-gray-50 border border-gray-200 text-slate-800 text-sm lg:text-base rounded-2xl pl-5 pr-14 py-3.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all disabled:opacity-50"
            />
            <button type="submit" disabled={!input.trim() || isLoading} className="absolute right-2 top-1.5 bottom-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:text-gray-500 text-white w-10 flex items-center justify-center rounded-xl transition-colors shadow-sm">
              {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} className="ml-1" />}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}