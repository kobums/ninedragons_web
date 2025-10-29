import { useState } from 'react';
import { GameSelection } from './components/GameSelection';
import { NineDragonsApp } from './components/NineDragonsApp';
import { NumberChangeApp } from './components/nc/NumberChangeApp';
import './App.css';

function App() {
  const [selectedGame, setSelectedGame] = useState<'ninedragons' | 'numberchange' | null>(null);

  const handleSelectGame = (game: 'ninedragons' | 'numberchange') => {
    setSelectedGame(game);
  };

  const handleBackToSelection = () => {
    setSelectedGame(null);
  };

  if (selectedGame === 'ninedragons') {
    return <NineDragonsApp onBack={handleBackToSelection} />;
  }

  if (selectedGame === 'numberchange') {
    return <NumberChangeApp />;
  }

  return <GameSelection onSelectGame={handleSelectGame} />;
}

export default App;
