import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useUIStore } from './store/uiStore';
import MainMenu from './components/Layout/MainMenu';
import GameScreen from './components/Layout/GameScreen';
import Rules from './components/Layout/Rules';
import { RoomScreen } from './components/Online/RoomScreen';
import MagicLinkPage from './components/Auth/MagicLinkPage';

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
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LocalApp />} />
        <Route path="/room/:roomId" element={<RoomScreen />} />
        <Route path="/magic" element={<MagicLinkPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
