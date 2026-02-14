import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPlayerProfile, followUser, unfollowUser, createChallenge, PlayerProfile } from '../../db/authApi';
import { useAuthStore } from '../../store/authStore';
import { createInitialState } from '../../game/GameEngine';
import { GameNode } from '../../game/types';
import { toCountryEmoji } from '../../utils/country';

const BOARD_LABELS: Record<number, string> = {
  37: 'Любительское 37',
  48: 'Турнирное 48',
  61: 'Турнирное 61',
};

interface PlayerProfileModalProps {
  playerId: number;
  onClose: () => void;
}

function serializeState(state: any): string {
  const ringsArray = Array.from(state.rings.entries());
  return JSON.stringify({ ...state, rings: ringsArray });
}

function createRootNode(): GameNode {
  return {
    id: 'root',
    moveNumber: 0,
    player: 'player1',
    move: null,
    notation: '',
    children: [],
    parent: null,
    isMainLine: true,
  };
}

function serializeTree(node: GameNode): string {
  function serializeNode(n: GameNode): object {
    return { ...n, parent: null, children: n.children.map(c => serializeNode(c)) };
  }
  return JSON.stringify(serializeNode(node));
}

export default function PlayerProfileModal({ playerId, onClose }: PlayerProfileModalProps) {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [showChallenge, setShowChallenge] = useState(false);
  const [challengeBoardSize, setChallengeBoardSize] = useState<37 | 48 | 61>(37);
  const [challengeRated, setChallengeRated] = useState(false);
  const [challengePlayer, setChallengePlayer] = useState<1 | 2 | 'random'>(1);
  const [challengeLoading, setChallengeLoading] = useState(false);

  useEffect(() => {
    loadProfile();
  }, [playerId]);

  const loadProfile = async () => {
    setIsLoading(true);
    try {
      const data = await getPlayerProfile(playerId);
      setProfile(data);
    } catch {
      setToast('Ошибка загрузки профиля');
    }
    setIsLoading(false);
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const handleFollow = async () => {
    if (!profile) return;
    try {
      if (profile.isFollowing) {
        await unfollowUser(profile.id);
        setProfile({ ...profile, isFollowing: false });
        showToast('Отписка оформлена');
      } else {
        await followUser(profile.id);
        setProfile({ ...profile, isFollowing: true });
        showToast('Подписка оформлена');
      }
    } catch (err: any) {
      showToast(err.message);
    }
  };

  const handleChallenge = async () => {
    if (!profile) return;
    setChallengeLoading(true);
    try {
      const player = challengePlayer === 'random' ? (Math.random() < 0.5 ? 1 : 2) as 1 | 2 : challengePlayer;
      const initialState = createInitialState(challengeBoardSize);
      const rootNode = createRootNode();
      const result = await createChallenge(
        profile.id,
        challengeBoardSize,
        challengeRated,
        player,
        serializeState(initialState),
        serializeTree(rootNode)
      );
      showToast('Вызов отправлен!');
      setShowChallenge(false);
      // Navigate to the room
      onClose();
      navigate(`/room/${result.roomId}`);
    } catch (err: any) {
      showToast(err.message);
    }
    setChallengeLoading(false);
  };

  const formatDate = (ts: number) => {
    return new Date(ts).toLocaleDateString('ru-RU', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-8">Загрузка...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-8">
          <p>Игрок не найден</p>
          <button onClick={onClose} className="mt-4 px-4 py-2 bg-gray-200 rounded-lg">Закрыть</button>
        </div>
      </div>
    );
  }

  const isMe = user?.id === profile.id;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {toCountryEmoji(profile.country)} {profile.username}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">✕</button>
        </div>

        <div className="p-4 space-y-4">
          {/* Quote */}
          {profile.quote && (
            <div className="text-sm text-gray-600 dark:text-gray-400 italic">"{profile.quote}"</div>
          )}

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
              <div className="text-gray-500 dark:text-gray-400">Рейтинг</div>
              <div className="text-xl font-bold text-blue-600 dark:text-blue-400">{profile.rating}</div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
              <div className="text-gray-500 dark:text-gray-400">Игр</div>
              <div className="text-xl font-bold text-gray-900 dark:text-white">{profile.games}</div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
              <div className="text-gray-500 dark:text-gray-400">Победы / Поражения</div>
              <div className="font-bold">
                <span className="text-green-600">{profile.wins}</span>
                {' / '}
                <span className="text-red-500">{profile.losses}</span>
                <span className="text-gray-500 ml-1">({profile.winrate}%)</span>
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
              <div className="text-gray-500 dark:text-gray-400">Лучшая серия</div>
              <div className="text-xl font-bold text-orange-500">{profile.bestStreak}</div>
            </div>
          </div>

          <div className="text-xs text-gray-500 dark:text-gray-400">
            Зарегистрирован: {formatDate(profile.createdAt)}
          </div>

          {/* Actions */}
          {!isMe && (
            <div className="flex gap-2">
              {user && (
                <button
                  onClick={handleFollow}
                  className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                    profile.isFollowing
                      ? 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white hover:bg-red-100 hover:text-red-600'
                      : 'bg-blue-500 hover:bg-blue-600 text-white'
                  }`}
                >
                  {profile.isFollowing ? 'Отписаться' : 'Подписаться'}
                </button>
              )}
              {user && (
                <button
                  onClick={() => setShowChallenge(!showChallenge)}
                  className="flex-1 py-2 px-4 bg-purple-500 hover:bg-purple-600 text-white rounded-lg font-medium transition-colors"
                >
                  Вызвать на игру
                </button>
              )}
            </div>
          )}

          {/* Challenge settings */}
          {showChallenge && (
            <div className="border dark:border-gray-700 rounded-lg p-3 space-y-3">
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Настройки вызова</div>

              {/* Board size */}
              <div className="flex gap-2">
                {([37, 48, 61] as const).map(size => (
                  <button
                    key={size}
                    onClick={() => setChallengeBoardSize(size)}
                    className={`flex-1 py-1.5 text-sm rounded-lg transition-colors ${
                      challengeBoardSize === size
                        ? 'bg-purple-100 dark:bg-purple-900 border-2 border-purple-500 font-medium'
                        : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {BOARD_LABELS[size]}
                  </button>
                ))}
              </div>

              {/* Player selection */}
              <div className="flex gap-2">
                {([1, 2, 'random'] as const).map(p => (
                  <button
                    key={p}
                    onClick={() => setChallengePlayer(p)}
                    className={`flex-1 py-1.5 text-sm rounded-lg transition-colors ${
                      challengePlayer === p
                        ? 'bg-purple-100 dark:bg-purple-900 border-2 border-purple-500 font-medium'
                        : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {p === 1 ? '1-й' : p === 2 ? '2-й' : 'Случайно'}
                  </button>
                ))}
              </div>

              {/* Rated toggle */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700 dark:text-gray-300">Рейтинговая</span>
                <button
                  type="button"
                  onClick={() => setChallengeRated(!challengeRated)}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    challengeRated ? 'bg-purple-500' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    challengeRated ? 'translate-x-6' : ''
                  }`} />
                </button>
              </div>

              <button
                onClick={handleChallenge}
                disabled={challengeLoading}
                className="w-full py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {challengeLoading ? 'Отправка...' : 'Отправить вызов'}
              </button>
            </div>
          )}
        </div>

        {/* Toast */}
        {toast && (
          <div className="p-3 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-sm text-center">
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}
