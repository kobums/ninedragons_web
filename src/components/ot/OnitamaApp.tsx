import { useEffect } from 'react';
import { useReconnectingWebSocket } from '../../hooks/useReconnectingWebSocket';
import { GAMES } from '../../config/games';
import { buildWsUrl } from '../../utils/ws';
import { useOTGameState } from '../../hooks/useOTGameState';
import { OTWaitingRoom } from './OTWaitingRoom';
import { OTBoard } from './OTBoard';
import { OTGameOver } from './OTGameOver';
import { ConnectionBanner } from '../ConnectionBanner';
import { ConnectingScreen } from '../ConnectingScreen';
import { GameInfoButton } from '../GameInfoButton';
import type { OTCell, OTMessage } from '../../types/onitama';
import { getSessionId } from '../../utils/session';

interface OnitamaAppProps {
  onBack: () => void;
}

export function OnitamaApp({ onBack }: OnitamaAppProps) {
  const { isConnected, lastMessage, sendMessage } = useReconnectingWebSocket<OTMessage>(
    buildWsUrl(GAMES.onitama.wsPath),
    {
      logPrefix: GAMES.onitama.logPrefix,
      onOpen: () => {
        // 진행 중이던 게임이 있으면 세션 ID로 복귀를 시도한다
        const sessionId = getSessionId(GAMES.onitama.sessionKey);
        if (sessionId) {
          sendMessage({ type: 'ot_rejoin_game', payload: { sessionId } });
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
    lastEvent,
    clearError,
    reset,
  } = useOTGameState(lastMessage);

  useEffect(() => {
    if (error) {
      alert(error);
      clearError();
    }
  }, [error, clearError]);

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
      <GameInfoButton game="onitama" />

      {gameOver ? (
        <OTGameOver
          result={gameOver}
          yourSide={game?.yourSide ?? null}
          onPlayAgain={handlePlayAgain}
        />
      ) : game ? (
        <OTBoard
          game={game}
          lastEvent={lastEvent}
          onMove={(card: string, from: OTCell, to: OTCell) =>
            sendMessage({ type: 'ot_move', payload: { card, from, to } })
          }
          onPass={(card: string) => sendMessage({ type: 'ot_pass', payload: { card } })}
        />
      ) : (
        <OTWaitingRoom
          hasJoined={hasJoined}
          onJoinGame={(playerName: string) =>
            sendMessage({ type: 'ot_join_game', payload: { playerName } })
          }
          onBack={onBack}
        />
      )}
    </div>
  );
}
