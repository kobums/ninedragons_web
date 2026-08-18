import { useEffect, useState } from 'react';
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
import { SpyfallApp } from './components/spyfall/SpyfallApp';
import type { GameId } from './config/games';
import { GAMES } from './config/games';
import './App.css';

// 경로 라우팅 (/tichu) — 브라우저/모바일 뒤로가기로 게임 선택에 돌아올 수
// 있고, 특정 게임 딥링크 공유도 된다. nginx 가 모든 경로를 index.html 로
// 돌려주므로(try_files) 새로고침·직접 진입에도 404 가 없다.
function gameFromPath(): GameId | null {
  const id = window.location.pathname.replace(/^\/+|\/+$/g, '');
  return id in GAMES ? (id as GameId) : null;
}

// 예전 해시 링크(#/tichu) 호환 — 공유된 링크가 깨지지 않게 경로로 승격한다
function migrateLegacyHash(): void {
  const id = window.location.hash.replace(/^#\/?/, '');
  if (id in GAMES) {
    window.history.replaceState(null, '', `/${id}`);
  }
}

function App() {
  const [selectedGame, setSelectedGame] = useState<GameId | null>(() => {
    migrateLegacyHash();
    return gameFromPath();
  });

  // 뒤로가기/앞으로가기를 상태에 반영한다
  useEffect(() => {
    const onPopState = () => setSelectedGame(gameFromPath());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const handleSelectGame = (game: GameId) => {
    // 히스토리 엔트리가 쌓여 뒤로가기가 게임 선택으로 돌아온다.
    // state 마킹으로 "선택 화면에서 들어왔음"을 기억한다 (딥링크와 구분).
    window.history.pushState({ fromSelection: true }, '', `/${game}`);
    setSelectedGame(game);
  };

  const handleBackToSelection = () => {
    if (window.history.state?.fromSelection) {
      // 선택 화면에서 들어온 경우 — 되감아 엔트리가 쌓이지 않게 한다
      window.history.back();
      return;
    }
    // 딥링크로 바로 들어온 경우 — 엔트리를 교체해 사이트 이탈을 막는다
    window.history.replaceState(null, '', '/');
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

  if (selectedGame === 'spyfall') {
    return <SpyfallApp onBack={handleBackToSelection} />;
  }

  return <GameSelection onSelectGame={handleSelectGame} />;
}

export default App;
