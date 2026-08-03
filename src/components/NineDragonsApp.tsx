import { useEffect } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import { useGameState } from '../hooks/useGameState';
import { WaitingRoom } from './WaitingRoom';
import { GameBoard } from './GameBoard';
import { GameOver } from './GameOver';
import { ConnectionBanner } from './ConnectionBanner';
import type { PlayerColor } from '../types/game';
import { ND_SESSION_KEY, getSessionId } from '../utils/session';

// 로컬 개발 시에는 로컬 서버, 그 외에는 배포 서버(wss 고정)로 접속
// 배포 도메인은 http(80)로 붙으면 301 리다이렉트라 WebSocket 핸드셰이크가 실패한다
const isLocalHost =
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1';
const WS_URL = isLocalHost
  ? 'ws://localhost:8003/ws'
  : 'wss://ninedragonsapi.gowoobro.com/ws';

interface NineDragonsAppProps {
  onBack: () => void;
}

export function NineDragonsApp({ onBack }: NineDragonsAppProps) {
  const { isConnected, lastMessage, sendMessage } = useWebSocket(WS_URL, {
    onOpen: () => {
      // 진행 중이던 게임이 있으면 세션 ID로 복귀를 시도한다
      const sessionId = getSessionId(ND_SESSION_KEY);
      if (sessionId) {
        sendMessage({ type: 'rejoin_game', payload: { sessionId } });
      }
    },
  });
  const { gameState, playTile, resetGame, isMyTurn } =
    useGameState(lastMessage);

  useEffect(() => {
    console.log('[NineDragons] === Game state updated ===', {
      isGameStarted: gameState.isGameStarted,
      isWaiting: gameState.isWaiting,
      yourColor: gameState.yourColor,
      gameId: gameState.gameId,
      currentRound: gameState.currentRound,
      currentPlayer: gameState.currentPlayer,
    });
  }, [gameState]);

  const handleJoinGame = (playerName: string, color?: PlayerColor) => {
    console.log('[NineDragons] Joining game with:', playerName, color);
    sendMessage({
      type: 'join_game',
      payload: {
        playerName,
        color,
      },
    });
  };

  const handleTileClick = (tile: number) => {
    if (!isMyTurn()) return;

    sendMessage({
      type: 'play_tile',
      payload: {
        tile,
      },
    });

    playTile(tile);
  };

  const handlePlayAgain = () => {
    resetGame();
    onBack();
  };

  useEffect(() => {
    if (gameState.error) {
      alert(gameState.error);
    }
  }, [gameState.error]);

  // 게임 시작 전에만 전체 화면 연결 대기 표시
  // 게임 중 끊김은 화면을 유지한 채 배너로 알리고 자동 재접속을 기다린다
  if (!isConnected && !gameState.isGameStarted) {
    return (
      <div className="app">
        <div className="connecting">서버에 연결 중...</div>
      </div>
    );
  }

  console.log('[NineDragons] Rendering decision:', {
    showWaitingRoom: !gameState.isGameStarted,
    showGameBoard: gameState.isGameStarted && !gameState.isGameOver,
    showGameOver: gameState.isGameOver,
  });

  return (
    <div className="app">
      <ConnectionBanner
        isConnected={isConnected}
        opponentDisconnected={gameState.opponentDisconnected}
        isGameActive={gameState.isGameStarted && !gameState.isGameOver}
      />

      {!gameState.isGameStarted && (
        <WaitingRoom
          onJoinGame={handleJoinGame}
          isWaiting={gameState.isWaiting}
          hasJoined={gameState.yourColor !== null}
        />
      )}

      {gameState.isGameStarted && !gameState.isGameOver && (
        <GameBoard
          gameState={gameState}
          onTileClick={handleTileClick}
          isMyTurn={isMyTurn()}
        />
      )}

      {gameState.isGameOver && (
        <GameOver
          winner={gameState.winner}
          blueWins={gameState.blueWins}
          redWins={gameState.redWins}
          blueName={gameState.blueName}
          redName={gameState.redName}
          yourColor={gameState.yourColor}
          roundHistory={gameState.roundHistory}
          onPlayAgain={handlePlayAgain}
        />
      )}
    </div>
  );
}
