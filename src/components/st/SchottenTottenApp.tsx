import { useEffect } from 'react';
import { useSTWebSocket } from '../../hooks/useSTWebSocket';
import { useSTGameState } from '../../hooks/useSTGameState';
import { STWaitingRoom } from './STWaitingRoom';
import { STGameBoard } from './STGameBoard';
import { STGameOver } from './STGameOver';
import { ConnectionBanner } from '../ConnectionBanner';
import { ST_SESSION_KEY, getSessionId } from '../../utils/session';

// 로컬 개발 시에는 로컬 서버, 그 외에는 배포 서버(wss 고정)로 접속
const isLocalHost =
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1';
const WS_URL = isLocalHost
  ? 'ws://localhost:8003/ws/schottentotten'
  : 'wss://ninedragonsapi.gowoobro.com/ws/schottentotten';

interface SchottenTottenAppProps {
  onBack: () => void;
}

export function SchottenTottenApp({ onBack }: SchottenTottenAppProps) {
  const { isConnected, lastMessage, sendMessage } = useSTWebSocket(WS_URL, {
    onOpen: () => {
      // 진행 중이던 게임이 있으면 세션 ID로 복귀를 시도한다
      const sessionId = getSessionId(ST_SESSION_KEY);
      if (sessionId) {
        sendMessage({ type: 'st_rejoin_game', payload: { sessionId } });
      }
    },
  });

  const {
    hasJoined,
    game,
    gameOver,
    error,
    opponentDisconnected,
    lastEvent,
    clearError,
    reset,
  } = useSTGameState(lastMessage);

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
    return (
      <div className="app">
        <div className="connecting">서버에 연결 중...</div>
      </div>
    );
  }

  return (
    <div className="app">
      <ConnectionBanner
        isConnected={isConnected}
        opponentDisconnected={opponentDisconnected}
        isGameActive={Boolean(game) && !gameOver}
      />

      {gameOver ? (
        <STGameOver
          result={gameOver}
          yourSide={game?.yourSide ?? null}
          onPlayAgain={handlePlayAgain}
        />
      ) : game ? (
        <STGameBoard
          game={game}
          lastEvent={lastEvent}
          onPlayCard={(handIndex, stoneIndex) =>
            sendMessage({ type: 'st_play_card', payload: { handIndex, stoneIndex } })
          }
          onClaimStone={(stoneIndex) =>
            sendMessage({ type: 'st_claim_stone', payload: { stoneIndex } })
          }
          onEndTurn={() => sendMessage({ type: 'st_end_turn' })}
        />
      ) : (
        <STWaitingRoom
          hasJoined={hasJoined}
          onJoinGame={(playerName) =>
            sendMessage({ type: 'st_join_game', payload: { playerName } })
          }
          onBack={onBack}
        />
      )}
    </div>
  );
}
