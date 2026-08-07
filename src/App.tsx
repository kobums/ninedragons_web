import { useState } from 'react';
import { GameSelection } from './components/GameSelection';
import { NineDragonsApp } from './components/NineDragonsApp';
import { NumberChangeApp } from './components/nc/NumberChangeApp';
import { DaVinciApp } from './components/dv/DaVinciApp';
import './App.css';

function App() {
  const [selectedGame, setSelectedGame] = useState<
    'ninedragons' | 'numberchange' | 'davinci' | null
  >(null);

  const handleSelectGame = (game: 'ninedragons' | 'numberchange' | 'davinci') => {
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

  if (selectedGame === 'davinci') {
    return <DaVinciApp onBack={handleBackToSelection} />;
  }

  return <GameSelection onSelectGame={handleSelectGame} />;
}

export default App;
