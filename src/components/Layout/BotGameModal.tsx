import { useState } from 'react';
import { useI18n } from '../../i18n';
import { BotLevel } from '../../ai/minimax';
import { Player } from '../../game/types';

interface BotGameModalProps {
  onClose: () => void;
  onStart: (boardSize: 37 | 48 | 61, botPlayer: Player, level: BotLevel) => void;
}

export default function BotGameModal({ onClose, onStart }: BotGameModalProps) {
  const { t } = useI18n();
  const [boardSize, setBoardSize] = useState<37 | 48 | 61>(37);
  const [level, setLevel] = useState<BotLevel>('medium');
  const [humanPlayer, setHumanPlayer] = useState<Player>('player1');

  const botPlayer: Player = humanPlayer === 'player1' ? 'player2' : 'player1';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
        <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t.botGameSetup}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">✕</button>
        </div>

        <div className="p-4 space-y-5">
          {/* Board size */}
          <div>
            <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">{t.chooseBoard}</p>
            <div className="space-y-2">
              {([37, 48, 61] as const).map(size => (
                <button
                  key={size}
                  onClick={() => setBoardSize(size)}
                  className={`w-full p-3 text-left rounded-lg transition-colors text-sm ${
                    boardSize === size
                      ? 'bg-indigo-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white'
                  }`}
                >
                  {size === 37 ? t.board37 : size === 48 ? t.board48 : t.board61}
                </button>
              ))}
            </div>
          </div>

          {/* Difficulty */}
          <div>
            <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">{t.botDifficulty}</p>
            <div className="flex gap-2">
              {(['easy', 'medium', 'hard'] as BotLevel[]).map(l => (
                <button
                  key={l}
                  onClick={() => setLevel(l)}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    level === l
                      ? 'bg-indigo-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white'
                  }`}
                >
                  {l === 'easy' ? t.botEasy : l === 'medium' ? t.botMedium : t.botHard}
                </button>
              ))}
            </div>
          </div>

          {/* Side */}
          <div>
            <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">{t.botSide}</p>
            <div className="space-y-2">
              <button
                onClick={() => setHumanPlayer('player1')}
                className={`w-full p-3 text-left rounded-lg transition-colors text-sm ${
                  humanPlayer === 'player1'
                    ? 'bg-indigo-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white'
                }`}
              >
                {t.botSidePlayer1}
              </button>
              <button
                onClick={() => setHumanPlayer('player2')}
                className={`w-full p-3 text-left rounded-lg transition-colors text-sm ${
                  humanPlayer === 'player2'
                    ? 'bg-indigo-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white'
                }`}
              >
                {t.botSidePlayer2}
              </button>
            </div>
          </div>
        </div>

        <div className="p-4 border-t dark:border-gray-700">
          <button
            onClick={() => onStart(boardSize, botPlayer, level)}
            className="w-full py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-semibold transition-colors"
          >
            {t.startBotGame}
          </button>
        </div>
      </div>
    </div>
  );
}
