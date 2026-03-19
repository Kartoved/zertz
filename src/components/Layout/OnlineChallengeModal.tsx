import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../../i18n';
import { useRoomStore } from '../../store/roomStore';
import { useAuthStore } from '../../store/authStore';
import * as roomsApi from '../../db/roomsApi';
import { TimePresetId, FISCHER_PRESETS, TIME_CONTROLS } from './MainMenu';

interface OnlineChallengeModalProps {
  onClose: () => void;
  initialStep: 'board' | 'link';
  initialPreset: TimePresetId;
  initialBoardSize?: 37 | 48 | 61;
}

export default function OnlineChallengeModal({
  onClose,
  initialStep = 'board',
  initialPreset = '5+5',
  initialBoardSize = 37,
}: OnlineChallengeModalProps) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { createRoom, isLoading: isCreatingRoom } = useRoomStore();

  const [onlineStep, setOnlineStep] = useState<'board' | 'link'>(initialStep);
  const [selectedBoardSize, setSelectedBoardSize] = useState<37 | 48 | 61>(initialBoardSize);
  const [selectedPreset, setSelectedPreset] = useState<TimePresetId>(initialPreset);
  const [selectedPlayer, setSelectedPlayer] = useState<1 | 2 | 'random'>(1);
  const [isRated, setIsRated] = useState(false);
  const [createdRoomId, setCreatedRoomId] = useState<number | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
        <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {onlineStep === 'link' ? t.inviteLinkTitle : t.challengeSettings}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            ✕
          </button>
        </div>
        
        <div className="p-4 overflow-y-auto max-h-[80vh]">
          {onlineStep !== 'link' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">{t.chooseBoardOnline}</label>
                <div className="grid grid-cols-3 gap-2">
                  {([37, 48, 61] as const).map((size) => (
                    <button
                      key={size}
                      onClick={() => setSelectedBoardSize(size)}
                      className={`p-2 text-center rounded-lg border-2 transition-colors ${
                        selectedBoardSize === size
                          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/40 text-gray-900 dark:text-white'
                          : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                    >
                      <div className="text-lg font-bold mb-0.5">{size}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">{t.selectTimeControl}</label>
                <div className="grid grid-cols-2 gap-2">
                  {FISCHER_PRESETS.map((preset) => {
                    const labelText = TIME_CONTROLS.find(c => c.preset === preset.id)?.id;
                    const labelKey = labelText ? t[labelText as keyof typeof t] as string : preset.id;
                    return (
                      <button
                        key={preset.id}
                        onClick={() => setSelectedPreset(preset.id)}
                        className={`p-2 text-center rounded-lg border-2 transition-colors ${
                          selectedPreset === preset.id
                            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/40 text-gray-900 dark:text-white'
                            : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                      >
                        <div className="font-medium text-sm">{labelKey || preset.id} ({preset.id})</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">{t.choosePlayer}</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setSelectedPlayer(1)}
                    className={`p-2 text-center rounded-lg border-2 transition-colors ${
                      selectedPlayer === 1
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/40 text-gray-900 dark:text-white'
                        : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <div className="font-medium text-sm">{t.firstShort || '1'}</div>
                  </button>
                  <button
                    onClick={() => setSelectedPlayer(2)}
                    className={`p-2 text-center rounded-lg border-2 transition-colors ${
                      selectedPlayer === 2
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/40 text-gray-900 dark:text-white'
                        : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <div className="font-medium text-sm">{t.secondShort || '2'}</div>
                  </button>
                  <button
                    onClick={() => setSelectedPlayer('random')}
                    className={`p-2 text-center rounded-lg border-2 transition-colors ${
                      selectedPlayer === 'random'
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/40 text-gray-900 dark:text-white'
                        : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <div className="font-medium text-sm">{t.random}</div>
                  </button>
                </div>
              </div>

              {user && (
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white text-sm">{t.ratedGame}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{t.ratedHint}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsRated(!isRated)}
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      isRated ? 'bg-indigo-500' : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      isRated ? 'translate-x-6' : ''
                    }`} />
                  </button>
                </div>
              )}

              <button
                disabled={isCreatingRoom}
                onClick={async () => {
                  try {
                    const player = selectedPlayer === 'random' 
                      ? (Math.random() < 0.5 ? 1 : 2) as 1 | 2
                      : selectedPlayer as 1 | 2;
                    const preset = FISCHER_PRESETS.find((p) => p.id === selectedPreset) || FISCHER_PRESETS[0];
                    const roomId = await createRoom(
                      selectedBoardSize,
                      player,
                      user ? isRated : false,
                      { baseMs: preset.baseMs, incrementMs: preset.incrementMs }
                    );
                    setCreatedRoomId(roomId);
                    setOnlineStep('link');
                    // Make rooms list re-poll fast to show outgoing game immediately
                    setTimeout(() => roomsApi.getPendingRooms().catch(() => {}), 500);
                  } catch (err: any) {
                    alert(t.createRoomError + ' ' + (err.message || ''));
                  }
                }}
                className="w-full py-3.5 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-bold rounded-xl shadow-md hover:shadow-lg transition-all active:scale-95 disabled:opacity-50"
              >
                {isCreatingRoom ? t.creating : t.createGame}
              </button>
            </div>
          )}

          {onlineStep === 'link' && createdRoomId && (
            <>
              <p className="text-gray-600 dark:text-gray-400 mb-4 text-center pb-2">
                {t.gameCreatedHint}
              </p>
              <div className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl p-4 mb-6">
                <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">{t.gameLink}</div>
                <a 
                  href={`${window.location.origin}/room/${createdRoomId}`}
                  className="text-indigo-600 dark:text-indigo-400 hover:underline break-all font-medium text-lg"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {window.location.origin}/room/{createdRoomId}
                </a>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/room/${createdRoomId}`);
                    setLinkCopied(true);
                    setTimeout(() => setLinkCopied(false), 2000);
                  }}
                  className="flex-1 py-3 px-4 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white font-semibold rounded-xl border border-gray-200 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  {linkCopied ? t.copied : t.copyLink}
                </button>
                <button
                  onClick={() => {
                    onClose();
                    navigate(`/room/${createdRoomId}`);
                  }}
                  className="flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition-colors"
                >
                  {t.goToGame}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
