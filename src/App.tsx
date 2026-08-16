import { useState } from 'react';
import { GameSelection } from './components/GameSelection';
import { NineDragonsApp } from './components/NineDragonsApp';
import { NumberChangeApp } from './components/nc/NumberChangeApp';
import { DaVinciApp } from './components/dv/DaVinciApp';
import { SchottenTottenApp } from './components/st/SchottenTottenApp';
import { JekyllHydeApp } from './components/jh/JekyllHydeApp';
import { GeisterApp } from './components/gs/GeisterApp';
import { QuoridorApp } from './components/qd/QuoridorApp';
import { OnitamaApp } from './components/ot/OnitamaApp';
import { LostCitiesApp } from './components/lc/LostCitiesApp';
import { CantStopApp } from './components/cs/CantStopApp';
import { TichuApp } from './components/tichu/TichuApp';
import { MightyApp } from './components/mighty/MightyApp';
import { SkyfallApp } from './components/skyfall/SkyfallApp';
import type { GameId } from './config/games';
import './App.css';

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

  if (selectedGame === 'geister') {
    return <GeisterApp onBack={handleBackToSelection} />;
  }

  if (selectedGame === 'quoridor') {
    return <QuoridorApp onBack={handleBackToSelection} />;
  }

  if (selectedGame === 'onitama') {
    return <OnitamaApp onBack={handleBackToSelection} />;
  }

  if (selectedGame === 'lostcities') {
    return <LostCitiesApp onBack={handleBackToSelection} />;
  }

  if (selectedGame === 'cantstop') {
    return <CantStopApp onBack={handleBackToSelection} />;
  }

  if (selectedGame === 'tichu') {
    return <TichuApp onBack={handleBackToSelection} />;
  }

  if (selectedGame === 'mighty') {
    return <MightyApp onBack={handleBackToSelection} />;
  }

  if (selectedGame === 'skyfall') {
    return <SkyfallApp onBack={handleBackToSelection} />;
  }

  return <GameSelection onSelectGame={handleSelectGame} />;
}

export default App;
