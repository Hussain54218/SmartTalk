import React, { useState, useRef, useEffect } from "react";
import { Light as SyntaxHighlighter } from "react-syntax-highlighter";
import { vs2015 } from "react-syntax-highlighter/dist/esm/styles/hljs";

function Bot() {
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [messages, setMessages] = useState({});
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Load from localStorage once
  useEffect(() => {
    const savedChats = localStorage.getItem("esmart_chats");
    const savedMessages = localStorage.getItem("esmart_messages");
    const savedActiveChat = localStorage.getItem("esmart_activeChat");
    
    if (savedChats) {
      try {
        const parsedChats = JSON.parse(savedChats);
        setChats(Array.isArray(parsedChats) ? parsedChats : []);
      } catch (error) {
        console.error("Error parsing saved chats:", error);
        setChats([]);
      }
    }
    
    if (savedMessages) {
      try {
        const parsedMessages = JSON.parse(savedMessages);
        setMessages(typeof parsedMessages === 'object' ? parsedMessages : {});
      } catch (error) {
        console.error("Error parsing saved messages:", error);
        setMessages({});
      }
    }
    
    if (savedActiveChat) {
      try {
        const parsedActiveChat = JSON.parse(savedActiveChat);
        setActiveChatId(parsedActiveChat);
      } catch (error) {
        console.error("Error parsing saved active chat:", error);
        setActiveChatId(null);
      }
    }
  }, []);

  // Save to localStorage on update
  useEffect(() => {
    localStorage.setItem("esmart_chats", JSON.stringify(chats));
  }, [chats]);
  
  useEffect(() => {
    localStorage.setItem("esmart_messages", JSON.stringify(messages));
  }, [messages]);
  
  useEffect(() => {
    localStorage.setItem("esmart_activeChat", JSON.stringify(activeChatId));
  }, [activeChatId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeChatId]);

  const handleNewChat = () => {
    const newChatId = Date.now();
    const newChat = { 
      id: newChatId, 
      title: "New Chat", 
      lastMessage: "",
      createdAt: new Date().toISOString()
    };
    
    setChats(prev => [newChat, ...prev]);
    setMessages(prev => ({ ...prev, [newChatId]: [] }));
    setActiveChatId(newChatId);
  };

  const updateChatTitle = (chatId, newTitle) => {
    setChats(prev => prev.map(chat => 
      chat.id === chatId ? { ...chat, title: newTitle } : chat
    ));
  };

  const handleSendMessage = async () => {
    if (!input.trim() || loading || !activeChatId) return;

    const userMessage = { 
      text: input, 
      sender: "user", 
      id: Date.now(),
      timestamp: new Date().toISOString()
    };
    
    const updatedMessages = [...(messages[activeChatId] || []), userMessage];
    setMessages(prev => ({ ...prev, [activeChatId]: updatedMessages }));
    setInput("");
    setLoading(true);

    // Update chat title if it's the first message
    if (updatedMessages.length === 1) {
      const firstMessageText = input.length > 30 ? input.substring(0, 30) + "..." : input;
      updateChatTitle(activeChatId, firstMessageText);
    }

    // Update last message in chat
    setChats(prev => prev.map(chat => 
      chat.id === activeChatId ? { ...chat, lastMessage: input } : chat
    ));

    const botMessageId = Date.now() + 1;
    setMessages(prev => ({
      ...prev,
      [activeChatId]: [...updatedMessages, { 
        text: "", 
        sender: "bot", 
        id: botMessageId, 
        isStreaming: true,
        timestamp: new Date().toISOString()
      }]
    }));

    try {
      const response = await fetch(
        `http://localhost:3000/bot/v1/message/stream?${new URLSearchParams({ text: userMessage.text })}`
      );
      if (!response.ok) throw new Error("Stream failed");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let fullText = "";

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        const chunk = decoder.decode(value || new Uint8Array(), { stream: true });
        const lines = chunk.split("\n").filter(line => line.trim());

        lines.forEach(line => {
          if (!line.startsWith("data:")) return;
          const dataStr = line.replace(/^data:\s*/, '');
          if (!dataStr || dataStr === "[DONE]") return;

          try {
            const data = JSON.parse(dataStr);
            if (data.type === "token") {
              fullText += data.token;
              setMessages(prev => {
                const msgs = [...prev[activeChatId]];
                const botIndex = msgs.findIndex(m => m.id === botMessageId);
                if (botIndex !== -1) msgs[botIndex].text = fullText;
                return { ...prev, [activeChatId]: msgs };
              });
            }
          } catch {}
        });
      }

      setMessages(prev => {
        const msgs = [...prev[activeChatId]];
        const botIndex = msgs.findIndex(m => m.id === botMessageId);
        if (botIndex !== -1) {
          msgs[botIndex].text = fullText;
          delete msgs[botIndex].isStreaming;
        }
        return { ...prev, [activeChatId]: msgs };
      });
      setLoading(false);

    } catch (err) {
      console.error("Stream error:", err);
      setMessages(prev => {
        const msgs = [...prev[activeChatId]];
        const botIndex = msgs.findIndex(m => m.id === botMessageId);
        if (botIndex !== -1) {
          msgs[botIndex].text = "Error: Unable to fetch response.";
          delete msgs[botIndex].isStreaming;
        }
        return { ...prev, [activeChatId]: msgs };
      });
      setLoading(false);
    }
  };

  const handleKeyDown = e => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  };

  const activeMessages = activeChatId ? messages[activeChatId] || [] : [];

  return (
    <div className="flex h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 text-gray-900 dark:text-white transition-colors duration-300">
      {/* Sidebar */}
      <div className="w-80 bg-white/90 dark:bg-gray-800/90 backdrop-blur-md border-r border-gray-200/50 dark:border-gray-700/50 flex flex-col shadow-xl transition-all duration-300">
        <div className="p-6 border-b border-gray-200/50 dark:border-gray-700/50">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-lg">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Esmart Talk
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">AI Assistant</p>
            </div>
          </div>
          <button
            onClick={handleNewChat}
            className="w-full mt-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-0.5 flex items-center justify-center gap-2 group"
          >
            <svg className="w-5 h-5 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Chat
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {chats.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-blue-100 to-purple-100 dark:from-gray-700 dark:to-gray-600 flex items-center justify-center">
                <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              <p className="text-gray-500 dark:text-gray-400 text-sm">No chats yet</p>
              <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">Start a new conversation</p>
            </div>
          ) : (
            chats.map(chat => (
              <div
                key={chat.id}
                onClick={() => setActiveChatId(chat.id)}
                className={`p-4 cursor-pointer rounded-xl transition-all duration-300 transform hover:scale-[1.02] border ${
                  chat.id === activeChatId
                    ? "bg-gradient-to-r from-blue-50 to-purple-50 dark:from-gray-700 dark:to-gray-600 border-blue-200 dark:border-blue-500/30 shadow-lg"
                    : "bg-white/70 dark:bg-gray-700/70 hover:bg-white/90 dark:hover:bg-gray-700/90 border-gray-200/50 dark:border-gray-600/50"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                    chat.id === activeChatId ? "bg-blue-500 animate-pulse" : "bg-gray-400"
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-gray-800 dark:text-white text-sm truncate">
                        {chat.title}
                      </h3>
                      <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0 ml-2">
                        {chat.createdAt ? formatTime(chat.createdAt) : ''}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-1">
                      {chat.lastMessage || "Start a conversation..."}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        
        <div className="p-4 border-t border-gray-200/50 dark:border-gray-700/50">
          <div className="text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {chats.length} chat{chats.length !== 1 ? 's' : ''} • Saved locally
            </p>
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        <main className="flex-1 overflow-y-auto p-6 space-y-6 bg-gradient-to-b from-white/50 to-gray-50/50 dark:from-gray-800/50 dark:to-gray-900/50">
          {!activeChatId ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center max-w-md mx-auto">
                <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-r from-blue-100 to-purple-100 dark:from-gray-700 dark:to-gray-600 flex items-center justify-center shadow-lg">
                  <svg className="w-12 h-12 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                </div>
                <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
                  Welcome to Esmart Talk
                </h2>
                <p className="text-gray-600 dark:text-gray-300 mb-2 leading-relaxed">
                  Your intelligent AI assistant ready to help with code, questions, and creative tasks.
                </p>
                <p className="text-gray-500 dark:text-gray-400 text-sm mb-8">
                  All your conversations are automatically saved and secured locally.
                </p>
                <button
                  onClick={handleNewChat}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-4 rounded-2xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
                >
                  Start Your First Chat
                </button>
              </div>
            </div>
          ) : (
            <>
              {activeMessages.map(msg => (
                <div key={msg.id} className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"} group`}>
                  {msg.sender === "user" ? (
                    <div className="max-w-[85%]">
                      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 rounded-2xl rounded-tr-md shadow-lg hover:shadow-xl transition-all duration-300">
                        <div className="text-sm leading-relaxed font-medium" style={{ whiteSpace: "pre-wrap" }}>
                          {msg.text}
                        </div>
                      </div>
                      <div className="flex justify-end mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <span className="text-xs text-gray-500 dark:text-gray-400 px-2 bg-white/80 dark:bg-gray-800/80 rounded-full py-1">
                          You • {formatTime(msg.timestamp)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="max-w-[85%]">
                      <div className="bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 p-4 rounded-2xl rounded-tl-md shadow-lg hover:shadow-xl transition-all duration-300">
                        <div className="flex items-start gap-3">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-r from-green-400 to-blue-500 flex items-center justify-center flex-shrink-0 shadow-md">
                            <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            {msg.text ? (
                              <div className="prose prose-sm max-w-none dark:prose-invert">
                                <SyntaxHighlighter
                                  language="javascript"
                                  style={vs2015}
                                  customStyle={{ 
                                    margin: 0, 
                                    background: "transparent",
                                    fontSize: "0.875rem",
                                    lineHeight: "1.6",
                                    borderRadius: "8px",
                                    padding: "0"
                                  }}
                                  wrapLongLines={true}
                                  showLineNumbers={false}
                                  codeTagProps={{
                                    style: {
                                      fontFamily: "'Fira Code', 'Monaco', 'Cascadia Code', monospace",
                                      fontWeight: "400"
                                    }
                                  }}
                                >
                                  {msg.text}
                                </SyntaxHighlighter>
                              </div>
                            ) : (
                              <div className="flex items-center space-x-2 text-gray-500 dark:text-gray-400">
                                <div className="flex space-x-1">
                                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }}></div>
                                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                                </div>
                                <span className="text-sm">Thinking...</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <span className="text-xs text-gray-500 dark:text-gray-400 px-2 bg-white/80 dark:bg-gray-800/80 rounded-full py-1">
                          Assistant • {formatTime(msg.timestamp)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              
              {loading && (
                <div className="flex justify-start">
                  <div className="max-w-[85%]">
                    <div className="bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 p-4 rounded-2xl rounded-tl-md shadow-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-r from-green-400 to-blue-500 flex items-center justify-center flex-shrink-0 shadow-md">
                          <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div className="flex items-center space-x-3">
                          <div className="flex space-x-1">
                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }}></div>
                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                          </div>
                          <span className="text-sm text-gray-600 dark:text-gray-300">Generating response...</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </main>

        <footer className="p-6 border-t border-gray-200/50 dark:border-gray-700/50 bg-white/70 dark:bg-gray-800/70 backdrop-blur-md">
          <div className="flex gap-3 max-w-4xl mx-auto">
            <div className="flex-1 relative">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows="1"
                placeholder={activeChatId ? "Type your message... (Press Enter to send)" : "Select or create a chat to start messaging..."}
                disabled={!activeChatId}
                className="w-full border border-gray-300/50 dark:border-gray-600/50 rounded-2xl p-4 pr-14 text-sm bg-white/90 dark:bg-gray-800/90 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 resize-none shadow-lg focus:shadow-xl focus:border-blue-500/50 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                style={{ 
                  minHeight: "60px", 
                  maxHeight: "120px",
                  lineHeight: "1.5"
                }}
              />
              <button
                onClick={handleSendMessage}
                disabled={loading || !input.trim() || !activeChatId}
                className="absolute right-3 bottom-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 text-white p-2.5 rounded-xl transition-all duration-300 transform hover:scale-110 disabled:scale-100 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
          <div className="text-center mt-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Esmart Talk • Powered by AI • Your data is stored locally
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default Bot;