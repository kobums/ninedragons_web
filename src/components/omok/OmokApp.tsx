import { useReconnectingWebSocket } from '../../hooks/useReconnectingWebSocket';
import { buildWsUrl } from '../../utils/ws';
import { useOmokGameState } from '../../hooks/useOmokGameState';
import { OmokWaitingRoom } from './OmokWaitingRoom';
import { OmokBoard } from './OmokBoard';
import { OmokGameOver } from './OmokGameOver';
import { ConnectionBanner } from '../ConnectionBanner';
import { ConnectingScreen } from '../ConnectingScreen';
import { GameInfoButton } from '../GameInfoButton';
import { ErrorToast } from '../ErrorToast';
import type { GameId } from '../../config/games';
import type { OmokMessage } from '../../types/omok';
import { OMOK_LOG_PREFIX, OMOK_SESSION_KEY, OMOK_WS_PATH } from '../../types/omok';
import { getSessionId } from '../../utils/session';

interface OmokAppProps {
  onBack: () => void;
}

export function OmokApp({ onBack }: OmokAppProps) {
  const { isConnected, lastMessage, sendMessage } = useReconnectingWebSocket<OmokMessage>(
    buildWsUrl(OMOK_WS_PATH),
    {
      logPrefix: OMOK_LOG_PREFIX,
      onOpen: () => {
        // 진행 중이던 게임이 있으면 세션 ID로 복귀를 시도한다
        const sessionId = getSessionId(OMOK_SESSION_KEY);
        if (sessionId) {
          sendMessage({ type: 'om_rejoin_game', payload: { sessionId } });
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
  } = useOmokGameState(lastMessage);

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
      {/* games.ts 등록은 통합자 담당 — 등록 전까지 임시 캐스팅 */}
      <GameInfoButton game={'omok' as GameId} />

      {gameOver ? (
        <OmokGameOver
          result={gameOver}
          game={game}
          onPlayAgain={handlePlayAgain}
          rematchOffered={rematchOffered}
          onRematch={() => sendMessage({ type: 'om_rematch' })}
        />
      ) : game ? (
        <OmokBoard
          game={game}
          lastEvent={lastEvent}
          onPlace={(row: number, col: number) =>
            sendMessage({ type: 'om_move', payload: { row, col } })
          }
        />
      ) : (
        <OmokWaitingRoom
          hasJoined={hasJoined}
          onJoinGame={(playerName: string, vsBot?: boolean) =>
            sendMessage({ type: 'om_join_game', payload: { playerName, vsBot } })
          }
          onBack={onBack}
        />
      )}
    </div>
  );
}
