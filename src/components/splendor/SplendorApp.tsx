import { useReconnectingWebSocket } from '../../hooks/useReconnectingWebSocket';
import { buildWsUrl } from '../../utils/ws';
import { useSplendorGameState } from '../../hooks/useSplendorGameState';
import type { SLGem, SLMessage } from '../../types/splendor';
import { SL_SESSION_KEY } from '../../types/splendor';
import { getSessionId } from '../../utils/session';
import { SplendorWaitingRoom } from './SplendorWaitingRoom';
import { SplendorBoard } from './SplendorBoard';
import { SplendorGameOver } from './SplendorGameOver';
import { ConnectionBanner } from '../ConnectionBanner';
import { ConnectingScreen } from '../ConnectingScreen';
import { ErrorToast } from '../ErrorToast';
import { GameInfoButton } from '../GameInfoButton';
import type { GameId } from '../../config/games';
import { ReactionBar } from '../ReactionBar';
import { ReactionOverlay } from '../ReactionOverlay';
import { SpectatorBadge, SpectatorCount } from '../SpectatorBadge';
import { useReactions } from '../../hooks/useReactions';
import { useSpectate } from '../../hooks/useSpectate';
import './SplendorApp.css';

interface SplendorAppProps {
  onBack: () => void;
}

export function SplendorApp({ onBack }: SplendorAppProps) {
  const { isConnected, lastMessage, sendMessage } =
    useReconnectingWebSocket<SLMessage>(buildWsUrl('/ws/splendor'), {
      logPrefix: '[스플렌더] WebSocket',
      onOpen: () => {
        // 진행 중이던 게임이 있으면 세션 ID로 복귀를 시도한다
        const sessionId = getSessionId(SL_SESSION_KEY);
        if (sessionId) {
          sendMessage({ type: 'sl_rejoin', payload: { sessionId } });
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
  } = useSplendorGameState(lastMessage);

  // 관전 모드 (sl_spectate_joined → 이후 스냅샷은 yourSeat -1)
  const { spectate } = useSpectate(lastMessage, 'sl_spectate_joined');
  const isSpectating = spectate !== null;
  // 리액션 팝 — 훅 토스트 경로와 별개로 sl_event 의 kind 'react' 만 감시
  const reactions = useReactions(lastMessage, 'sl_event');

  const handleFindNewGame = () => {
    reset();
    window.location.reload();
  };

  const inGame = game !== null && game.phase !== 'waiting';
  // 종료 판정: sl_game_over 신호 또는 마지막 스냅샷의 phase.
  // 화면 자체는 스냅샷(명성 점수 순위)으로 그린다.
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
    <div className="app mood-cream sl-scope">
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
      {/* 통합자가 games.ts 에 등록하기 전까지의 임시 캐스팅 — 등록되면 자연 해소 */}
      <GameInfoButton game={'splendor' as GameId} />
      {isSpectating && <SpectatorBadge roomCode={spectate.roomCode} />}
      {!isSpectating && <SpectatorCount count={game?.spectators ?? 0} />}
      <ReactionOverlay pops={reactions} />
      {canReact && (
        <ReactionBar
          onReact={(emoji) =>
            sendMessage({ type: 'sl_react', payload: { emoji } })
          }
        />
      )}

      {isOver && game ? (
        <SplendorGameOver
          game={game}
          result={gameOver}
          roomCode={game.roomCode}
          onFindNewGame={handleFindNewGame}
        />
      ) : inGame && game ? (
        <SplendorBoard
          game={game}
          toasts={toasts}
          // 서로 다른 색 3개 또는 같은 색 2개 — 같은 색 2개는 ['ruby','ruby']
          onTake={(colors: SLGem[]) =>
            sendMessage({ type: 'sl_take', payload: { colors } })
          }
          // 공개 카드는 cardId, 덱 맨 위는 tier
          onReserve={(cardId, tier) =>
            sendMessage({
              type: 'sl_reserve',
              payload: cardId !== undefined ? { cardId } : { tier },
            })
          }
          onBuy={(cardId: number) =>
            sendMessage({ type: 'sl_buy', payload: { cardId } })
          }
          onDiscard={(colors) =>
            sendMessage({ type: 'sl_discard', payload: { colors } })
          }
        />
      ) : (
        <SplendorWaitingRoom
          game={game}
          hasJoined={hasJoined}
          toasts={toasts}
          onJoin={(name, room) =>
            sendMessage({
              type: 'sl_join_game',
              // room 생략 = 공용 로비 (기존 와이어 그대로 — 하위 호환)
              payload: room ? { name, room } : { name },
            })
          }
          onStart={() => sendMessage({ type: 'sl_start', payload: {} })}
          onFillBots={() => sendMessage({ type: 'sl_fill_bots', payload: {} })}
          onBack={onBack}
        />
      )}
    </div>
  );
}
