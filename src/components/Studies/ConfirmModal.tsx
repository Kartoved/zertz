import { useState } from 'react';
import { useI18n } from '../../i18n';

// Reusable confirm dialog. Replaces window.confirm so it keeps working when the
// browser suppresses dialogs.
export default function ConfirmModal({
  message,
  confirmLabel,
  danger,
  onClose,
  onConfirm,
}: {
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
}) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    await onConfirm();
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
        <p className="text-sm text-gray-800 dark:text-gray-100 mb-4">{message}</p>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 px-3 py-2 rounded-lg text-sm font-semibold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600">
            {t.cancel}
          </button>
          <button
            onClick={confirm}
            disabled={busy}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50 ${
              danger ? 'bg-red-500 hover:bg-red-600' : 'bg-indigo-500 hover:bg-indigo-600'
            }`}
          >
            {confirmLabel ?? t.accepted}
          </button>
        </div>
      </div>
    </div>
  );
}
