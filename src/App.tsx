import { useState } from 'react';
import { GameSelection } from './components/GameSelection';
import { NineDragonsApp } from './components/NineDragonsApp';
import { NumberChangeApp } from './components/nc/NumberChangeApp';
import { DaVinciApp } from './components/dv/DaVinciApp';
import { SchottenTottenApp } from './components/st/SchottenTottenApp';
import { JekyllHydeApp } from './components/jh/JekyllHydeApp';
import './App.css';

type GameId =
  | 'ninedragons'
  | 'numberchange'
  | 'davinci'
  | 'schottentotten'
  | 'jekyllhyde';

function App() {
  const [selectedGame, setSelectedGame] = useState<GameId | null>(null);

  const handleSelectGame = (game: GameId) => {
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

  if (selectedGame === 'schottentotten') {
    return <SchottenTottenApp onBack={handleBackToSelection} />;
  }

  if (selectedGame === 'jekyllhyde') {
    return <JekyllHydeApp onBack={handleBackToSelection} />;
  }

  return <GameSelection onSelectGame={handleSelectGame} />;
}

export default App;
