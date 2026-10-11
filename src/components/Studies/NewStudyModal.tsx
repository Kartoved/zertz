import { useState } from 'react';
import { useI18n } from '../../i18n';

export type NewStudyChoice =
  | { kind: 'blank'; title: string; boardSize: 37 | 48 | 61 }
  | { kind: 'editor'; title: string }
  | { kind: 'import'; title: string };

// One entry point for every way to start a study: a blank board (any size), a
// position built in the editor, or a pasted ZEN game / ZIP position. The title
// typed here is carried into the editor / import dialogs.
export default function NewStudyModal({
  parentTitle,
  onClose,
  onChoose,
}: {
  /** Set when creating a nested study — shown as context. */
  parentTitle?: string | null;
  onClose: () => void;
  onChoose: (choice: NewStudyChoice) => Promise<void> | void;
}) {
  const { t } = useI18n();
  const [title, setTitle] = useState('');
  const [boardSize, setBoardSize] = useState<37 | 48 | 61>(37);
  const [busy, setBusy] = useState(false);
  const [needTitle, setNeedTitle] = useState(false);

  const createBlank = async () => {
    if (!title.trim()) { setNeedTitle(true); return; }
    if (busy) return;
    setBusy(true);
    await onChoose({ kind: 'blank', title: title.trim(), boardSize });
    setBusy(false);
  };

  const card = 'w-full text-left rounded-xl border border-gray-200 dark:border-gray-700 p-3 hover:border-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20 transition-colors';

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md p-5" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">{t.studyNewTitle}</h2>
        {parentTitle && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{t.studyNewInside} «{parentTitle}»</p>
        )}

        <input
          autoFocus
          value={title}
          onChange={e => { setTitle(e.target.value); setNeedTitle(false); }}
          onKeyDown={e => { if (e.key === 'Enter') createBlank(); }}
          placeholder={t.studyNewTitlePrompt}
          className={`mt-3 w-full px-3 py-2 rounded-lg border bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-indigo-500 ${
            needTitle ? 'border-red-400' : 'border-gray-300 dark:border-gray-600'
          }`}
        />

        <div className="mt-3 flex flex-col gap-2">
          {/* Blank board */}
          <div className={card}>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="font-semibold text-sm text-gray-900 dark:text-white">📄 {t.studyNewBlank}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{t.studyNewBlankHint}</div>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                {([37, 48, 61] as const).map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setBoardSize(s)}
                    className={`px-2 py-0.5 rounded-md text-xs font-mono font-semibold ${
                      boardSize === s ? 'bg-indigo-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={createBlank}
              disabled={busy}
              className="mt-2 w-full px-3 py-1.5 rounded-lg text-sm font-semibold bg-indigo-500 hover:bg-indigo-600 text-white disabled:opacity-50"
            >
              {t.studyCreate}
            </button>
          </div>

          {/* Position editor */}
          <button type="button" className={card} onClick={() => onChoose({ kind: 'editor', title: title.trim() })}>
            <div className="font-semibold text-sm text-gray-900 dark:text-white">⊞ {t.studyNewFromPosition}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">{t.studyNewFromPositionHint}</div>
          </button>

          {/* Import */}
          <button type="button" className={card} onClick={() => onChoose({ kind: 'import', title: title.trim() })}>
            <div className="font-semibold text-sm text-gray-900 dark:text-white">⤓ {t.studyImport}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">{t.studyImportHint}</div>
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full px-3 py-2 rounded-lg text-sm font-semibold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"
        >
          {t.cancel}
        </button>
      </div>
    </div>
  );
}
