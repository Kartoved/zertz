import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GameState } from '../../game/types';
import { StudyTreeNode } from '../../db/studiesApi';
import { useAuthStore } from '../../store/authStore';
import { useStudyStore } from '../../store/studyStore';
import { useI18n } from '../../i18n';

// Flattens the hierarchy into an indented list for the parent <select>.
function flattenTree(nodes: StudyTreeNode[]): { id: number; title: string; depth: number }[] {
  const byParent = new Map<number | null, StudyTreeNode[]>();
  for (const n of nodes) {
    if (!byParent.has(n.parentId)) byParent.set(n.parentId, []);
    byParent.get(n.parentId)!.push(n);
  }
  for (const arr of byParent.values()) arr.sort((a, b) => a.sort - b.sort);
  const out: { id: number; title: string; depth: number }[] = [];
  const walk = (parent: number | null, depth: number) => {
    for (const n of byParent.get(parent) ?? []) { out.push({ id: n.id, title: n.title, depth }); walk(n.id, depth + 1); }
  };
  walk(null, 0);
  return out;
}

// Captures the given board position into a new study (optionally nested under an
// existing one). Used from game/analysis views — one click to turn any position
// into a lesson. Renders nothing for guests.
export default function SaveToStudy({ state, className }: { state: GameState; className?: string }) {
  const { t } = useI18n();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { tree, loadTree, createStudyFromState } = useStudyStore();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [parentId, setParentId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  if (!user) return null;

  const openModal = async () => { await loadTree(); setTitle(''); setParentId(null); setOpen(true); };

  const save = async () => {
    if (!title.trim() || busy) return;
    setBusy(true);
    try {
      const r = await createStudyFromState(title.trim(), state, parentId);
      setOpen(false);
      if (r) navigate(`/studies/${encodeURIComponent(r.ownerName)}/${encodeURIComponent(r.slug)}`);
    } finally { setBusy(false); }
  };

  const options = flattenTree(tree);

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className={className ?? 'w-full px-3 py-1.5 text-sm rounded-lg bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-200 hover:bg-indigo-200 dark:hover:bg-indigo-900/70 transition-colors'}
      >
        📚 {t.saveToStudy}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-3" onClick={() => setOpen(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm p-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3">📚 {t.saveToStudy}</h2>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={t.studyNewTitlePrompt}
              autoFocus
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white mb-3"
            />
            <label className="flex flex-col gap-1 mb-4">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">{t.saveToStudyParent}</span>
              <select
                value={parentId ?? ''}
                onChange={e => setParentId(e.target.value ? Number(e.target.value) : null)}
                className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
              >
                <option value="">{t.saveToStudyRoot}</option>
                {options.map(o => <option key={o.id} value={o.id}>{'— '.repeat(o.depth)}{o.title}</option>)}
              </select>
            </label>
            <div className="flex gap-2">
              <button onClick={() => setOpen(false)} className="flex-1 px-3 py-2 rounded-lg text-sm font-semibold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600">
                {t.cancel}
              </button>
              <button onClick={save} disabled={!title.trim() || busy} className="flex-1 px-3 py-2 rounded-lg text-sm font-semibold bg-indigo-500 hover:bg-indigo-600 text-white disabled:opacity-50">
                {t.studySave}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
