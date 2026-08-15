import { useReconnectingWebSocket } from '../../hooks/useReconnectingWebSocket';
import { GAMES } from '../../config/games';
import { buildWsUrl } from '../../utils/ws';
import { useQDGameState } from '../../hooks/useQDGameState';
import { QDWaitingRoom } from './QDWaitingRoom';
import { QDBoard } from './QDBoard';
import { QDGameOver } from './QDGameOver';
import { ConnectionBanner } from '../ConnectionBanner';
import { ConnectingScreen } from '../ConnectingScreen';
import { GameInfoButton } from '../GameInfoButton';
import { ErrorToast } from '../ErrorToast';
import type { QDCell, QDMessage, QDWall } from '../../types/quoridor';
import { getSessionId } from '../../utils/session';

interface QuoridorAppProps {
  onBack: () => void;
}

export function QuoridorApp({ onBack }: QuoridorAppProps) {
  const { isConnected, lastMessage, sendMessage } = useReconnectingWebSocket<QDMessage>(
    buildWsUrl(GAMES.quoridor.wsPath),
    {
      logPrefix: GAMES.quoridor.logPrefix,
      onOpen: () => {
        // 진행 중이던 게임이 있으면 세션 ID로 복귀를 시도한다
        const sessionId = getSessionId(GAMES.quoridor.sessionKey);
        if (sessionId) {
          sendMessage({ type: 'qd_rejoin_game', payload: { sessionId } });
        }
      },
    },
  );

  const {
    hasJoined,
    game,
    gameOver,
    error,
    opponentDisconnected,
    rematchOffered,
    lastEvent,
    clearError,
    reset,
  } = useQDGameState(lastMessage);

  const handlePlayAgain = () => {
    reset();
    window.location.reload();
  };

  // 게임 시작 전에만 전체 화면 연결 대기 표시
  if (!isConnected && !game) {
    return <ConnectingScreen />;
  }

  return (
    <div className="app">
      <ConnectionBanner
        isConnected={isConnected}
        opponentDisconnected={opponentDisconnected}
        isGameActive={Boolean(game) && !gameOver}
      />
      <ErrorToast error={error} onClear={clearError} />
      <GameInfoButton game="quoridor" />

      {gameOver ? (
        <QDGameOver
          result={gameOver}
          yourSide={game?.yourSide ?? null}
          onPlayAgain={handlePlayAgain}
          rematchOffered={rematchOffered}
          onRematch={() => sendMessage({ type: 'qd_rematch' })}
        />
      ) : game ? (
        <QDBoard
          game={game}
          lastEvent={lastEvent}
          onMove={(to: QDCell) => sendMessage({ type: 'qd_move', payload: { to } })}
          onPlaceWall={(wall: QDWall) => sendMessage({ type: 'qd_place_wall', payload: wall })}
        />
      ) : (
        <QDWaitingRoom
          hasJoined={hasJoined}
          onJoinGame={(playerName: string, vsBot?: boolean) =>
            sendMessage({ type: 'qd_join_game', payload: { playerName, vsBot } })
          }
          onBack={onBack}
        />
      )}
    </div>
  );
}
