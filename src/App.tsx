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
import { AvalonApp } from './components/avalon/AvalonApp';
import { LoveLetterApp } from './components/loveletter/LoveLetterApp';
import { OmokApp } from './components/omok/OmokApp';
import { SkullApp } from './components/skull/SkullApp';
import { CodenamesApp } from './components/codenames/CodenamesApp';
import { YachtApp } from './components/yacht/YachtApp';
import { IndianPokerApp } from './components/indianpoker/IndianPokerApp';
import { NoThanksApp } from './components/nothanks/NoThanksApp';
import { LasVegasApp } from './components/lasvegas/LasVegasApp';
import { CoupApp } from './components/coup/CoupApp';
import { NimmtApp } from './components/nimmt/NimmtApp';
import { CiaoCiaoApp } from './components/ciaociao/CiaoCiaoApp';
import { CockroachApp } from './components/cockroach/CockroachApp';
import { InsiderApp } from './components/insider/InsiderApp';
import { DalmutiApp } from './components/dalmuti/DalmutiApp';
import { KrakenApp } from './components/kraken/KrakenApp';
import { SkullKingApp } from './components/skullking/SkullKingApp';
import { CrewApp } from './components/crew/CrewApp';
import { RecordsPage } from './components/records/RecordsPage';
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

// /records 특수 페이지 — 게임이 아니라 gameFromPath 와 별도로 판별한다
function isRecordsPath(): boolean {
  return window.location.pathname.replace(/^\/+|\/+$/g, '') === 'records';
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
  const [showRecords, setShowRecords] = useState<boolean>(() => isRecordsPath());

  // 뒤로가기/앞으로가기를 상태에 반영한다
  useEffect(() => {
    const onPopState = () => {
      setSelectedGame(gameFromPath());
      setShowRecords(isRecordsPath());
    };
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

  // 전적 페이지 — 게임 선택과 같은 pushState/뒤로가기 결
  const handleOpenRecords = () => {
    window.history.pushState({ fromSelection: true }, '', '/records');
    setShowRecords(true);
  };

  const handleBackFromRecords = () => {
    if (window.history.state?.fromSelection) {
      window.history.back();
      return;
    }
    window.history.replaceState(null, '', '/');
    setShowRecords(false);
  };

  if (showRecords) {
    return <RecordsPage onBack={handleBackFromRecords} />;
  }

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

  if (selectedGame === 'loveletter') {
    return <LoveLetterApp onBack={handleBackToSelection} />;
  }

  if (selectedGame === 'omok') {
    return <OmokApp onBack={handleBackToSelection} />;
  }

  if (selectedGame === 'skull') {
    return <SkullApp onBack={handleBackToSelection} />;
  }

  if (selectedGame === 'codenames') {
    return <CodenamesApp onBack={handleBackToSelection} />;
  }

  if (selectedGame === 'yacht') {
    return <YachtApp onBack={handleBackToSelection} />;
  }

  if (selectedGame === 'indianpoker') {
    return <IndianPokerApp onBack={handleBackToSelection} />;
  }

  if (selectedGame === 'nothanks') {
    return <NoThanksApp onBack={handleBackToSelection} />;
  }

  if (selectedGame === 'lasvegas') {
    return <LasVegasApp onBack={handleBackToSelection} />;
  }

  if (selectedGame === 'coup') {
    return <CoupApp onBack={handleBackToSelection} />;
  }

  if (selectedGame === 'nimmt') {
    return <NimmtApp onBack={handleBackToSelection} />;
  }

  if (selectedGame === 'ciaociao') {
    return <CiaoCiaoApp onBack={handleBackToSelection} />;
  }

  if (selectedGame === 'cockroach') {
    return <CockroachApp onBack={handleBackToSelection} />;
  }

  if (selectedGame === 'insider') {
    return <InsiderApp onBack={handleBackToSelection} />;
  }

  if (selectedGame === 'dalmuti') {
    return <DalmutiApp onBack={handleBackToSelection} />;
  }

  if (selectedGame === 'kraken') {
    return <KrakenApp onBack={handleBackToSelection} />;
  }

  if (selectedGame === 'skullking') {
    return <SkullKingApp onBack={handleBackToSelection} />;
  }

  if (selectedGame === 'crew') {
    return <CrewApp onBack={handleBackToSelection} />;
  }

  if (selectedGame === 'avalon') {
    return <AvalonApp onBack={handleBackToSelection} />;
  }

  return (
    <GameSelection
      onSelectGame={handleSelectGame}
      onOpenRecords={handleOpenRecords}
    />
  );
}

export default App;
