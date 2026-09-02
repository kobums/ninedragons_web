import { useReconnectingWebSocket } from '../../hooks/useReconnectingWebSocket';
import { buildWsUrl } from '../../utils/ws';
import { useLasVegasGameState } from '../../hooks/useLasVegasGameState';
import type { VGMessage } from '../../types/lasvegas';
import { VG_SESSION_KEY } from '../../types/lasvegas';
import { getSessionId } from '../../utils/session';
import { LasVegasWaitingRoom } from './LasVegasWaitingRoom';
import { LasVegasBoard } from './LasVegasBoard';
import { LasVegasGameOver } from './LasVegasGameOver';
import { ConnectionBanner } from '../ConnectionBanner';
import { ConnectingScreen } from '../ConnectingScreen';
import { ErrorToast } from '../ErrorToast';
import { GameInfoButton } from '../GameInfoButton';
import { ReactionBar } from '../ReactionBar';
import { ReactionOverlay } from '../ReactionOverlay';
import { SpectatorBadge, SpectatorCount } from '../SpectatorBadge';
import { useReactions } from '../../hooks/useReactions';
import { useSpectate } from '../../hooks/useSpectate';
import './LasVegasApp.css';

interface LasVegasAppProps {
  onBack: () => void;
}

export function LasVegasApp({ onBack }: LasVegasAppProps) {
  const { isConnected, lastMessage, sendMessage } =
    useReconnectingWebSocket<VGMessage>(buildWsUrl('/ws/lasvegas'), {
      logPrefix: '[라스베가스] WebSocket',
      onOpen: () => {
        // 진행 중이던 게임이 있으면 세션 ID로 복귀를 시도한다
        const sessionId = getSessionId(VG_SESSION_KEY);
        if (sessionId) {
          sendMessage({ type: 'vg_rejoin', payload: { sessionId } });
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
  } = useLasVegasGameState(lastMessage);

  // 관전 모드 (vg_spectate_joined → 이후 스냅샷은 yourSeat -1)
  const { spectate } = useSpectate(lastMessage, 'vg_spectate_joined');
  const isSpectating = spectate !== null;
  // 리액션 팝 — 훅 토스트 경로와 별개로 vg_event 의 kind 'react' 만 감시
  const reactions = useReactions(lastMessage, 'vg_event');

  const handleFindNewGame = () => {
    reset();
    window.location.reload();
  };

  const inGame = game !== null && game.phase !== 'waiting';
  // 종료 판정: vg_game_over 신호 또는 마지막 스냅샷의 phase.
  // 화면 자체는 마지막 스냅샷으로 그린다.
  const isOver =
    game !== null && (gameOver !== null || game.phase === 'game_over');
  // 리액션은 좌석 보유자만 (관전자는 서버가 에러 처리) — 대기실에서도 허용
  const canReact =
    !isSpectating && !isOver && (game ? game.yourSeat >= 0 : hasJoined);

  // 게임 시작 전에만 전체 화면 연결 대기 표시
  if (!isConnected && !inGame) {
    return <ConnectingScreen mood="dark" />;
  }

  return (
    <div className="app mood-dark vg-scope">
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
      {/* lasvegas 는 games.ts 등록 전 — 통합 시 캐스팅 제거 */}
      <GameInfoButton game="lasvegas" />
      {isSpectating && <SpectatorBadge roomCode={spectate.roomCode} />}
      {!isSpectating && <SpectatorCount count={game?.spectators ?? 0} />}
      <ReactionOverlay pops={reactions} />
      {canReact && (
        <ReactionBar
          onReact={(emoji) =>
            sendMessage({ type: 'vg_react', payload: { emoji } })
          }
        />
      )}

      {isOver && game ? (
        <LasVegasGameOver
          game={game}
          result={gameOver}
          roomCode={game.roomCode}
          onFindNewGame={handleFindNewGame}
        />
      ) : inGame && game ? (
        <LasVegasBoard
          game={game}
          toasts={toasts}
          onPlace={(face) =>
            sendMessage({ type: 'vg_place', payload: { face } })
          }
        />
      ) : (
        <LasVegasWaitingRoom
          game={game}
          hasJoined={hasJoined}
          toasts={toasts}
          onJoin={(name, room) =>
            sendMessage({
              type: 'vg_join_game',
              // room 생략 = 공용 로비 (다인 게임 공통 와이어)
              payload: room ? { name, room } : { name },
            })
          }
          onStart={() => sendMessage({ type: 'vg_start', payload: {} })}
          onFillBots={() => sendMessage({ type: 'vg_fill_bots', payload: {} })}
          onBack={onBack}
        />
      )}
    </div>
  );
}
