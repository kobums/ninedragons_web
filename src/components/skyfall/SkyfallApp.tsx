import { useReconnectingWebSocket } from '../../hooks/useReconnectingWebSocket';
import { buildWsUrl } from '../../utils/ws';
import { useSkyfallGameState } from '../../hooks/useSkyfallGameState';
import type { SFMessage } from '../../types/skyfall';
import { SF_SESSION_KEY } from '../../types/skyfall';
import { getSessionId } from '../../utils/session';
import { SkyfallWaitingRoom } from './SkyfallWaitingRoom';
import { SkyfallBoard } from './SkyfallBoard';
import { SkyfallGameOver } from './SkyfallGameOver';
import { ConnectionBanner } from '../ConnectionBanner';
import { ConnectingScreen } from '../ConnectingScreen';
import { ErrorToast } from '../ErrorToast';
import { GameInfoButton } from '../GameInfoButton';

interface SkyfallAppProps {
  onBack: () => void;
}

export function SkyfallApp({ onBack }: SkyfallAppProps) {
  const { isConnected, lastMessage, sendMessage } =
    useReconnectingWebSocket<SFMessage>(buildWsUrl('/ws/skyfall'), {
      logPrefix: '[Skyfall] WebSocket',
      onOpen: () => {
        // 진행 중이던 게임이 있으면 세션 ID로 복귀를 시도한다
        const sessionId = getSessionId(SF_SESSION_KEY);
        if (sessionId) {
          sendMessage({ type: 'sf_rejoin', payload: { sessionId } });
        }
      },
    });

  const {
    hasJoined,
    game,
    gameOver,
    error,
    someoneDisconnected,
    toasts,
    clearError,
    reset,
  } = useSkyfallGameState(lastMessage);

  const handleFindNewGame = () => {
    reset();
    window.location.reload();
  };

  const inGame = game !== null && game.phase !== 'waiting';
  // 종료 판정: sf_game_over 신호 또는 마지막 스냅샷의 phase.
  // 화면 자체는 스냅샷(전원 역할 공개)으로 그린다.
  const isOver = game !== null && (gameOver !== null || game.phase === 'game_over');

  // 게임 시작 전에만 전체 화면 연결 대기 표시
  if (!isConnected && !inGame) {
    return <ConnectingScreen />;
  }

  return (
    <div className="app">
      <ConnectionBanner
        isConnected={isConnected}
        opponentDisconnected={someoneDisconnected}
        isGameActive={inGame && !isOver}
        disconnectText={`${
          game?.players
            .filter((p) => !p.connected && !p.bot)
            .map((p) => p.name)
            .join(', ') || '참가자'
        }님의 연결이 끊겼습니다 — 90초 내 미복귀 시 봇이 이어받습니다`}
      />
      <ErrorToast error={error} onClear={clearError} />
      <GameInfoButton game="skyfall" />

      {isOver && game ? (
        <SkyfallGameOver
          game={game}
          winner={gameOver?.winner || game.winner}
          onFindNewGame={handleFindNewGame}
        />
      ) : inGame && game ? (
        <SkyfallBoard
          game={game}
          toasts={toasts}
          onNightAction={(target) =>
            sendMessage({ type: 'sf_night_action', payload: { target } })
          }
          onVote={(target) =>
            sendMessage({ type: 'sf_vote', payload: { target } })
          }
        />
      ) : (
        <SkyfallWaitingRoom
          game={game}
          toasts={toasts}
          hasJoined={hasJoined}
          onJoin={(name) =>
            sendMessage({ type: 'sf_join_game', payload: { name } })
          }
          onStart={() => sendMessage({ type: 'sf_start', payload: {} })}
          onFillBots={() => sendMessage({ type: 'sf_fill_bots', payload: {} })}
          onBack={onBack}
        />
      )}
    </div>
  );
}
