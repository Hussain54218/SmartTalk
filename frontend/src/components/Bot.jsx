import React, { useState, useRef, useEffect } from "react";
import axios from "axios";

function Bot() {
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [messages, setMessages] = useState({});
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const messagesEndRef = useRef(null);

  // بارگذاری داده‌ها از Local Storage
  useEffect(() => {
    const savedChats = localStorage.getItem('deepseek_chats');
    const savedMessages = localStorage.getItem('deepseek_messages');
    const savedActiveChat = localStorage.getItem('deepseek_activeChat');

    if (savedChats) setChats(JSON.parse(savedChats));
    if (savedMessages) setMessages(JSON.parse(savedMessages));
    if (savedActiveChat) setActiveChatId(JSON.parse(savedActiveChat));
  }, []);

  // ذخیره‌سازی در Local Storage
  useEffect(() => {
    localStorage.setItem('deepseek_chats', JSON.stringify(chats));
  }, [chats]);

  useEffect(() => {
    localStorage.setItem('deepseek_messages', JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    localStorage.setItem('deepseek_activeChat', JSON.stringify(activeChatId));
  }, [activeChatId]);

  // اسکرول خودکار
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeChatId]);

  // گروه‌بندی چت‌ها بر اساس تاریخ
  const groupChatsByDate = () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);

    const todayChats = [];
    const yesterdayChats = [];
    const lastWeekChats = [];
    const olderChats = [];

    chats.forEach(chat => {
      const chatDate = new Date(chat.timestamp);
      
      if (chatDate.toDateString() === today.toDateString()) {
        todayChats.push(chat);
      } else if (chatDate.toDateString() === yesterday.toDateString()) {
        yesterdayChats.push(chat);
      } else if (chatDate > lastWeek) {
        lastWeekChats.push(chat);
      } else {
        olderChats.push(chat);
      }
    });

    return { todayChats, yesterdayChats, lastWeekChats, olderChats };
  };

  // فیلتر چت‌ها بر اساس جستجو
  const filteredChats = chats.filter(chat => 
    chat.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    chat.lastMessage?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const { todayChats, yesterdayChats, lastWeekChats, olderChats } = groupChatsByDate();

  // شروع چت جدید
  const handleNewChat = () => {
    const newChat = {
      id: Date.now(),
      title: "چت جدید",
      timestamp: new Date(),
      lastMessage: ""
    };
    
    setChats(prev => [newChat, ...prev]);
    setMessages(prev => ({ ...prev, [newChat.id]: [] }));
    setActiveChatId(newChat.id);
    setSearchTerm("");
    
    if (window.innerWidth < 768) setSidebarOpen(false);
  };

  // انتخاب چت
  const handleSelectChat = (chatId) => {
    setActiveChatId(chatId);
    if (window.innerWidth < 768) setSidebarOpen(false);
  };

  // ارسال پیام
  const handleSendMessage = async () => {
    if (!input.trim() || loading || !activeChatId) return;

    const userMessage = { 
      text: input, 
      sender: "user", 
      timestamp: new Date(),
      id: Date.now()
    };
    
    const currentMessages = messages[activeChatId] || [];
    const updatedMessages = [...currentMessages, userMessage];
    
    setMessages(prev => ({
      ...prev,
      [activeChatId]: updatedMessages
    }));
    
    // آپدیت عنوان و آخرین پیام
    if (currentMessages.length === 0) {
      const newTitle = input.slice(0, 40) + (input.length > 40 ? "..." : "");
      setChats(prev => prev.map(chat => 
        chat.id === activeChatId 
          ? { ...chat, title: newTitle, lastMessage: input }
          : chat
      ));
    } else {
      setChats(prev => prev.map(chat => 
        chat.id === activeChatId 
          ? { ...chat, lastMessage: input }
          : chat
      ));
    }
    
    setInput("");
    setLoading(true);

    try {
      const response = await axios.post("http://localhost:3000/bot/v1/message", { 
        text: input 
      });
      
      if (response.status === 200 && response.data) {
        const botMessage = { 
          text: response.data.botMessage, 
          sender: "bot", 
          timestamp: new Date(),
          id: Date.now() + 1
        };
        
        setMessages(prev => ({
          ...prev,
          [activeChatId]: [...prev[activeChatId], botMessage]
        }));
      }
    } catch (error) {
      const errorMessage = { 
        text: "خطا در اتصال به سرور. لطفا دوباره تلاش کنید.", 
        sender: "bot", 
        timestamp: new Date(),
        isError: true,
        id: Date.now() + 1
      };
      
      setMessages(prev => ({
        ...prev,
        [activeChatId]: [...prev[activeChatId], errorMessage]
      }));
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // پاک کردن تمام داده‌ها
  const clearAllData = () => {
    if (window.confirm("آیا از پاک کردن تمام چت‌ها مطمئن هستید؟ این عمل قابل بازگشت نیست.")) {
      localStorage.removeItem('deepseek_chats');
      localStorage.removeItem('deepseek_messages');
      localStorage.removeItem('deepseek_activeChat');
      setChats([]);
      setMessages({});
      setActiveChatId(null);
    }
  };

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString('fa-IR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('fa-IR');
  };

  const deleteChat = (chatId, e) => {
    e.stopPropagation();
    
    setChats(prev => prev.filter(chat => chat.id !== chatId));
    setMessages(prev => {
      const newMessages = { ...prev };
      delete newMessages[chatId];
      return newMessages;
    });
    
    if (activeChatId === chatId) {
      const remainingChats = chats.filter(chat => chat.id !== chatId);
      setActiveChatId(remainingChats.length > 0 ? remainingChats[0].id : null);
    }
  };

  const activeMessages = activeChatId ? messages[activeChatId] || [] : [];

  const renderChatSection = (chats, title) => {
    if (chats.length === 0) return null;

    return (
      <div className="mb-6">
        <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-3 px-4 uppercase tracking-wide">
          {title}
        </h3>
        <div className="space-y-1">
          {chats.map(chat => (
            <div
              key={chat.id}
              onClick={() => handleSelectChat(chat.id)}
              className={`px-4 py-3 cursor-pointer transition-all duration-200 group relative ${
                activeChatId === chat.id 
                  ? 'bg-blue-50 dark:bg-blue-900/20 border-r-2 border-r-blue-500' 
                  : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-900 dark:text-white text-sm truncate">
                    {chat.title}
                  </h3>
                  {chat.lastMessage && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-1 leading-relaxed">
                      {chat.lastMessage}
                    </p>
                  )}
                </div>
                <button
                  onClick={(e) => deleteChat(chat.id, e)}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-all duration-200 ml-2"
                >
                  <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-80 translate-x-0' : '-translate-x-full'} fixed md:relative z-30 transition-all duration-300 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col h-full overflow-hidden`}>
        {/* Header Sidebar */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">
              Esmart Talk
            </h1>
          </div>
          
          <button
            onClick={handleNewChat}
            className="w-full bg-black dark:bg-white text-white dark:text-black py-2.5 px-4 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 border border-gray-300 dark:border-gray-600 hover:bg-gray-800 dark:hover:bg-gray-200"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New chat
          </button>

          {/* Search Box */}
          <div className="mt-4 relative">
            <input
              type="text"
              placeholder="Search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg py-2 px-3 pl-9 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-500"
            />
            <svg className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto py-4">
          {searchTerm ? (
            // نمایش نتایج جستجو
            <div className="space-y-1">
              {filteredChats.map(chat => (
                <div
                  key={chat.id}
                  onClick={() => handleSelectChat(chat.id)}
                  className={`px-4 py-3 cursor-pointer transition-all duration-200 group ${
                    activeChatId === chat.id 
                      ? 'bg-blue-50 dark:bg-blue-900/20 border-r-2 border-r-blue-500' 
                      : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 dark:text-white text-sm truncate">
                        {chat.title}
                      </h3>
                      {chat.lastMessage && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-1">
                          {chat.lastMessage}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // نمایش گروه‌بندی شده چت‌ها
            <div className="px-2">
              {renderChatSection(todayChats, "Today")}
              {renderChatSection(yesterdayChats, "Yesterday")}
              {renderChatSection(lastWeekChats, "Previous 7 Days")}
              {renderChatSection(olderChats, "Older")}
            </div>
          )}

          {chats.length === 0 && !searchTerm && (
            <div className="text-center p-8 text-gray-500 dark:text-gray-400">
              <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p className="text-sm">No chats yet</p>
              <p className="text-xs mt-1">Start a new conversation</p>
            </div>
          )}
        </div>

        {/* Footer Sidebar */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>DeepThink</span>
            <button 
              onClick={clearAllData}
              className="hover:text-red-500 transition-colors"
            >
              Clear All
            </button>
          </div>
        </div>
      </div>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors md:hidden"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            {activeChatId && (
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                {chats.find(chat => chat.id === activeChatId)?.title}
              </h1>
            )}
          </div>
          
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            Online
          </div>
        </header>

        {/* Messages Area */}
        <main className="flex-1 overflow-y-auto bg-white dark:bg-gray-800">
          {!activeChatId ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <div className="w-20 h-20 bg-black dark:bg-white rounded-full flex items-center justify-center mb-6">
                <span className="text-2xl text-white dark:text-black">🤖</span>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                
                سمارت تاک              </h2>
              <p className="text-gray-600 dark:text-gray-400 max-w-md mb-8">
                Start a conversation with your AI assistant
              </p>
              <button
                onClick={handleNewChat}
                className="bg-black dark:bg-white text-white dark:text-black py-3 px-6 rounded-lg font-medium transition-all duration-200 hover:bg-gray-800 dark:hover:bg-gray-200 border border-gray-300 dark:border-gray-600"
              >
                Start New Chat
              </button>
            </div>
          ) : activeMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
                <span className="text-xl">💬</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                New Conversation
              </h3>
              <p className="text-gray-600 dark:text-gray-400 max-w-sm text-sm">
                Type your message to start the conversation...
              </p>
            </div>
          ) : (
            <div className="p-6 space-y-6 max-w-4xl mx-auto">
              {activeMessages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-2xl ${msg.sender === "user" ? "ml-auto" : "mr-auto"}`}>
                    <div className={`flex items-start gap-3 ${msg.sender === "user" ? "flex-row-reverse" : "flex-row"}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                        msg.sender === "user" 
                          ? "bg-black text-white" 
                          : "bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white"
                      }`}>
                        {msg.sender === "user" ? "👤" : "🤖"}
                      </div>
                      <div className={`px-4 py-3 rounded-2xl break-words ${
                        msg.sender === "user" 
                          ? "bg-black text-white rounded-br-none" 
                          : msg.isError 
                            ? "bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-200 rounded-bl-none" 
                            : "bg-gray-100 dark:bg-gray-700 rounded-bl-none"
                      }`}>
                        <div className="whitespace-pre-wrap leading-relaxed text-sm">
                          {msg.text}
                        </div>
                      </div>
                    </div>
                    <div className={`text-xs text-gray-500 dark:text-gray-400 mt-2 ${msg.sender === "user" ? "text-right" : "text-left"}`}>
                      {formatTime(msg.timestamp)}
                    </div>
                  </div>
                </div>
              ))}
              
              {/* Loading Indicator */}
              {loading && (
                <div className="flex justify-start">
                  <div className="flex items-start gap-3 max-w-2xl">
                    <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-sm">
                      🤖
                    </div>
                    <div className="bg-gray-100 dark:bg-gray-700 px-4 py-3 rounded-2xl rounded-bl-none flex items-center gap-2">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                      </div>
                      <span className="text-gray-600 dark:text-gray-400 text-sm">Thinking...</span>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          )}
        </main>

        {/* Input Area */}
        <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-end gap-3">
              <div className="flex-1 relative">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={activeChatId ? "Message Esmat Talk..." : "Please create a new chat first"}
                  disabled={loading || !activeChatId}
                  rows="1"
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-500 resize-none transition-all duration-200 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white disabled:opacity-50 text-sm"
                  style={{ minHeight: '48px', maxHeight: '120px' }}
                />
              </div>
              <button
                onClick={handleSendMessage}
                disabled={loading || !input.trim() || !activeChatId}
                className="bg-black dark:bg-white text-white dark:text-black p-3 rounded-lg transition-all duration-200 hover:bg-gray-800 dark:hover:bg-gray-200 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed min-w-[48px] h-12 flex items-center justify-center border border-gray-300 dark:border-gray-600"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                )}
              </button>
            </div>
            <div className="text-center mt-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                
                 
                 Esmat Talk can make mistakes. Consider checking important information.
              </p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default Bot;