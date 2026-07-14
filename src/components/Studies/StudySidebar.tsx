import { useMemo, useState } from 'react';
import { useStudyStore } from '../../store/studyStore';
import { StudyTreeNode } from '../../db/studiesApi';
import { useI18n } from '../../i18n';

interface StudySidebarProps {
  currentId: number | null;
  onOpen: (slug: string) => void;
}

// Notion-like hierarchy of the author's own studies. Create child, rename,
// delete, and drag a node onto another to re-parent (drop on the header →
// top level). Content-free — bodies load on open.
export default function StudySidebar({ currentId, onOpen }: StudySidebarProps) {
  const { t } = useI18n();
  const { tree, expanded, toggleExpand, createStudy, renameStudy, deleteStudy, moveStudy } = useStudyStore();
  const [dragId, setDragId] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<number | 'root' | null>(null);

  // Group children by parent for O(1) recursive render.
  const byParent = useMemo(() => {
    const m = new Map<number | null, StudyTreeNode[]>();
    for (const n of tree) {
      const key = n.parentId;
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(n);
    }
    for (const arr of m.values()) arr.sort((a, b) => a.sort - b.sort);
    return m;
  }, [tree]);

  const handleCreate = async (parentId: number | null) => {
    const title = window.prompt(t.studyNewTitlePrompt);
    if (!title || !title.trim()) return;
    const r = await createStudy(parentId, title.trim());
    if (r) onOpen(r.slug);
  };

  const handleRename = async (n: StudyTreeNode) => {
    const title = window.prompt(t.studyRenamePrompt, n.title);
    if (!title || !title.trim() || title.trim() === n.title) return;
    await renameStudy(n.id, title.trim());
  };

  const handleDelete = async (n: StudyTreeNode) => {
    const kids = byParent.get(n.id)?.length ?? 0;
    const msg = kids > 0 ? t.studyDeleteWithChildren : t.studyDeleteConfirm;
    if (!window.confirm(msg)) return;
    await deleteStudy(n.id);
  };

  const handleDrop = async (targetId: number | null) => {
    const id = dragId;
    setDragId(null);
    setDropTarget(null);
    if (id == null || id === targetId) return;
    try {
      await moveStudy(id, targetId);
    } catch {
      /* server rejects cycles / bad parents — ignore, tree stays put */
    }
  };

  const renderNode = (n: StudyTreeNode, depth: number) => {
    const children = byParent.get(n.id) ?? [];
    const isOpen = expanded.has(n.id);
    const isSelected = n.id === currentId;
    return (
      <div key={n.id}>
        <div
          draggable
          onDragStart={() => setDragId(n.id)}
          onDragOver={(e) => { e.preventDefault(); setDropTarget(n.id); }}
          onDragLeave={() => setDropTarget(t => (t === n.id ? null : t))}
          onDrop={(e) => { e.preventDefault(); handleDrop(n.id); }}
          className={`group flex items-center gap-1 pr-1 rounded-md cursor-pointer transition-colors ${
            isSelected ? 'bg-indigo-100 dark:bg-indigo-900/40' : 'hover:bg-gray-100 dark:hover:bg-gray-700/50'
          } ${dropTarget === n.id ? 'ring-2 ring-indigo-400' : ''}`}
          style={{ paddingLeft: depth * 14 + 2 }}
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); if (children.length) toggleExpand(n.id); }}
            className={`w-4 h-5 flex items-center justify-center text-[10px] text-gray-400 flex-shrink-0 ${children.length ? '' : 'invisible'}`}
          >
            {isOpen ? '▼' : '▶'}
          </button>
          <button
            type="button"
            onClick={() => onOpen(n.slug)}
            className="flex-1 min-w-0 text-left py-1 text-sm text-gray-800 dark:text-gray-100 truncate flex items-center gap-1"
          >
            <span className="truncate">{n.title}</span>
            {n.isPublic && <span className="text-[9px] text-green-500 flex-shrink-0" title={t.studyPublic}>●</span>}
          </button>
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            <button type="button" title={t.studyNewChild} onClick={(e) => { e.stopPropagation(); handleCreate(n.id); }}
              className="w-5 h-5 flex items-center justify-center rounded text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600">+</button>
            <button type="button" title={t.studyRename} onClick={(e) => { e.stopPropagation(); handleRename(n); }}
              className="w-5 h-5 flex items-center justify-center rounded text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600 text-xs">✎</button>
            <button type="button" title={t.studyDelete} onClick={(e) => { e.stopPropagation(); handleDelete(n); }}
              className="w-5 h-5 flex items-center justify-center rounded text-red-500 hover:bg-red-100 dark:hover:bg-red-900/40 text-xs">✕</button>
          </div>
        </div>
        {isOpen && children.map(c => renderNode(c, depth + 1))}
      </div>
    );
  };

  const roots = byParent.get(null) ?? [];

  return (
    <div className="flex flex-col h-full">
      <div
        className={`flex items-center justify-between px-2 py-2 border-b border-gray-200 dark:border-gray-700 ${
          dropTarget === 'root' ? 'ring-2 ring-indigo-400 rounded-md' : ''
        }`}
        onDragOver={(e) => { e.preventDefault(); setDropTarget('root'); }}
        onDragLeave={() => setDropTarget(t => (t === 'root' ? null : t))}
        onDrop={(e) => { e.preventDefault(); handleDrop(null); }}
      >
        <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{t.myStudies}</span>
        <button
          type="button"
          onClick={() => handleCreate(null)}
          className="px-2 py-1 rounded-md text-sm font-semibold bg-indigo-500 hover:bg-indigo-600 text-white"
        >
          + {t.studyNew}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-1 px-1">
        {roots.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500 px-2 py-4">{t.studyEmpty}</p>
        ) : (
          roots.map(n => renderNode(n, 0))
        )}
      </div>
    </div>
  );
}
