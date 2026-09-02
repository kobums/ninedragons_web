import { useReconnectingWebSocket } from '../../hooks/useReconnectingWebSocket';
import { buildWsUrl } from '../../utils/ws';
import { useStartupsGameState } from '../../hooks/useStartupsGameState';
import type { SUMessage } from '../../types/startups';
import { SU_SESSION_KEY } from '../../types/startups';
import { getSessionId } from '../../utils/session';
import { StartupsWaitingRoom } from './StartupsWaitingRoom';
import { StartupsBoard } from './StartupsBoard';
import { StartupsGameOver } from './StartupsGameOver';
import { ConnectionBanner } from '../ConnectionBanner';
import { ConnectingScreen } from '../ConnectingScreen';
import { ErrorToast } from '../ErrorToast';
import { GameInfoButton } from '../GameInfoButton';
import { ReactionBar } from '../ReactionBar';
import { ReactionOverlay } from '../ReactionOverlay';
import { SpectatorBadge, SpectatorCount } from '../SpectatorBadge';
import { useReactions } from '../../hooks/useReactions';
import { useSpectate } from '../../hooks/useSpectate';
import './StartupsApp.css';

interface StartupsAppProps {
  onBack: () => void;
}

export function StartupsApp({ onBack }: StartupsAppProps) {
  const { isConnected, lastMessage, sendMessage } =
    useReconnectingWebSocket<SUMessage>(buildWsUrl('/ws/startups'), {
      logPrefix: '[스타트업스] WebSocket',
      onOpen: () => {
        // 진행 중이던 게임이 있으면 세션 ID로 복귀를 시도한다
        const sessionId = getSessionId(SU_SESSION_KEY);
        if (sessionId) {
          sendMessage({ type: 'su_rejoin', payload: { sessionId } });
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
  } = useStartupsGameState(lastMessage);

  // 관전 모드 (su_spectate_joined → 이후 스냅샷은 yourSeat -1)
  const { spectate } = useSpectate(lastMessage, 'su_spectate_joined');
  const isSpectating = spectate !== null;
  // 리액션 팝 — 훅 토스트 경로와 별개로 su_event 의 kind 'react' 만 감시
  const reactions = useReactions(lastMessage, 'su_event');

  const handleFindNewGame = () => {
    reset();
    window.location.reload();
  };

  const inGame = game !== null && game.phase !== 'waiting';
  // 종료 판정: su_game_over 신호 또는 마지막 스냅샷의 phase.
  // 화면 자체는 스냅샷(정산 내역)으로 그린다.
  const isOver =
    game !== null && (gameOver !== null || game.phase === 'game_over');
  // 리액션은 좌석 보유자만 (관전자는 서버가 에러 처리) — 대기실에서도 허용
  const canReact =
    !isSpectating && !isOver && (game ? game.yourSeat >= 0 : hasJoined);

  // 게임 시작 전에만 전체 화면 연결 대기 표시
  if (!isConnected && !inGame) {
    return <ConnectingScreen mood="cream" />;
  }

  return (
    <div className="app mood-cream su-scope">
      <ConnectionBanner
        isConnected={isConnected}
        opponentDisconnected={someoneDisconnected}
        isGameActive={inGame && !isOver}
        disconnectText={`${
          (game?.players ?? [])
            .filter((p) => !p.connected && !p.bot)
            .map((p) => p.name)
            .join(', ') || '참가자'
        }님의 연결이 끊겼습니다 — 90초 내 미복귀 시 봇이 이어받습니다`}
      />
      <ErrorToast error={error} onClear={clearError} />
      <GameInfoButton game="startups" />
      {isSpectating && <SpectatorBadge roomCode={spectate.roomCode} />}
      {!isSpectating && <SpectatorCount count={game?.spectators ?? 0} />}
      <ReactionOverlay pops={reactions} />
      {canReact && (
        <ReactionBar
          onReact={(emoji) =>
            sendMessage({ type: 'su_react', payload: { emoji } })
          }
        />
      )}

      {isOver && game ? (
        <StartupsGameOver
          game={game}
          result={gameOver}
          roomCode={game.roomCode}
          onFindNewGame={handleFindNewGame}
        />
      ) : inGame && game ? (
        <StartupsBoard
          game={game}
          toasts={toasts}
          // from 은 'deck' 또는 'market:N' (시장 인덱스)
          onTake={(from: string) =>
            sendMessage({ type: 'su_take', payload: { from } })
          }
          // 손패에서 시장에 낼 카드의 인덱스
          onPlay={(index: number) =>
            sendMessage({ type: 'su_play', payload: { index } })
          }
        />
      ) : (
        <StartupsWaitingRoom
          game={game}
          hasJoined={hasJoined}
          toasts={toasts}
          onJoin={(name, room) =>
            sendMessage({
              type: 'su_join_game',
              // room 생략 = 공용 로비 (기존 와이어 그대로 — 하위 호환)
              payload: room ? { name, room } : { name },
            })
          }
          onStart={() => sendMessage({ type: 'su_start', payload: {} })}
          onFillBots={() => sendMessage({ type: 'su_fill_bots', payload: {} })}
          onBack={onBack}
        />
      )}
    </div>
  );
}
