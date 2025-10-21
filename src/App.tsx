import { useEffect } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import { useGameState } from './hooks/useGameState';
import { WaitingRoom } from './components/WaitingRoom';
import { GameBoard } from './components/GameBoard';
import { GameOver } from './components/GameOver';
import type { PlayerColor } from './types/game';
import './App.css';

const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const WS_URL = `${protocol}//ninedragonsapi.gowoobro.com/ws`;
// const WS_URL = `${protocol}//localhost:8003/ws`;

function App() {
  const { isConnected, lastMessage, sendMessage } = useWebSocket(WS_URL);
  const { gameState, playTile, resetGame, isMyTurn } =
    useGameState(lastMessage);

  useEffect(() => {
    console.log('=== Game state updated ===', {
      isGameStarted: gameState.isGameStarted,
      isWaiting: gameState.isWaiting,
      yourColor: gameState.yourColor,
      gameId: gameState.gameId,
      currentRound: gameState.currentRound,
      currentPlayer: gameState.currentPlayer,
    });
  }, [gameState]);

  const handleJoinGame = (playerName: string, color?: PlayerColor) => {
    console.log('Joining game with:', playerName, color);
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
    window.location.reload();
  };

  useEffect(() => {
    if (gameState.error) {
      alert(gameState.error);
    }
  }, [gameState.error]);

  if (!isConnected) {
    return (
      <div className="app">
        <div className="connecting">서버에 연결 중...</div>
      </div>
    );
  }

  // 렌더링 조건 로깅
  console.log('Rendering decision:', {
    showWaitingRoom: !gameState.isGameStarted,
    showGameBoard: gameState.isGameStarted && !gameState.isGameOver,
    showGameOver: gameState.isGameOver,
  });

  return (
    <div className="app">
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
          yourColor={gameState.yourColor}
          roundHistory={gameState.roundHistory}
          onPlayAgain={handlePlayAgain}
        />
      )}
    </div>
  );
}

export default App;
