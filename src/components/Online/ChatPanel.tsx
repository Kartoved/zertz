import { useState, useRef, useEffect } from 'react';
import { useRoomStore } from '../../store/roomStore';
import { useI18n } from '../../i18n';

interface ChatPanelProps {
  inputBottomOffset?: number;
}

export function ChatPanel({ inputBottomOffset = 0 }: ChatPanelProps) {
  const { t, locale } = useI18n();
  const { messages, playerNames, myPlayer, sendMessage, state, undoLastMove } = useRoomStore();
  const [text, setText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleAcceptUndo = async () => {
    await undoLastMove(true);
    sendMessage('[UNDO_ACCEPTED]');
  };

  const handleRejectUndo = () => {
    sendMessage('[UNDO_REJECTED]');
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (text.trim()) {
      sendMessage(text);
      setText('');
    }
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

  const formatDate = (timestamp: number) => {
    const d = new Date(timestamp);
    return d.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  };

  const getMoveLabel = (num: number) => {
    if (locale === 'ru') return `${num} ход`;
    if (locale === 'eo') return `${num} movo`;
    return `Move ${num}`;
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <div className="p-3 border-b border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold text-gray-800 dark:text-gray-200">{t.chat}</h3>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
        {messages.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-4">
            {t.noMessagesYet}
          </p>
        ) : (
          messages.map((msg, idx) => {
            const isMe = msg.playerIndex === myPlayer;
            const playerName = msg.playerIndex === 1 ? playerNames.player1 : playerNames.player2;
            const hasAnswer = messages.some((m, i) => i > idx && (m.message === '[UNDO_ACCEPTED]' || m.message === '[UNDO_REJECTED]'));
            
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {playerName}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
                    {msg.moveNumber !== undefined && (
                      <span className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                        {getMoveLabel(msg.moveNumber + 1)}
                      </span>
                    )}
                    <span>{formatDate(msg.createdAt)} {formatTime(msg.createdAt)}</span>
                  </span>
                </div>
                <div
                  className={`max-w-[80%] px-3 py-2 rounded-lg text-sm ${
                    isMe
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                  }`}
                >
                  {msg.message === '[UNDO_REQUEST]' ? (
                    <div>
                      <div className="font-semibold">{t.undoRequestChat || 'Requests undo'}</div>
                      {!isMe && msg.moveNumber === state.moveNumber && !hasAnswer && !state.winner && (
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={handleAcceptUndo}
                            className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-xs transition-colors"
                          >
                            {t.undoAccept || 'Accept'}
                          </button>
                          <button
                            onClick={handleRejectUndo}
                            className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-xs transition-colors"
                          >
                            {t.undoReject || 'Reject'}
                          </button>
                        </div>
                      )}
                    </div>
                  ) : msg.message === '[UNDO_ACCEPTED]' ? (
                    <div className="font-semibold text-green-200">{t.undoAcceptedChat || 'Undo accepted.'}</div>
                  ) : msg.message === '[UNDO_REJECTED]' ? (
                    <div className="font-semibold text-red-200">{t.undoRejectedChat || 'Undo rejected.'}</div>
                  ) : (
                    msg.message
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <div
        className="p-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
        style={inputBottomOffset > 0 ? { position: 'sticky', bottom: `${inputBottomOffset}px`, zIndex: 10 } : undefined}
      >
        <div className="flex gap-2">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t.messagePlaceholder}
            className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg 
                       bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleSend}
            disabled={!text.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium
                       hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed
                       transition-colors"
          >
            →
          </button>
        </div>
      </div>
    </div>
  );
}
