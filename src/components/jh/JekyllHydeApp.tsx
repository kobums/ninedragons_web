import { useEffect } from 'react';
import { useJHWebSocket } from '../../hooks/useJHWebSocket';
import { useJHGameState } from '../../hooks/useJHGameState';
import { JHWaitingRoom } from './JHWaitingRoom';
import { JHGameBoard } from './JHGameBoard';
import { JHGameOver } from './JHGameOver';
import { ConnectionBanner } from '../ConnectionBanner';
import { JH_SESSION_KEY, getSessionId } from '../../utils/session';

// 로컬 개발 시에는 로컬 서버, 그 외에는 배포 서버(wss 고정)로 접속
const isLocalHost =
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1';
const WS_URL = isLocalHost
  ? 'ws://localhost:8003/ws/jekyllhyde'
  : 'wss://ninedragonsapi.gowoobro.com/ws/jekyllhyde';

interface JekyllHydeAppProps {
  onBack: () => void;
}

export function JekyllHydeApp({ onBack }: JekyllHydeAppProps) {
  const { isConnected, lastMessage, sendMessage } = useJHWebSocket(WS_URL, {
    onOpen: () => {
      // 진행 중이던 게임이 있으면 세션 ID로 복귀를 시도한다
      const sessionId = getSessionId(JH_SESSION_KEY);
      if (sessionId) {
        sendMessage({ type: 'jh_rejoin_game', payload: { sessionId } });
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
  } = useJHGameState(lastMessage);

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
        <JHGameOver
          result={gameOver}
          yourRole={game?.yourRole ?? null}
          onPlayAgain={handlePlayAgain}
        />
      ) : game ? (
        <JHGameBoard
          game={game}
          lastEvent={lastEvent}
          onExchange={(indices) =>
            sendMessage({ type: 'jh_exchange_cards', payload: { indices } })
          }
          onPlayCard={(handIndex) =>
            sendMessage({ type: 'jh_play_card', payload: { handIndex } })
          }
          onDeclareSuit={(suit) =>
            sendMessage({ type: 'jh_declare_suit', payload: { suit } })
          }
          onStealTrick={(trickIndex) =>
            sendMessage({ type: 'jh_steal_trick', payload: { trickIndex } })
          }
          onGreedCards={(indices) =>
            sendMessage({ type: 'jh_greed_cards', payload: { indices } })
          }
        />
      ) : (
        <JHWaitingRoom
          hasJoined={hasJoined}
          onJoinGame={(playerName) =>
            sendMessage({ type: 'jh_join_game', payload: { playerName } })
          }
          onBack={onBack}
        />
      )}
    </div>
  );
}
