import { useState, useRef, useEffect } from 'react';
import { useI18n } from '../../i18n';
import { useAuthStore } from '../../store/authStore';
import {
  getGlobalChatMessages,
  getGlobalChatMessagesBefore,
  sendGlobalChatMessage,
  GlobalChatMessage,
} from '../../db/globalChatApi';
import { getPlayerStats, PlayerStats } from '../../db/authApi';
import PlayerProfileModal from '../Auth/PlayerProfileModal';
import { tryRenderSystemBody, isSystemActor } from './SystemMessageCard';

const MAX_STORED_MESSAGES = 200;

export default function GlobalChat() {
  const { t, locale } = useI18n();
  const { user } = useAuthStore();
  const isAuthed = !!user;
  const [text, setText] = useState('');
  const [messages, setMessages] = useState<GlobalChatMessage[]>([]);
  const [lastMessageId, setLastMessageId] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [stats, setStats] = useState<PlayerStats>({ total: 0, online: 0 });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const s = await getPlayerStats();
      if (!cancelled) setStats(s);
    };
    load();
    const interval = setInterval(load, 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadInitial = async () => {
      try {
        const page = await getGlobalChatMessages();
        if (!cancelled) {
          setMessages(page.messages);
          setHasMore(page.hasMore);
          setLastMessageId(page.messages.length > 0 ? page.messages[page.messages.length - 1].id : 0);
        }
      } catch {
        // ignore initial load errors
      }
    };

    loadInitial();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const page = await getGlobalChatMessages(lastMessageId || undefined);
        if (page.messages.length > 0) {
          setMessages((prev) => [...prev, ...page.messages].slice(-MAX_STORED_MESSAGES));
          setLastMessageId(page.messages[page.messages.length - 1].id);
        }
      } catch {
        // ignore polling errors
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [lastMessageId]);

  const handleLoadMore = async () => {
    if (!messages.length || loadingMore) return;
    const oldestId = messages[0].id;
    const container = scrollContainerRef.current;
    const prevScrollHeight = container?.scrollHeight ?? 0;
    setLoadingMore(true);
    try {
      const page = await getGlobalChatMessagesBefore(oldestId);
      setMessages(prev => [...page.messages, ...prev].slice(-MAX_STORED_MESSAGES));
      setHasMore(page.hasMore);
      // Restore scroll position so the view doesn't jump to top.
      requestAnimationFrame(() => {
        if (container) {
          container.scrollTop = container.scrollHeight - prevScrollHeight;
        }
      });
    } catch {
      // ignore load-more errors
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    const scroll = () => {
      const container = messagesEndRef.current?.parentElement;
      if (container) container.scrollTop = container.scrollHeight;
    };
    scroll();
    const raf = requestAnimationFrame(scroll);
    return () => cancelAnimationFrame(raf);
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
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between gap-2">
        <h3 className="font-bold text-gray-800 dark:text-gray-200 text-sm uppercase tracking-wide">
          {t.globalChat}
        </h3>
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400" title={`${t.playersOnline}: ${stats.online} / ${t.playersTotal}: ${stats.total}`}>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-green-500 ring-2 ring-green-500/30" />
            <span className="font-semibold text-green-600 dark:text-green-400">{stats.online}</span>
          </span>
          <span className="text-gray-400 dark:text-gray-600">/</span>
          <span>{stats.total}</span>
        </div>
      </div>

      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        {hasMore && (
          <div className="text-center">
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50"
            >
              {loadingMore ? '…' : t.loadEarlierMessages}
            </button>
          </div>
        )}
        {messages.length === 0 ? (
          <p className="text-gray-400 dark:text-gray-500 text-sm text-center py-8">
            {t.noMessagesYet}
          </p>
        ) : (
          messages.map((msg) => {
            const isMe = msg.username === user?.username;
            const isSystem = isSystemActor(msg.username);
            const systemRender = isSystem ? tryRenderSystemBody(msg.message) : null;
            return (
              <div key={msg.id} className="flex items-start gap-2">
                {isSystem ? (
                  <div className="w-7 h-7 rounded-full bg-amber-500 flex items-center justify-center text-white text-xs flex-shrink-0">
                    📢
                  </div>
                ) : (
                  <div className="w-7 h-7 rounded-full bg-teal-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {msg.username.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {isSystem ? (
                      <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                        {msg.username}
                      </span>
                    ) : (
                      <button
                        onClick={() => setSelectedUserId(msg.userId)}
                        className={`text-xs font-semibold hover:underline ${isMe ? 'text-teal-600 dark:text-teal-400' : 'text-gray-700 dark:text-gray-300'}`}
                      >
                        {msg.username}
                      </button>
                    )}
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {formatTime(msg.createdAt)}
                    </span>
                  </div>
                  {systemRender ? (
                    <div className="mt-1">{systemRender.node}</div>
                  ) : (
                    <p className="text-sm text-gray-800 dark:text-gray-200 break-words">
                      {msg.message}
                    </p>
                  )}
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
