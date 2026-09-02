import { useReconnectingWebSocket } from '../../hooks/useReconnectingWebSocket';
import { buildWsUrl } from '../../utils/ws';
import { useRummikubGameState } from '../../hooks/useRummikubGameState';
import type { RUMessage, RUTileId } from '../../types/rummikub';
import { RU_SESSION_KEY } from '../../types/rummikub';
import { getSessionId } from '../../utils/session';
import { RummikubWaitingRoom } from './RummikubWaitingRoom';
import { RummikubBoard } from './RummikubBoard';
import { RummikubGameOver } from './RummikubGameOver';
import { ConnectionBanner } from '../ConnectionBanner';
import { ConnectingScreen } from '../ConnectingScreen';
import { ErrorToast } from '../ErrorToast';
import { GameInfoButton } from '../GameInfoButton';
import { ReactionBar } from '../ReactionBar';
import { ReactionOverlay } from '../ReactionOverlay';
import { SpectatorBadge, SpectatorCount } from '../SpectatorBadge';
import { useReactions } from '../../hooks/useReactions';
import { useSpectate } from '../../hooks/useSpectate';
import './RummikubApp.css';

interface RummikubAppProps {
  onBack: () => void;
}

export function RummikubApp({ onBack }: RummikubAppProps) {
  const { isConnected, lastMessage, sendMessage } =
    useReconnectingWebSocket<RUMessage>(buildWsUrl('/ws/rummikub'), {
      logPrefix: '[루미큐브] WebSocket',
      onOpen: () => {
        // 진행 중이던 게임이 있으면 세션 ID로 복귀를 시도한다
        const sessionId = getSessionId(RU_SESSION_KEY);
        if (sessionId) {
          sendMessage({ type: 'ru_rejoin', payload: { sessionId } });
        }
      },
    });

  const {
    hasJoined,
    game,
    gameOver,
    error,
    errorSeq,
    someoneDisconnected,
    toasts,
    clearError,
    reset,
  } = useRummikubGameState(lastMessage);

  // 관전 모드 (ru_spectate_joined → 이후 스냅샷은 yourSeat -1)
  const { spectate } = useSpectate(lastMessage, 'ru_spectate_joined');
  const isSpectating = spectate !== null;
  // 리액션 팝 — 훅 토스트 경로와 별개로 ru_event 의 kind 'react' 만 감시
  const reactions = useReactions(lastMessage, 'ru_event');

  const handleFindNewGame = () => {
    reset();
    window.location.reload();
  };

  const inGame = game !== null && game.phase !== 'waiting';
  // 종료 판정: ru_game_over 신호 또는 마지막 스냅샷의 phase.
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
    <div className="app mood-cream ru-scope">
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
      <GameInfoButton game="rummikub" />
      {isSpectating && <SpectatorBadge roomCode={spectate.roomCode} />}
      {!isSpectating && <SpectatorCount count={game?.spectators ?? 0} />}
      <ReactionOverlay pops={reactions} />
      {canReact && (
        <ReactionBar
          onReact={(emoji) =>
            sendMessage({ type: 'ru_react', payload: { emoji } })
          }
        />
      )}

      {isOver && game ? (
        <RummikubGameOver
          game={game}
          result={gameOver}
          roomCode={game.roomCode}
          onFindNewGame={handleFindNewGame}
        />
      ) : inGame && game ? (
        <RummikubBoard
          game={game}
          toasts={toasts}
          // 서버가 확정을 거부하면(ru_error) 로컬 배치를 통째로 되돌린다
          errorSeq={errorSeq}
          // 차례 종료 시 테이블 전체 배치를 통째로 보낸다 (부분 이동 메시지 없음)
          onCommit={(sets: RUTileId[][]) =>
            sendMessage({ type: 'ru_commit', payload: { sets } })
          }
          onDraw={() => sendMessage({ type: 'ru_draw', payload: {} })}
        />
      ) : (
        <RummikubWaitingRoom
          game={game}
          hasJoined={hasJoined}
          toasts={toasts}
          onJoin={(name, room) =>
            sendMessage({
              type: 'ru_join_game',
              // room 생략 = 공용 로비 (기존 와이어 그대로 — 하위 호환)
              payload: room ? { name, room } : { name },
            })
          }
          onStart={() => sendMessage({ type: 'ru_start', payload: {} })}
          onFillBots={() => sendMessage({ type: 'ru_fill_bots', payload: {} })}
          onBack={onBack}
        />
      )}
    </div>
  );
}
