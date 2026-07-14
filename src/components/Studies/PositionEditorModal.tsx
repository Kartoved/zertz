import { useState } from 'react';
import HexBoard from '../Board/HexBoard';
import { createInitialState, cloneState } from '../../game/GameEngine';
import { GameState, MarbleColor, Player } from '../../game/types';
import { useI18n } from '../../i18n';

type Brush = MarbleColor | 'erase' | 'ring';

const MARBLE_STYLE: Record<MarbleColor, string> = {
  white: 'radial-gradient(circle at 30% 30%, #ffffff, #e0e0e0)',
  gray: 'radial-gradient(circle at 30% 30%, #9ca3af, #6b7280)',
  black: 'radial-gradient(circle at 30% 30%, #6b7280, #374151)',
};

interface PositionEditorModalProps {
  onClose: () => void;
  onCreate: (title: string, state: GameState) => Promise<void> | void;
}

// Etap D — arbitrary position editor. The board + captures always conserve the
// marble supply (6 white / 8 gray / 10 black): placing a marble or crediting a
// capture draws from a shared reserve, so the invariant holds by construction.
// Validation is balance + structure only (marbles only on present rings) — no
// ZERTZ legality check, so reconstructed / broken positions can be entered.
export default function PositionEditorModal({ onClose, onCreate }: PositionEditorModalProps) {
  const { t } = useI18n();
  const [state, setState] = useState<GameState>(() => createInitialState(37));
  const [brush, setBrush] = useState<Brush>('white');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);

  const setBoardSize = (size: 37 | 48 | 61) => setState(createInitialState(size));

  const handleRingClick = (ringId: string) => {
    setState(prev => {
      const next = cloneState(prev);
      const r = next.rings.get(ringId);
      if (!r) return prev;

      if (brush === 'ring') {
        if (r.marble) return prev;          // can't remove a ring holding a marble
        r.isRemoved = !r.isRemoved;
        return next;
      }
      if (brush === 'erase') {
        if (!r.marble) return prev;
        next.reserve[r.marble.color]++;     // return to the pool
        r.marble = null;
        return next;
      }
      // A marble colour brush.
      if (r.isRemoved) return prev;
      if (r.marble?.color === brush) return prev;
      if (next.reserve[brush] <= 0) return prev;   // none left in the pool
      if (r.marble) next.reserve[r.marble.color]++; // free the replaced marble
      next.reserve[brush]--;
      r.marble = { color: brush };
      return next;
    });
  };

  const stepCapture = (player: Player, color: MarbleColor, delta: 1 | -1) => {
    setState(prev => {
      const next = cloneState(prev);
      if (delta === 1) {
        if (next.reserve[color] <= 0) return prev;
        next.captures[player][color]++;
        next.reserve[color]--;
      } else {
        if (next.captures[player][color] <= 0) return prev;
        next.captures[player][color]--;
        next.reserve[color]++;
      }
      return next;
    });
  };

  const handleCreate = async () => {
    if (!title.trim() || busy) return;
    setBusy(true);
    try {
      const final = cloneState(state);
      final.phase = 'placement';   // viewer normalizes to capture if forced
      final.winner = null;
      final.pendingPlacement = null;
      final.moveNumber = 1;
      await onCreate(title.trim(), final);
    } finally {
      setBusy(false);
    }
  };

  const Swatch = ({ color }: { color: MarbleColor }) => (
    <span className="w-5 h-5 rounded-full border border-black/10 shadow-sm inline-block" style={{ background: MARBLE_STYLE[color] }} />
  );

  const brushBtn = (b: Brush, node: React.ReactNode, label: string) => (
    <button
      type="button"
      title={label}
      onClick={() => setBrush(b)}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm border ${
        brush === b ? 'ring-2 ring-indigo-500 border-transparent bg-indigo-50 dark:bg-indigo-900/40' : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700'
      }`}
    >
      {node}
    </button>
  );

  const capRow = (player: Player) => (
    <div className="flex items-center gap-3">
      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 w-14">
        {player === 'player1' ? t.studyPlayer1 : t.studyPlayer2}
      </span>
      {(['white', 'gray', 'black'] as MarbleColor[]).map(color => (
        <span key={color} className="flex items-center gap-1">
          <Swatch color={color} />
          <button type="button" onClick={() => stepCapture(player, color, -1)}
            className="w-5 h-5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 leading-none">−</button>
          <span className="w-4 text-center text-sm text-gray-800 dark:text-gray-100">{state.captures[player][color]}</span>
          <button type="button" onClick={() => stepCapture(player, color, 1)}
            className="w-5 h-5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 leading-none">+</button>
        </span>
      ))}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-2 sm:p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-4xl max-h-[95vh] overflow-y-auto p-4 md:p-5"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">{t.editorTitle}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none">✕</button>
        </div>

        <div className="flex flex-col lg:flex-row gap-4">
          {/* Board */}
          <div className="flex-1 min-w-0">
            <div className="w-full max-w-[460px] mx-auto aspect-square rounded-xl overflow-hidden bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
              <HexBoard state={state} onRingClick={handleRingClick} preview editable />
            </div>
            {/* Brush palette */}
            <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
              {(['white', 'gray', 'black'] as MarbleColor[]).map(c =>
                <span key={c}>{brushBtn(c, <><Swatch color={c} /><span className="text-xs text-gray-500">{state.reserve[c]}</span></>, c)}</span>
              )}
              {brushBtn('erase', <span>∅</span>, t.editorEraseMarble)}
              {brushBtn('ring', <span>⭕</span>, t.editorToggleRing)}
            </div>
          </div>

          {/* Controls */}
          <div className="lg:w-80 flex-shrink-0 flex flex-col gap-3">
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={t.studyNewTitlePrompt}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />

            <div>
              <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">{t.editorBoardSize}</div>
              <div className="flex gap-2">
                {([37, 48, 61] as const).map(s => (
                  <button key={s} onClick={() => setBoardSize(s)}
                    className={`px-3 py-1 rounded-lg text-sm border ${state.boardSize === s ? 'ring-2 ring-indigo-500 border-transparent bg-indigo-50 dark:bg-indigo-900/40' : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50'}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">{t.editorTurn}</div>
              <div className="flex gap-2">
                {(['player1', 'player2'] as Player[]).map(p => (
                  <button key={p} onClick={() => setState(prev => ({ ...cloneState(prev), currentPlayer: p }))}
                    className={`px-3 py-1 rounded-lg text-sm border ${state.currentPlayer === p ? 'ring-2 ring-indigo-500 border-transparent bg-indigo-50 dark:bg-indigo-900/40' : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50'}`}>
                    {p === 'player1' ? t.studyPlayer1 : t.studyPlayer2}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{t.editorReserve}</span>
                {(['white', 'gray', 'black'] as MarbleColor[]).map(c => (
                  <span key={c} className="flex items-center gap-1">
                    <Swatch color={c} /><span className="text-sm text-gray-800 dark:text-gray-100">{state.reserve[c]}</span>
                  </span>
                ))}
              </div>
              <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1 mt-2">{t.editorCaptures}</div>
              <div className="flex flex-col gap-2">
                {capRow('player1')}
                {capRow('player2')}
              </div>
            </div>

            <div className="flex gap-2 mt-1">
              <button onClick={onClose} className="flex-1 px-3 py-2 rounded-lg text-sm font-semibold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600">
                {t.cancel}
              </button>
              <button onClick={handleCreate} disabled={!title.trim() || busy}
                className="flex-1 px-3 py-2 rounded-lg text-sm font-semibold bg-indigo-500 hover:bg-indigo-600 text-white disabled:opacity-40">
                {t.editorCreate}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
