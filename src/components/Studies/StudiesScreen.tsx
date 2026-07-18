import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useNavigate, useParams } from 'react-router-dom';
import StudySidebar from './StudySidebar';
import StudyBoardViewer from './StudyBoardViewer';
import PositionEditorModal from './PositionEditorModal';
import ImportStudyModal from './ImportStudyModal';
import TextInputModal from './TextInputModal';
import StudyMetaModal from './StudyMetaModal';
import { useStudyStore } from '../../store/studyStore';
import { zipToState } from '../../game/zip';
import { zenToTree } from '../../game/zen';
import { GameState } from '../../game/types';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import { useI18n } from '../../i18n';

export default function StudiesScreen() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { owner, slug } = useParams<{ owner: string; slug: string }>();
  const { user } = useAuthStore();
  const { setScreen } = useUIStore();
  const {
    current, currentLoading, error, publicStudies, tree,
    loadTree, openStudy, loadPublic, cloneStudy, setPublic, changeSlug, renameStudy, createStudy, createStudyFromState, createStudyFromGame, saveStudyTree, setMeta, expand,
  } = useStudyStore();
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const [landingTab, setLandingTab] = useState<'all' | 'mine'>('all');
  const [showEditor, setShowEditor] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showMeta, setShowMeta] = useState(false);
  // Parent for a new blank study: number | null while the modal is open, undefined when closed.
  const [newParent, setNewParent] = useState<number | null | undefined>(undefined);
  const [renameOpen, setRenameOpen] = useState(false);
  const [slugOpen, setSlugOpen] = useState(false);

  const handleNewStudy = async (title: string) => {
    const parentId = newParent ?? null;
    const r = await createStudy(parentId, title);
    setNewParent(undefined);
    if (parentId != null) expand(parentId);
    if (r) navigate(`/studies/${encodeURIComponent(r.ownerName)}/${encodeURIComponent(r.slug)}`);
  };

  const handleCreateFromPosition = async (title: string, state: GameState) => {
    const r = await createStudyFromState(title, state);
    setShowEditor(false);
    if (r) navigate(`/studies/${encodeURIComponent(r.ownerName)}/${encodeURIComponent(r.slug)}`);
  };

  // Import a ZEN game or a ZIP position as a new study. Returns false on parse
  // failure so the modal can show an error.
  const handleImport = async (text: string, title: string): Promise<boolean> => {
    try {
      let r;
      if (/\[\w+\s+"/.test(text)) {
        const { startState, root, meta } = zenToTree(text);
        r = await createStudyFromGame(title || meta.Event || 'Imported game', startState, root);
      } else {
        r = await createStudyFromState(title || 'Imported position', zipToState(text));
      }
      if (!r) return false;
      setShowImport(false);
      navigate(`/studies/${encodeURIComponent(r.ownerName)}/${encodeURIComponent(r.slug)}`);
      return true;
    } catch {
      return false;
    }
  };

  useEffect(() => { if (user) loadTree(); loadPublic(); }, [user, loadTree, loadPublic]);

  useEffect(() => {
    if (owner && slug) { openStudy(owner, slug); setMobileSidebar(false); }
  }, [owner, slug, openStudy]);

  const goBack = () => { setScreen('menu'); navigate('/'); };
  const open = (s: string) => navigate(`/studies/${encodeURIComponent(user?.username || owner || '')}/${encodeURIComponent(s)}`);

  const handleClone = async () => {
    if (!current) return;
    const r = await cloneStudy(current.id);
    if (r) navigate(`/studies/${encodeURIComponent(r.ownerName)}/${encodeURIComponent(r.slug)}`);
  };

  const handleEditSlug = () => { if (current) setSlugOpen(true); };
  const submitSlug = async (next: string) => {
    if (!current || next === current.slug) { setSlugOpen(false); return; }
    const newSlug = await changeSlug(current.id, next);
    setSlugOpen(false);
    if (newSlug) navigate(`/studies/${encodeURIComponent(current.ownerName)}/${encodeURIComponent(newSlug)}`);
  };

  const handleRename = () => { if (current) setRenameOpen(true); };
  const submitRename = async (title: string) => {
    if (current && title !== current.title) await renameStudy(current.id, title);
    setRenameOpen(false);
  };

  const cardClass = 'text-left p-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-indigo-400 transition-colors';
  const emptyMsg = <p className="text-sm text-gray-400 dark:text-gray-500">{t.studyEmpty}</p>;

  const publicGrid = publicStudies.length === 0 ? emptyMsg : (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {publicStudies.map(s => (
        <button key={s.id} onClick={() => navigate(`/studies/${encodeURIComponent(s.ownerName)}/${encodeURIComponent(s.slug)}`)} className={cardClass}>
          <div className="font-semibold text-gray-800 dark:text-gray-100 truncate">{s.title}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {s.ownerCountry && <span className="mr-1">{s.ownerCountry}</span>}
            {s.ownerName} · {s.boardSize}
          </div>
        </button>
      ))}
    </div>
  );

  const myGrid = tree.length === 0 ? emptyMsg : (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {tree.map(s => (
        <button key={s.id} onClick={() => open(s.slug)} className={cardClass}>
          <div className="font-semibold text-gray-800 dark:text-gray-100 truncate flex items-center gap-1">
            <span className="truncate">{s.title}</span>
            {s.isPublic && <span className="text-[10px] text-green-500 flex-shrink-0">●</span>}
          </div>
        </button>
      ))}
    </div>
  );

  return (
    <div className="h-screen h-[100dvh] flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-2 bg-white dark:bg-gray-800 shadow-sm flex-shrink-0">
        <button onClick={goBack} className="text-lg font-bold text-gray-900 dark:text-white hover:opacity-70">← ZERTZ</button>
        <span className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{t.studies}</span>
        {user && (
          <button
            onClick={() => { if (mobileSidebar) setLandingTab('all'); setMobileSidebar(v => !v); }}
            className="lg:hidden ml-auto px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-700 text-sm text-gray-700 dark:text-gray-200"
          >
            {mobileSidebar ? `📖 ${t.studiesAll}` : `☰ ${t.myStudies}`}
          </button>
        )}
      </header>

      <div className="flex-1 min-h-0 flex">
        {/* Sidebar (author's hierarchy) */}
        {user && (
          <aside className={`${mobileSidebar ? 'flex' : 'hidden'} lg:flex w-full lg:w-72 flex-shrink-0 flex-col bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700`}>
            <StudySidebar currentId={current?.id ?? null} onOpen={open} onNew={setNewParent} onNewFromPosition={() => setShowEditor(true)} />
          </aside>
        )}

        {/* Content */}
        <main className={`${mobileSidebar ? 'hidden' : 'flex'} lg:flex flex-1 min-w-0 flex-col overflow-y-auto`}>
          {owner && slug ? (
            currentLoading ? (
              <div className="flex-1 flex items-center justify-center text-gray-400">…</div>
            ) : error === 'notFound' || !current ? (
              <div className="flex-1 flex items-center justify-center text-gray-400">{t.studyNotFound}</div>
            ) : (
              <div className="max-w-5xl w-full mx-auto p-4 md:p-6">
                <button
                  onClick={() => navigate('/studies')}
                  className="mb-3 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  {t.studiesBack}
                </button>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white break-words">{current.title}</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                      {t.studyBy} {current.ownerName}
                      {current.isPublic && <span className="ml-2 text-green-600 dark:text-green-400">● {t.studyPublic}</span>}
                    </p>
                  </div>
                  {!current.isOwner && user && (
                    <button onClick={handleClone} className="flex-shrink-0 px-3 py-1.5 rounded-lg text-sm font-semibold bg-indigo-500 hover:bg-indigo-600 text-white">
                      ⑂ {t.studyClone}
                    </button>
                  )}
                </div>

                {/* Owner settings */}
                {current.isOwner && (
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    <button onClick={handleRename} className="px-2.5 py-1 rounded-md text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600">✎ {t.studyRename}</button>
                    <button onClick={handleEditSlug} className="px-2.5 py-1 rounded-md text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600">🔗 {current.slug}</button>
                    <button onClick={() => setPublic(current.id, !current.isPublic)} className={`px-2.5 py-1 rounded-md text-xs font-medium ${current.isPublic ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200'}`}>
                      {current.isPublic ? t.studyMakePrivate : t.studyMakePublic}
                    </button>
                    <button onClick={() => setShowMeta(true)} className="px-2.5 py-1 rounded-md text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600">
                      🏷 {t.studyMeta}
                    </button>
                  </div>
                )}

                {/* Meta */}
                {current.meta && Object.keys(current.meta).length > 0 && (
                  <div className="mt-3 text-sm text-gray-600 dark:text-gray-300 flex flex-wrap gap-x-4 gap-y-1">
                    {current.meta.players?.white && <span>⚪ {current.meta.players.white}</span>}
                    {current.meta.players?.black && <span>⚫ {current.meta.players.black}</span>}
                    {current.meta.event && <span>🏆 {current.meta.event}</span>}
                    {current.meta.timeControl && <span>⏱ {current.meta.timeControl}</span>}
                  </div>
                )}

                {current.rootComment && (
                  <div className="mt-4 prose prose-sm md:prose-base dark:prose-invert max-w-none">
                    <ReactMarkdown>{current.rootComment}</ReactMarkdown>
                  </div>
                )}

                {/* Board viewer — interactive; author can save moves */}
                <StudyBoardViewer study={current} onSaveTree={(treeJson) => saveStudyTree(current.id, treeJson)} />

                {/* Sub-studies */}
                {current.children.length > 0 && (
                  <div className="mt-5">
                    <h2 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">{t.studyChildren}</h2>
                    <div className="flex flex-col gap-1">
                      {current.children.map(c => (
                        <button key={c.id} onClick={() => navigate(`/studies/${encodeURIComponent(current.ownerName)}/${encodeURIComponent(c.slug)}`)}
                          className="text-left px-3 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-indigo-400 text-sm text-gray-800 dark:text-gray-100">
                          {c.title}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          ) : (
            /* Landing: public studies */
            <div className="max-w-3xl w-full mx-auto p-4 md:p-6">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t.studies}</h1>
              <p className="text-gray-500 dark:text-gray-400 mt-1">{t.studyWelcome}</p>
              {!user && <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">🔒 {t.loginToCreateStudies}</p>}
              {user && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => setNewParent(null)}
                    className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-indigo-500 hover:bg-indigo-600 text-white"
                  >
                    + {t.studyNew}
                  </button>
                  <button
                    onClick={() => setShowEditor(true)}
                    className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600"
                  >
                    ⊞ {t.studyNewFromPosition}
                  </button>
                  <button
                    onClick={() => setShowImport(true)}
                    className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600"
                  >
                    ⤓ {t.studyImport}
                  </button>
                </div>
              )}

              {user ? (
                <>
                  <div className="flex gap-1 mt-6 mb-3 border-b border-gray-200 dark:border-gray-700">
                    {(['all', 'mine'] as const).map(tab => (
                      <button
                        key={tab}
                        onClick={() => setLandingTab(tab)}
                        className={`px-3 py-1.5 text-sm font-semibold -mb-px border-b-2 ${
                          landingTab === tab
                            ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                            : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                        }`}
                      >
                        {tab === 'all' ? t.studiesAll : t.myStudies}
                      </button>
                    ))}
                  </div>
                  {landingTab === 'all' ? publicGrid : myGrid}
                </>
              ) : (
                <>
                  <h2 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mt-6 mb-2">{t.publicStudies}</h2>
                  {publicGrid}
                </>
              )}
            </div>
          )}
        </main>
      </div>

      {showEditor && (
        <PositionEditorModal onClose={() => setShowEditor(false)} onCreate={handleCreateFromPosition} />
      )}
      {showImport && (
        <ImportStudyModal onClose={() => setShowImport(false)} onImport={handleImport} />
      )}
      {newParent !== undefined && (
        <TextInputModal
          title={t.studyNew}
          placeholder={t.studyNewTitlePrompt}
          onClose={() => setNewParent(undefined)}
          onSubmit={handleNewStudy}
        />
      )}
      {renameOpen && current && (
        <TextInputModal
          title={t.studyRename}
          initialValue={current.title}
          onClose={() => setRenameOpen(false)}
          onSubmit={submitRename}
        />
      )}
      {slugOpen && current && (
        <TextInputModal
          title={t.studySlugPrompt}
          initialValue={current.slug}
          onClose={() => setSlugOpen(false)}
          onSubmit={submitSlug}
        />
      )}
      {showMeta && current && (
        <StudyMetaModal
          initial={current.meta}
          onClose={() => setShowMeta(false)}
          onSave={(meta) => setMeta(current.id, meta)}
        />
      )}
    </div>
  );
}
