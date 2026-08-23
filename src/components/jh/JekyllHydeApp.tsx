import { useReconnectingWebSocket } from '../../hooks/useReconnectingWebSocket';
import { GAMES } from '../../config/games';
import { buildWsUrl } from '../../utils/ws';
import { useJHGameState } from '../../hooks/useJHGameState';
import { JHWaitingRoom } from './JHWaitingRoom';
import { JHGameBoard } from './JHGameBoard';
import { JHGameOver } from './JHGameOver';
import { ConnectionBanner } from '../ConnectionBanner';
import { ErrorToast } from '../ErrorToast';
import { ConnectingScreen } from '../ConnectingScreen';
import { GameInfoButton } from '../GameInfoButton';
import type { JHMessage } from '../../types/jekyllhyde';
import { JH_SESSION_KEY, getSessionId } from '../../utils/session';


interface JekyllHydeAppProps {
  onBack: () => void;
}

export function JekyllHydeApp({ onBack }: JekyllHydeAppProps) {
  const { isConnected, lastMessage, sendMessage } = useReconnectingWebSocket<JHMessage>(buildWsUrl(GAMES.jekyllhyde.wsPath), {
    logPrefix: GAMES.jekyllhyde.logPrefix,
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
    rematchOffered,
    lastEvent,
    clearError,
    reset,
  } = useJHGameState(lastMessage);


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
      <GameInfoButton game="jekyllhyde" />

      {gameOver ? (
        <JHGameOver
          result={gameOver}
          yourRole={game?.yourRole ?? null}
          onPlayAgain={handlePlayAgain}
          rematchOffered={rematchOffered}
          onRematch={() => sendMessage({ type: 'jh_rematch' })}
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
            sendMessage({ type: 'jh_join_game', payload: { name: playerName } })
          }
          onBack={onBack}
        />
      )}
    </div>
  );
}
