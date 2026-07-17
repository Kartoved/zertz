import { useState } from 'react';
import { useI18n } from '../../i18n';

// Paste a ZEN game or a ZIP position to create a new study from it.
export default function ImportStudyModal({
  onClose,
  onImport,
}: {
  onClose: () => void;
  onImport: (text: string, title: string) => Promise<boolean>;
}) {
  const { t } = useI18n();
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    const ok = await onImport(text.trim(), title.trim());
    setBusy(false);
    if (!ok) setError(t.importError);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-lg w-full p-5"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3">{t.studyImport}</h2>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder={t.studyImportTitle}
          className="w-full mb-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900
            p-2 text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:border-indigo-500"
        />
        <textarea
          autoFocus
          value={text}
          onChange={e => { setText(e.target.value); setError(null); }}
          placeholder={t.importPositionHint}
          rows={5}
          className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900
            p-2 font-mono text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:border-indigo-500 resize-y"
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
            onClick={submit}
            disabled={!text.trim() || busy}
            className="px-5 py-2 rounded-lg text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
          >
            {t.importLoad}
          </button>
        </div>
      </div>
    </div>
  );
}
