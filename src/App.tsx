import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useUIStore } from './store/uiStore';
import MainMenu from './components/Layout/MainMenu';
import GameScreen from './components/Layout/GameScreen';
import Rules from './components/Layout/Rules';
import { RoomScreen } from './components/Online/RoomScreen';
import MagicLinkPage from './components/Auth/MagicLinkPage';
import BlogList from './components/Blog/BlogList';
import BlogPostPage from './components/Blog/BlogPostPage';
import StudiesScreen from './components/Studies/StudiesScreen';
import ErrorBoundary from './components/UI/ErrorBoundary';

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
        <Routes>
          <Route path="/" element={<LocalApp />} />
          <Route path="/room/:roomId" element={<RoomScreen />} />
          <Route path="/magic" element={<MagicLinkPage />} />
          <Route path="/news" element={<BlogList />} />
          <Route path="/news/:slug" element={<BlogPostPage />} />
          <Route path="/studies" element={<StudiesScreen />} />
          <Route path="/studies/:owner/:slug" element={<StudiesScreen />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
