import { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { useUIStore } from '../../store/uiStore';
import { zipToState } from '../../game/zip';
import { zenToTree } from '../../game/zen';
import { useI18n } from '../../i18n';

// A ZEN game always carries tag pairs (at least `[ZIP "..."]`); a bare ZIP
// position line has none.
function looksLikeZen(text: string): boolean {
  return /\[\w+\s+"/.test(text);
}

// Paste a ZIP position or a ZEN game to open it as a fresh local game.
export default function ImportPositionModal({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const loadPosition = useGameStore(s => s.loadPosition);
  const loadTree = useGameStore(s => s.loadTree);
  const setScreen = useUIStore(s => s.setScreen);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    const raw = text.trim();
    try {
      if (looksLikeZen(raw)) {
        const { startState, root, meta } = zenToTree(raw);
        const names = meta.Player1 || meta.Player2
          ? { player1: meta.Player1 || 'Player 1', player2: meta.Player2 || 'Player 2' }
          : undefined;
        loadTree(startState, root, names);
      } else {
        loadPosition(zipToState(raw));
      }
      setScreen('game');
      onClose();
    } catch {
      setError(t.importError);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-lg w-full p-5"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3">{t.importPosition}</h2>
        <textarea
          autoFocus
          value={text}
          onChange={e => { setText(e.target.value); setError(null); }}
          placeholder={t.importPositionHint}
          rows={4}
          className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900
            p-2 font-mono text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:border-blue-500 resize-y"
        />
        {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            {t.cancel}
          </button>
          <button
            type="button"
            onClick={load}
            disabled={!text.trim()}
            className="px-5 py-2 rounded-lg text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
          >
            {t.importLoad}
          </button>
        </div>
      </div>
    </div>
  );
}
