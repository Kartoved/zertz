import { useState } from 'react';
import { useI18n } from '../../i18n';

// Create a new (blank) study with a title. Replaces the fragile window.prompt
// flow so it keeps working even when the browser suppresses dialogs.
export default function NewStudyModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (title: string) => Promise<void>;
}) {
  const { t } = useI18n();
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!title.trim() || busy) return;
    setBusy(true);
    await onCreate(title.trim());
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3">{t.studyNew}</h2>
        <input
          autoFocus
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit(); }}
          placeholder={t.studyNewTitlePrompt}
          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-indigo-500"
        />
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 px-3 py-2 rounded-lg text-sm font-semibold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600">
            {t.cancel}
          </button>
          <button onClick={submit} disabled={!title.trim() || busy} className="flex-1 px-3 py-2 rounded-lg text-sm font-semibold bg-indigo-500 hover:bg-indigo-600 text-white disabled:opacity-50">
            {t.studySave}
          </button>
        </div>
      </div>
    </div>
  );
}
