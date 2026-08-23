import { useEffect } from 'react';
import { useReconnectingWebSocket } from '../hooks/useReconnectingWebSocket';
import { GAMES } from '../config/games';
import { buildWsUrl } from '../utils/ws';
import { useGameState } from '../hooks/useGameState';
import { WaitingRoom } from './WaitingRoom';
import { GameBoard } from './GameBoard';
import { GameOver } from './GameOver';
import { ConnectionBanner } from './ConnectionBanner';
import { ErrorToast } from './ErrorToast';
import { ConnectingScreen } from './ConnectingScreen';
import { GameInfoButton } from './GameInfoButton';
import type { Message, PlayerColor } from '../types/game';
import { ND_SESSION_KEY, getSessionId } from '../utils/session';


interface NineDragonsAppProps {
  onBack: () => void;
}

export function NineDragonsApp({ onBack }: NineDragonsAppProps) {
  const { isConnected, lastMessage, sendMessage } = useReconnectingWebSocket<Message>(buildWsUrl(GAMES.ninedragons.wsPath), {
    logPrefix: GAMES.ninedragons.logPrefix,
    onOpen: () => {
      // 진행 중이던 게임이 있으면 세션 ID로 복귀를 시도한다
      const sessionId = getSessionId(ND_SESSION_KEY);
      if (sessionId) {
        sendMessage({ type: 'rejoin_game', payload: { sessionId } });
      }
    },
  });
  const { gameState, playTile, resetGame, isMyTurn, clearError } =
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

  const handleJoinGame = (playerName: string, color?: PlayerColor, vsBot?: boolean) => {
    console.log('[NineDragons] Joining game with:', playerName, color, { vsBot });
    sendMessage({
      type: 'join_game',
      payload: {
        name: playerName,
        color,
        vsBot,
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


  // 게임 시작 전에만 전체 화면 연결 대기 표시
  // 게임 중 끊김은 화면을 유지한 채 배너로 알리고 자동 재접속을 기다린다
  if (!isConnected && !gameState.isGameStarted) {
    return <ConnectingScreen />;
  }

  console.log('[NineDragons] Rendering decision:', {
    showWaitingRoom: !gameState.isGameStarted,
    showGameBoard: gameState.isGameStarted && !gameState.isGameOver,
    showGameOver: gameState.isGameOver,
  });

  return (
    <div className="app mood-cream">
      <ConnectionBanner
        isConnected={isConnected}
        opponentDisconnected={gameState.opponentDisconnected}
        isGameActive={gameState.isGameStarted && !gameState.isGameOver}
      />
      <ErrorToast error={gameState.error} onClear={clearError} />
      <GameInfoButton game="ninedragons" />

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
          rematchOffered={gameState.rematchOffered}
          onRematch={() => sendMessage({ type: 'rematch' })}
        />
      )}
    </div>
  );
}
