import { useUIStore } from './store/uiStore';
import MainMenu from './components/Layout/MainMenu';
import GameScreen from './components/Layout/GameScreen';
import Rules from './components/Layout/Rules';

function App() {
  const { screen } = useUIStore();
  
  return (
    <>
      {screen === 'menu' && <MainMenu />}
      {screen === 'game' && <GameScreen />}
      {screen === 'rules' && <Rules />}
    </>
  );
}

export default App;
