import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Mic, Send } from 'lucide-react';

export default function AIChat() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    { id: 1, text: 'Chào bạn! Mình là trợ lý IFinance. Mình có thể giúp gì cho tình hình tài chính của bạn?', sender: 'bot' }
  ]);
  const bottomRef = useRef(null);

  const handleSend = () => {
    if (!input.trim()) return;
    const newMsg = { id: Date.now(), text: input, sender: 'user' };
    setMessages(prev => [...prev, newMsg]);
    setInput('');
    setTimeout(() => {
      setMessages(prev => [...prev, { id: Date.now(), text: 'AI đang được tích hợp. Vui lòng thử lại sau.', sender: 'bot' }]);
    }, 1000);
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    // Wrapper PC
    <div className="flex flex-col h-screen lg:h-[calc(100vh-80px)] bg-gray-50 pb-20 lg:pb-0 lg:pt-6">

      {/* Khung Chat PC */}
      <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full bg-white lg:rounded-3xl lg:shadow-md lg:border border-gray-200 overflow-hidden relative">

        <div className="bg-white px-6 py-4 flex items-center gap-3 border-b shadow-sm z-10">
          <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center"><MessageSquare className="text-indigo-600" size={20} /></div>
          <div>
            <h2 className="font-semibold text-slate-800">Trợ lý IFinance</h2>
            <p className="text-xs text-green-500 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 block animate-pulse"></span> Trực tuyến</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-6 bg-gray-50/50">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] lg:max-w-[70%] rounded-2xl px-5 py-3.5 text-sm lg:text-base leading-relaxed ${msg.sender === 'user' ? 'bg-indigo-600 text-white rounded-br-none shadow-md shadow-indigo-200' : 'bg-white border border-gray-100 shadow-sm text-slate-800 rounded-bl-none'}`}>
                {msg.text}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Khung nhập liệu */}
        <div className="bg-white border-t p-4">
          <div className="max-w-3xl mx-auto flex items-center gap-2 bg-gray-100 rounded-full p-1.5 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:bg-white transition-all">
            <button className="p-2.5 text-gray-400 hover:text-indigo-600 transition-colors"><Mic size={22} /></button>
            <input
              type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Hỏi về chi tiêu, nợ, gợi ý..." className="flex-1 bg-transparent px-2 py-2 focus:outline-none text-sm lg:text-base"
            />
            <button onClick={handleSend} className="p-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full transition-transform active:scale-90"><Send size={18} /></button>
          </div>
        </div>
      </div>

    </div>
  );
}