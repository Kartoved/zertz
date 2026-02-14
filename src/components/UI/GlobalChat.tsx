import { useState, useRef, useEffect } from 'react';
import { useI18n } from '../../i18n';
import { useAuthStore } from '../../store/authStore';

interface ChatMessage {
  id: string;
  username: string;
  message: string;
  timestamp: number;
}

export default function GlobalChat() {
  const { t, locale } = useI18n();
  const { user } = useAuthStore();
  const [text, setText] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!text.trim()) return;
    const msg: ChatMessage = {
      id: Date.now().toString(),
      username: user?.username || t.guest,
      message: text.trim(),
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, msg]);
    setText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (timestamp: number) => {
    const d = new Date(timestamp);
    return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800 rounded-2xl shadow-md overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h3 className="font-bold text-gray-800 dark:text-gray-200 text-sm uppercase tracking-wide">
          {t.globalChat}
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        {messages.length === 0 ? (
          <p className="text-gray-400 dark:text-gray-500 text-sm text-center py-8">
            {t.noMessagesYet}
          </p>
        ) : (
          messages.map((msg) => {
            const isMe = msg.username === (user?.username || t.guest);
            return (
              <div key={msg.id} className="flex items-start gap-2">
                <div className="w-7 h-7 rounded-full bg-teal-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  {msg.username.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold ${isMe ? 'text-teal-600 dark:text-teal-400' : 'text-gray-700 dark:text-gray-300'}`}>
                      {msg.username}
                    </span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {formatTime(msg.timestamp)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-800 dark:text-gray-200 break-words">
                    {msg.message}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-3 border-t border-gray-200 dark:border-gray-700">
        <div className="flex gap-2">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t.messagePlaceholder}
            className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg
                       bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200
                       focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          <button
            onClick={handleSend}
            disabled={!text.trim()}
            className="px-4 py-2 bg-teal-500 text-white rounded-lg text-sm font-bold
                       hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed
                       transition-colors uppercase tracking-wide"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
