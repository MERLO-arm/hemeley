import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, Bot, User, RotateCcw } from 'lucide-react';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

const FoodChatBot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [sessionId] = useState(() => `heme_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages, isTyping]);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      sendMessage('Bonjour');
    }
  }, [isOpen]);

  const getCustomer = () => {
    try {
      const stored = localStorage.getItem('hemeley_customer');
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  };

  const sendMessage = async (text) => {
    if (!text?.trim()) return;
    
    const userMsg = { role: 'user', content: text, time: new Date() };
    if (text !== 'Bonjour' || messages.length > 0) {
      setMessages(prev => [...prev, userMsg]);
    }
    setInputValue('');
    setIsTyping(true);

    try {
      const res = await axios.post(`${API}/chatbot/chat`, {
        message: text,
        session_id: sessionId,
        customer: getCustomer()
      });
      setMessages(prev => [...prev, { role: 'assistant', content: res.data.response, time: new Date() }]);
    } catch (error) {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: "Un petit souci de connexion ! Explorez nos menus directement sur la page d'accueil. 🍽️",
        time: new Date()
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage(inputValue);
  };

  const resetChat = async () => {
    try {
      await axios.post(`${API}/chatbot/chat/reset`, { session_id: sessionId });
    } catch {}
    setMessages([]);
    sendMessage('Bonjour');
  };

  const quickActions = [
    { label: 'Recommandations', msg: 'Quelles sont tes recommandations du chef ?' },
    { label: 'Promotions', msg: 'Quels plats sont en promotion ?' },
    { label: 'Quartiers', msg: 'Quels quartiers livrez-vous ?' }
  ];

  return (
    <>
      {/* FAB */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          data-testid="chatbot-fab"
          aria-label="Ouvrir l'assistant HEME"
          className="fixed bottom-6 right-6 w-16 h-16 bg-gradient-to-br from-orange-500 to-amber-500 text-white rounded-2xl shadow-xl flex items-center justify-center hover:scale-110 transition-transform z-50 group"
        >
          <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-white animate-pulse" />
          <span className="font-extrabold text-2xl tracking-tighter">H</span>
          <span className="absolute -bottom-9 right-0 bg-slate-900 text-white text-[10px] px-2.5 py-1 rounded-full opacity-0 group-hover:opacity-100 transition whitespace-nowrap">
            HEME · Assistant IA
          </span>
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-4 right-4 w-[360px] max-w-[calc(100vw-2rem)] h-[520px] bg-white rounded-2xl shadow-2xl flex flex-col z-50 border border-gray-100 overflow-hidden" data-testid="chatbot-window">
          {/* Header */}
          <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center">
                <Bot size={18} className="text-white" />
              </div>
              <div>
                <p className="text-white font-bold text-sm">HEME</p>
                <p className="text-orange-100 text-xs">Assistant culinaire</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={resetChat} className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-full" data-testid="chatbot-reset">
                <RotateCcw size={16} />
              </button>
              <button onClick={() => setIsOpen(false)} className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-full" data-testid="chatbot-close">
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50" data-testid="chatbot-messages">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-3.5 py-2.5 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-orange-500 text-white rounded-2xl rounded-br-md'
                    : 'bg-white text-gray-800 rounded-2xl rounded-bl-md shadow-sm border border-gray-100'
                }`}>
                  <p className="whitespace-pre-line">{msg.content}</p>
                </div>
              </div>
            ))}
            
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-white px-4 py-3 rounded-2xl rounded-bl-md shadow-sm border border-gray-100">
                  <div className="flex gap-1.5">
                    <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
                    <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
                    <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick actions */}
          {messages.length <= 2 && (
            <div className="px-3 py-2 flex gap-2 overflow-x-auto bg-white border-t border-gray-100">
              {quickActions.map((action, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(action.msg)}
                  className="flex-shrink-0 px-3 py-1.5 bg-orange-50 text-orange-600 rounded-full text-xs font-medium hover:bg-orange-100 transition-colors"
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <form onSubmit={handleSubmit} className="p-3 bg-white border-t border-gray-100 flex gap-2" data-testid="chatbot-form">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Écrivez à HEME..."
              data-testid="chatbot-input"
              className="flex-1 px-4 py-2.5 bg-gray-100 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-orange-200"
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || isTyping}
              data-testid="chatbot-send"
              className="w-10 h-10 bg-orange-500 text-white rounded-full flex items-center justify-center disabled:opacity-40 hover:bg-orange-600 transition-colors"
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      )}
    </>
  );
};

export default FoodChatBot;
