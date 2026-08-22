import { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useUIStore } from './store/uiStore';
import MainMenu from './components/Layout/MainMenu';
import ErrorBoundary from './components/UI/ErrorBoundary';

// Route-level code splitting: only the landing (MainMenu) ships in the initial
// bundle. Heavy screens — the local game, online room, studies (react-markdown),
// blog (react-markdown), rules — load on demand, so the first paint stays lean.
const GameScreen = lazy(() => import('./components/Layout/GameScreen'));
const Rules = lazy(() => import('./components/Layout/Rules'));
const RoomScreen = lazy(() => import('./components/Online/RoomScreen').then(m => ({ default: m.RoomScreen })));
const MagicLinkPage = lazy(() => import('./components/Auth/MagicLinkPage'));
const BlogList = lazy(() => import('./components/Blog/BlogList'));
const BlogPostPage = lazy(() => import('./components/Blog/BlogPostPage'));
const StudiesScreen = lazy(() => import('./components/Studies/StudiesScreen'));

function ScreenFallback() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
    </div>
  );
}

function LocalApp() {
  const { screen, initPush } = useUIStore();

  useEffect(() => {
    initPush();
  }, []);

  return (
    <>
      {screen === 'menu' && <MainMenu />}
      {screen === 'game' && <GameScreen />}
      {screen === 'rules' && <Rules />}
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Suspense fallback={<ScreenFallback />}>
          <Routes>
            <Route path="/" element={<LocalApp />} />
            <Route path="/room/:roomId" element={<RoomScreen />} />
            <Route path="/magic" element={<MagicLinkPage />} />
            <Route path="/news" element={<BlogList />} />
            <Route path="/news/:slug" element={<BlogPostPage />} />
            <Route path="/studies" element={<StudiesScreen />} />
            <Route path="/studies/:owner/:slug" element={<StudiesScreen />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
