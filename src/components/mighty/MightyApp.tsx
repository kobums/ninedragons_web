import { useReconnectingWebSocket } from '../../hooks/useReconnectingWebSocket';
import { buildWsUrl } from '../../utils/ws';
import { useMightyGameState } from '../../hooks/useMightyGameState';
import type { MTMessage } from '../../types/mighty';
import { MT_SESSION_KEY } from '../../types/mighty';
import { getSessionId } from '../../utils/session';
import { MightyWaitingRoom } from './MightyWaitingRoom';
import { MightyBoard } from './MightyBoard';
import { MightyGameOver } from './MightyGameOver';
import { ConnectionBanner } from '../ConnectionBanner';
import { ConnectingScreen } from '../ConnectingScreen';
import { ErrorToast } from '../ErrorToast';
import { GameInfoButton } from '../GameInfoButton';
import { ReactionBar } from '../ReactionBar';
import { ReactionOverlay } from '../ReactionOverlay';
import { SpectatorBadge, SpectatorCount } from '../SpectatorBadge';
import { useReactions } from '../../hooks/useReactions';
import { useSpectate } from '../../hooks/useSpectate';

interface MightyAppProps {
  onBack: () => void;
}

export function MightyApp({ onBack }: MightyAppProps) {
  const { isConnected, lastMessage, sendMessage } =
    useReconnectingWebSocket<MTMessage>(buildWsUrl('/ws/mighty'), {
      logPrefix: '[Mighty] WebSocket',
      onOpen: () => {
        // 진행 중이던 게임이 있으면 세션 ID로 복귀를 시도한다
        const sessionId = getSessionId(MT_SESSION_KEY);
        if (sessionId) {
          sendMessage({ type: 'mt_rejoin', payload: { sessionId } });
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
  } = useMightyGameState(lastMessage);

  // 관전 모드 (mt_spectate_joined → 이후 스냅샷은 yourSeat -1)
  const { spectate } = useSpectate(lastMessage, 'mt_spectate_joined');
  const isSpectating = spectate !== null;
  // 리액션 팝 — 훅 토스트 경로와 별개로 mt_event 의 kind 'react' 만 감시
  const reactions = useReactions(lastMessage, 'mt_event');

  const handleFindNewGame = () => {
    reset();
    window.location.reload();
  };

  const inGame = game !== null && game.phase !== 'waiting';
  // mt_game_over 페이로드가 우선, 마지막 스냅샷의 result 는 보조
  const result = gameOver ?? game?.result ?? null;
  const yourSeat = game !== null && game.yourSeat >= 0 ? game.yourSeat : null;
  // 리액션은 좌석 보유자만 (관전자는 서버가 에러 처리) — 대기실에서도 허용
  const canReact =
    !isSpectating && !result && (game ? game.yourSeat >= 0 : hasJoined);

  // 게임 시작 전에만 전체 화면 연결 대기 표시
  if (!isConnected && !inGame) {
    return <ConnectingScreen />;
  }

  return (
    <div className="app">
      <ConnectionBanner
        isConnected={isConnected}
        opponentDisconnected={someoneDisconnected}
        isGameActive={inGame && !result}
      />
      <ErrorToast error={error} onClear={clearError} />
      <GameInfoButton game="mighty" />
      {isSpectating && <SpectatorBadge roomCode={spectate.roomCode} />}
      {!isSpectating && <SpectatorCount count={game?.spectators ?? 0} />}
      <ReactionOverlay pops={reactions} />
      {canReact && (
        <ReactionBar
          onReact={(emoji) =>
            sendMessage({ type: 'mt_react', payload: { emoji } })
          }
        />
      )}

      {result ? (
        <MightyGameOver
          result={result}
          yourSeat={yourSeat}
          onFindNewGame={handleFindNewGame}
        />
      ) : inGame && game ? (
        <MightyBoard
          game={game}
          toasts={toasts}
          onBid={(suit, count) =>
            sendMessage({ type: 'mt_bid', payload: { suit, count } })
          }
          onPass={() => sendMessage({ type: 'mt_pass', payload: {} })}
          onKitty={(discard, suit) =>
            sendMessage({ type: 'mt_kitty', payload: { discard, suit } })
          }
          onFriend={(type, card) =>
            sendMessage({
              type: 'mt_friend',
              payload: card !== undefined ? { type, card } : { type },
            })
          }
          onPlay={(card, options) =>
            sendMessage({
              type: 'mt_play',
              payload: {
                card,
                ...(options?.jokerCall ? { jokerCall: true } : {}),
                ...(options?.jokerSuit ? { jokerSuit: options.jokerSuit } : {}),
              },
            })
          }
        />
      ) : (
        <MightyWaitingRoom
          game={game}
          hasJoined={hasJoined}
          onJoin={(name, room) =>
            sendMessage({
              type: 'mt_join_game',
              // room 생략 = 공용 로비 (기존 와이어 그대로 — 하위 호환)
              payload: room ? { name, room } : { name },
            })
          }
          onFillBots={() => sendMessage({ type: 'mt_fill_bots', payload: {} })}
          onBack={onBack}
        />
      )}
    </div>
  );
}
