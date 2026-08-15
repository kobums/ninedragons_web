import { useReconnectingWebSocket } from '../../hooks/useReconnectingWebSocket';
import { GAMES } from '../../config/games';
import { buildWsUrl } from '../../utils/ws';
import { useLCGameState } from '../../hooks/useLCGameState';
import { LCWaitingRoom } from './LCWaitingRoom';
import { LCBoard } from './LCBoard';
import { LCGameOver } from './LCGameOver';
import { ConnectionBanner } from '../ConnectionBanner';
import { ConnectingScreen } from '../ConnectingScreen';
import { GameInfoButton } from '../GameInfoButton';
import { ErrorToast } from '../ErrorToast';
import type { LCMessage } from '../../types/lostcities';
import { getSessionId } from '../../utils/session';

interface LostCitiesAppProps {
  onBack: () => void;
}

export function LostCitiesApp({ onBack }: LostCitiesAppProps) {
  const { isConnected, lastMessage, sendMessage } = useReconnectingWebSocket<LCMessage>(
    buildWsUrl(GAMES.lostcities.wsPath),
    {
      logPrefix: GAMES.lostcities.logPrefix,
      onOpen: () => {
        // 진행 중이던 게임이 있으면 세션 ID로 복귀를 시도한다
        const sessionId = getSessionId(GAMES.lostcities.sessionKey);
        if (sessionId) {
          sendMessage({ type: 'lc_rejoin_game', payload: { sessionId } });
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
  } = useLCGameState(lastMessage);

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
      <GameInfoButton game="lostcities" />

      {gameOver ? (
        <LCGameOver
          result={gameOver}
          yourSide={game?.yourSide ?? null}
          onPlayAgain={handlePlayAgain}
          rematchOffered={rematchOffered}
          onRematch={() => sendMessage({ type: 'lc_rematch' })}
        />
      ) : game ? (
        <LCBoard
          game={game}
          lastEvent={lastEvent}
          onMove={(cardId: number, action: 'play' | 'discard', draw: string) =>
            sendMessage({ type: 'lc_move', payload: { cardId, action, draw } })
          }
        />
      ) : (
        <LCWaitingRoom
          hasJoined={hasJoined}
          onJoinGame={(playerName: string, vsBot?: boolean) =>
            sendMessage({ type: 'lc_join_game', payload: { playerName, vsBot } })
          }
          onBack={onBack}
        />
      )}
    </div>
  );
}
