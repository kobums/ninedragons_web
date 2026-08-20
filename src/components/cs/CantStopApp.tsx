import { useReconnectingWebSocket } from '../../hooks/useReconnectingWebSocket';
import { GAMES } from '../../config/games';
import { buildWsUrl } from '../../utils/ws';
import { useCSGameState } from '../../hooks/useCSGameState';
import { CSWaitingRoom } from './CSWaitingRoom';
import { CSBoard } from './CSBoard';
import { CSGameOver } from './CSGameOver';
import { ConnectionBanner } from '../ConnectionBanner';
import { ConnectingScreen } from '../ConnectingScreen';
import { GameInfoButton } from '../GameInfoButton';
import { ErrorToast } from '../ErrorToast';
import type { CSMessage } from '../../types/cantstop';
import { getSessionId } from '../../utils/session';

interface CantStopAppProps {
  onBack: () => void;
}

export function CantStopApp({ onBack }: CantStopAppProps) {
  const { isConnected, lastMessage, sendMessage } = useReconnectingWebSocket<CSMessage>(
    buildWsUrl(GAMES.cantstop.wsPath),
    {
      logPrefix: GAMES.cantstop.logPrefix,
      onOpen: () => {
        // 진행 중이던 게임이 있으면 세션 ID로 복귀를 시도한다
        const sessionId = getSessionId(GAMES.cantstop.sessionKey);
        if (sessionId) {
          sendMessage({ type: 'cs_rejoin_game', payload: { sessionId } });
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
  } = useCSGameState(lastMessage);

  const handlePlayAgain = () => {
    reset();
    window.location.reload();
  };

  // 게임 시작 전에만 전체 화면 연결 대기 표시
  if (!isConnected && !game) {
    return <ConnectingScreen />;
  }

  return (
    <div className="app mood-cream">
      <ConnectionBanner
        isConnected={isConnected}
        opponentDisconnected={opponentDisconnected}
        isGameActive={Boolean(game) && !gameOver}
      />
      <ErrorToast error={error} onClear={clearError} />
      <GameInfoButton game="cantstop" />

      {gameOver ? (
        <CSGameOver
          result={gameOver}
          yourSide={game?.yourSide ?? null}
          onPlayAgain={handlePlayAgain}
          rematchOffered={rematchOffered}
          onRematch={() => sendMessage({ type: 'cs_rematch' })}
        />
      ) : game ? (
        <CSBoard
          game={game}
          lastEvent={lastEvent}
          onRoll={() => sendMessage({ type: 'cs_roll' })}
          onChoose={(sums: number[]) => sendMessage({ type: 'cs_choose', payload: { sums } })}
          onStop={() => sendMessage({ type: 'cs_stop' })}
        />
      ) : (
        <CSWaitingRoom
          hasJoined={hasJoined}
          onJoinGame={(playerName: string, vsBot?: boolean) =>
            sendMessage({ type: 'cs_join_game', payload: { playerName, vsBot } })
          }
          onBack={onBack}
        />
      )}
    </div>
  );
}
