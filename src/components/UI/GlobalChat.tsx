import { useState, useRef, useEffect } from 'react';
import { useI18n } from '../../i18n';
import { useAuthStore } from '../../store/authStore';
import { getGlobalChatMessages, sendGlobalChatMessage, GlobalChatMessage } from '../../db/globalChatApi';
import PlayerProfileModal from '../Auth/PlayerProfileModal';

const MAX_STORED_MESSAGES = 200;

export default function GlobalChat() {
  const { t, locale } = useI18n();
  const { user } = useAuthStore();
  const isAuthed = !!user;
  const [text, setText] = useState('');
  const [messages, setMessages] = useState<GlobalChatMessage[]>([]);
  const [lastMessageId, setLastMessageId] = useState(0);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    const loadInitial = async () => {
      try {
        const initial = await getGlobalChatMessages();
        if (!cancelled && Array.isArray(initial)) {
          const trimmed = initial.slice(-MAX_STORED_MESSAGES);
          setMessages(trimmed);
          setLastMessageId(trimmed.length > 0 ? trimmed[trimmed.length - 1].id : 0);
        }
      } catch {
        // ignore initial load errors
      }
    };

    loadInitial();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const fresh = await getGlobalChatMessages(lastMessageId || undefined);
        if (fresh.length > 0) {
          setMessages((prev) => [...prev, ...fresh].slice(-MAX_STORED_MESSAGES));
          setLastMessageId(fresh[fresh.length - 1].id);
        }
      } catch {
        // ignore polling errors
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [lastMessageId]);

  useEffect(() => {
    const container = messagesEndRef.current?.parentElement;
    if (container) container.scrollTop = container.scrollHeight;
  }, [messages]);

  const handleSend = () => {
    if (!isAuthed || !text.trim()) return;
    const payload = text.trim();
    sendGlobalChatMessage(payload)
      .then((msg) => {
        setMessages((prev) => [...prev, msg].slice(-MAX_STORED_MESSAGES));
        setLastMessageId(msg.id);
        setText('');
      })
      .catch(() => {
        // ignore send errors
      });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (createdAt: number) => {
    const d = new Date(createdAt);
    return d.toLocaleString(locale, { 
      day: '2-digit', 
      month: '2-digit', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <>
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
            const isMe = msg.username === user?.username;
            return (
              <div key={msg.id} className="flex items-start gap-2">
                <div className="w-7 h-7 rounded-full bg-teal-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  {msg.username.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedUserId(msg.userId)}
                      className={`text-xs font-semibold hover:underline ${isMe ? 'text-teal-600 dark:text-teal-400' : 'text-gray-700 dark:text-gray-300'}`}
                    >
                      {msg.username}
                    </button>
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {formatTime(msg.createdAt)}
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
        {!isAuthed && (
          <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
            {t.chatLoginToWrite}
          </p>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t.messagePlaceholder}
            disabled={!isAuthed}
            className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg
                       bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200
                       focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-60 disabled:cursor-not-allowed"
          />
          <button
            onClick={handleSend}
            disabled={!isAuthed || !text.trim()}
            className="px-4 py-2 bg-teal-500 text-white rounded-lg text-sm font-bold
                       hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed
                       transition-colors uppercase tracking-wide"
          >
            {t.send}
          </button>
        </div>
      </div>
    </div>

    {selectedUserId !== null && (
      <PlayerProfileModal
        playerId={selectedUserId}
        onClose={() => setSelectedUserId(null)}
      />
    )}
    </>
  );
}
