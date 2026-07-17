import { useState } from 'react';
import { StudyMeta } from '../../db/studiesApi';
import { useI18n } from '../../i18n';

interface StudyMetaModalProps {
  initial: StudyMeta | null;
  onClose: () => void;
  onSave: (meta: StudyMeta) => Promise<void> | void;
}

// Optional game metadata for a study — players, event, round, time control,
// date, result. Empty fields are dropped so `meta` stays `null` when unused.
export default function StudyMetaModal({ initial, onClose, onSave }: StudyMetaModalProps) {
  const { t } = useI18n();
  const [white, setWhite] = useState(initial?.players?.white ?? '');
  const [black, setBlack] = useState(initial?.players?.black ?? '');
  const [event, setEvent] = useState(initial?.event ?? '');
  const [round, setRound] = useState(initial?.round ?? '');
  const [timeControl, setTimeControl] = useState(initial?.timeControl ?? '');
  const [date, setDate] = useState(initial?.date ?? '');
  const [result, setResult] = useState(initial?.result ?? '');
  const [training, setTraining] = useState(initial?.training ?? false);
  const [busy, setBusy] = useState(false);

  const handleSave = async () => {
    if (busy) return;
    setBusy(true);
    const meta: StudyMeta = {};
    if (white.trim() || black.trim()) {
      meta.players = {};
      if (white.trim()) meta.players.white = white.trim();
      if (black.trim()) meta.players.black = black.trim();
    }
    if (event.trim()) meta.event = event.trim();
    if (round.trim()) meta.round = round.trim();
    if (timeControl.trim()) meta.timeControl = timeControl.trim();
    if (date.trim()) meta.date = date.trim();
    if (result.trim()) meta.result = result.trim();
    if (training) meta.training = true;
    try {
      await onSave(meta);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const field = (label: string, value: string, set: (v: string) => void, placeholder?: string) => (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">{label}</span>
      <input
        value={value}
        onChange={e => set(e.target.value)}
        placeholder={placeholder}
        className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
      />
    </label>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-3" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md p-4 md:p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">{t.studyMeta}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none">✕</button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {field(t.studyPlayer1, white, setWhite)}
          {field(t.studyPlayer2, black, setBlack)}
          {field(t.metaEvent, event, setEvent)}
          {field(t.metaRound, round, setRound)}
          {field(t.metaTimeControl, timeControl, setTimeControl, '5+5')}
          {field(t.metaDate, date, setDate, '2026-07-15')}
        </div>
        <div className="mt-3">{field(t.metaResult, result, setResult, '1–0 / ½–½ / 0–1')}</div>
        <label className="flex items-center gap-2 mt-3 cursor-pointer">
          <input type="checkbox" checked={training} onChange={e => setTraining(e.target.checked)} className="w-4 h-4 accent-indigo-500" />
          <span className="text-sm text-gray-700 dark:text-gray-200">🎯 {t.metaTraining}</span>
        </label>
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 px-3 py-2 rounded-lg text-sm font-semibold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600">
            {t.cancel}
          </button>
          <button onClick={handleSave} disabled={busy} className="flex-1 px-3 py-2 rounded-lg text-sm font-semibold bg-indigo-500 hover:bg-indigo-600 text-white disabled:opacity-50">
            {t.studySave}
          </button>
        </div>
      </div>
    </div>
  );
}
