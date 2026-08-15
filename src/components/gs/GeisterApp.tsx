import { useReconnectingWebSocket } from '../../hooks/useReconnectingWebSocket';
import { GAMES } from '../../config/games';
import { buildWsUrl } from '../../utils/ws';
import { useGSGameState } from '../../hooks/useGSGameState';
import { GSWaitingRoom } from './GSWaitingRoom';
import { GSBoard } from './GSBoard';
import { GSGameOver } from './GSGameOver';
import { ConnectionBanner } from '../ConnectionBanner';
import { ConnectingScreen } from '../ConnectingScreen';
import { GameInfoButton } from '../GameInfoButton';
import { ErrorToast } from '../ErrorToast';
import type { GSCell, GSMessage } from '../../types/geister';
import { getSessionId } from '../../utils/session';

interface GeisterAppProps {
  onBack: () => void;
}

export function GeisterApp({ onBack }: GeisterAppProps) {
  const { isConnected, lastMessage, sendMessage } = useReconnectingWebSocket<GSMessage>(
    buildWsUrl(GAMES.geister.wsPath),
    {
      logPrefix: GAMES.geister.logPrefix,
      onOpen: () => {
        // 진행 중이던 게임이 있으면 세션 ID로 복귀를 시도한다
        const sessionId = getSessionId(GAMES.geister.sessionKey);
        if (sessionId) {
          sendMessage({ type: 'gs_rejoin_game', payload: { sessionId } });
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
  } = useGSGameState(lastMessage);

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
      <GameInfoButton game="geister" />

      {gameOver ? (
        <GSGameOver
          result={gameOver}
          yourSide={game?.yourSide ?? null}
          onPlayAgain={handlePlayAgain}
          rematchOffered={rematchOffered}
          onRematch={() => sendMessage({ type: 'gs_rematch' })}
        />
      ) : game ? (
        <GSBoard
          game={game}
          lastEvent={lastEvent}
          onSubmitSetup={(goodCells: GSCell[]) =>
            sendMessage({ type: 'gs_submit_setup', payload: { goodCells } })
          }
          onMove={(from: GSCell, to: GSCell) =>
            sendMessage({ type: 'gs_move', payload: { from, to } })
          }
          onEscape={(from: GSCell) =>
            sendMessage({ type: 'gs_move', payload: { from, to: from, escape: true } })
          }
        />
      ) : (
        <GSWaitingRoom
          hasJoined={hasJoined}
          onJoinGame={(playerName: string, vsBot?: boolean) =>
            sendMessage({ type: 'gs_join_game', payload: { playerName, vsBot } })
          }
          onBack={onBack}
        />
      )}
    </div>
  );
}
