import React, { useState, useRef, useEffect } from "react";

function Bot() {
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [messages, setMessages] = useState({});
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Load saved chats & messages
  useEffect(() => {
    const savedChats = localStorage.getItem("esmart_chats");
    const savedMessages = localStorage.getItem("esmart_messages");
    const savedActiveChat = localStorage.getItem("esmart_activeChat");
    if (savedChats) setChats(JSON.parse(savedChats));
    if (savedMessages) setMessages(JSON.parse(savedMessages));
    if (savedActiveChat) setActiveChatId(JSON.parse(savedActiveChat));
  }, []);

  useEffect(() => localStorage.setItem("esmart_chats", JSON.stringify(chats)), [chats]);
  useEffect(() => localStorage.setItem("esmart_messages", JSON.stringify(messages)), [messages]);
  useEffect(() => localStorage.setItem("esmart_activeChat", JSON.stringify(activeChatId)), [activeChatId]);

  useEffect(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), [messages, activeChatId]);

  const handleNewChat = () => {
    const newChat = { id: Date.now(), title: "New Chat", lastMessage: "" };
    setChats(prev => [newChat, ...prev]);
    setMessages(prev => ({ ...prev, [newChat.id]: [] }));
    setActiveChatId(newChat.id);
  };

  const handleSendMessage = async () => {
    if (!input.trim() || loading || !activeChatId) return;

    const userMessage = { text: input, sender: "user", id: Date.now() };
    const updatedMessages = [...(messages[activeChatId] || []), userMessage];
    setMessages(prev => ({ ...prev, [activeChatId]: updatedMessages }));
    setInput("");
    setLoading(true);

    const botMessageId = Date.now() + 1;
    setMessages(prev => ({
      ...prev,
      [activeChatId]: [...updatedMessages, { text: "", sender: "bot", id: botMessageId, isStreaming: true }]
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
                if (botIndex !== -1) {
                  msgs[botIndex].text = fullText;
                }
                return { ...prev, [activeChatId]: msgs };
              });
            }
          } catch (err) {
            // Ignore JSON parse errors for incomplete chunks
          }
        });
      }

      // Final save
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

  const activeMessages = activeChatId ? messages[activeChatId] || [] : [];

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white">
      {/* Sidebar */}
      <div className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h1 className="text-lg font-bold">Esmart Talk</h1>
          <button
            onClick={handleNewChat}
            className="w-full mt-3 py-2 bg-black dark:bg-white text-white dark:text-black rounded-lg"
          >
            + New Chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {chats.map(chat => (
            <div
              key={chat.id}
              onClick={() => setActiveChatId(chat.id)}
              className={`px-3 py-2 cursor-pointer rounded ${
                chat.id === activeChatId
                  ? "bg-gray-200 dark:bg-gray-700"
                  : "hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              <h3 className="font-medium text-sm">{chat.title}</h3>
              <p className="text-xs text-gray-500 truncate">{chat.lastMessage}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        <main className="flex-1 overflow-y-auto p-6 space-y-4">
          {!activeChatId && <div className="text-center text-gray-500">Start a new chat</div>}
          {activeMessages.map(msg => (
            <div key={msg.id} className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`p-3 rounded-2xl text-sm ${
                  msg.sender === "user"
                    ? "bg-black text-white"
                    : "bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white"
                }`}
                style={{ whiteSpace: "pre-wrap" }}
              >
                {msg.text || (msg.isStreaming && "▌")}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </main>

        <footer className="p-4 border-t border-gray-200 dark:border-gray-700 flex gap-2">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows="1"
            placeholder="Type your message..."
            disabled={!activeChatId}
            className="flex-1 border rounded-lg p-2 text-sm bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white"
          />
          <button
            onClick={handleSendMessage}
            disabled={loading || !input.trim() || !activeChatId}
            className="bg-black dark:bg-white text-white dark:text-black px-4 py-2 rounded-lg"
          >
            {loading ? "..." : "Send"}
          </button>
        </footer>
      </div>
    </div>
  );
}

export default Bot;
