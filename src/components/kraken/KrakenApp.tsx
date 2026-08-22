import { useReconnectingWebSocket } from '../../hooks/useReconnectingWebSocket';
import { buildWsUrl } from '../../utils/ws';
import { useKrakenGameState } from '../../hooks/useKrakenGameState';
import type { KRMessage } from '../../types/kraken';
import { KR_SESSION_KEY } from '../../types/kraken';
import { getSessionId } from '../../utils/session';
import { KrakenWaitingRoom } from './KrakenWaitingRoom';
import { KrakenBoard } from './KrakenBoard';
import { KrakenGameOver } from './KrakenGameOver';
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

interface KrakenAppProps {
  onBack: () => void;
}

export function KrakenApp({ onBack }: KrakenAppProps) {
  const { isConnected, lastMessage, sendMessage } =
    useReconnectingWebSocket<KRMessage>(buildWsUrl('/ws/kraken'), {
      logPrefix: '[크라켄] WebSocket',
      onOpen: () => {
        // 진행 중이던 게임이 있으면 세션 ID로 복귀를 시도한다
        const sessionId = getSessionId(KR_SESSION_KEY);
        if (sessionId) {
          sendMessage({ type: 'kr_rejoin', payload: { sessionId } });
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
  } = useKrakenGameState(lastMessage);

  // 관전 모드 (kr_spectate_joined → 이후 스냅샷은 yourSeat -1)
  const { spectate } = useSpectate(lastMessage, 'kr_spectate_joined');
  const isSpectating = spectate !== null;
  // 리액션 팝 — 훅 토스트 경로와 별개로 kr_event 의 kind 'react' 만 감시
  const reactions = useReactions(lastMessage, 'kr_event');

  const handleFindNewGame = () => {
    reset();
    window.location.reload();
  };

  const inGame = game !== null && game.phase !== 'waiting';
  // 종료 판정: kr_game_over 신호 또는 마지막 스냅샷의 phase.
  // 화면 자체는 스냅샷(전원 역할 공개)으로 그린다.
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
    <div className="app mood-dark">
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
      <GameInfoButton game={'kraken' as GameId} />
      {isSpectating && <SpectatorBadge roomCode={spectate.roomCode} />}
      {!isSpectating && <SpectatorCount count={game?.spectators ?? 0} />}
      <ReactionOverlay pops={reactions} />
      {canReact && (
        <ReactionBar
          onReact={(emoji) =>
            sendMessage({ type: 'kr_react', payload: { emoji } })
          }
        />
      )}

      {isOver && game ? (
        <KrakenGameOver
          game={game}
          result={gameOver}
          roomCode={game.roomCode}
          onFindNewGame={handleFindNewGame}
        />
      ) : inGame && game ? (
        <KrakenBoard
          game={game}
          toasts={toasts}
          onPoint={(targetSeat, cardIndex) =>
            sendMessage({
              type: 'kr_point',
              payload: { targetSeat, cardIndex },
            })
          }
          onClaim={(treasure, kraken) =>
            sendMessage({ type: 'kr_claim', payload: { treasure, kraken } })
          }
        />
      ) : (
        <KrakenWaitingRoom
          game={game}
          hasJoined={hasJoined}
          toasts={toasts}
          onJoin={(name, room) =>
            sendMessage({
              type: 'kr_join_game',
              // room 생략 = 공용 로비 (기존 와이어 그대로 — 하위 호환)
              payload: room ? { name, room } : { name },
            })
          }
          onStart={() => sendMessage({ type: 'kr_start', payload: {} })}
          onFillBots={() => sendMessage({ type: 'kr_fill_bots', payload: {} })}
          onBack={onBack}
        />
      )}
    </div>
  );
}
