import { useReconnectingWebSocket } from '../../hooks/useReconnectingWebSocket';
import { buildWsUrl } from '../../utils/ws';
import { useBohnanzaGameState } from '../../hooks/useBohnanzaGameState';
import type { BZMessage } from '../../types/bohnanza';
import { BZ_SESSION_KEY } from '../../types/bohnanza';
import { getSessionId } from '../../utils/session';
import { BohnanzaWaitingRoom } from './BohnanzaWaitingRoom';
import { BohnanzaBoard } from './BohnanzaBoard';
import { BohnanzaGameOver } from './BohnanzaGameOver';
import { ConnectionBanner } from '../ConnectionBanner';
import { ConnectingScreen } from '../ConnectingScreen';
import { ErrorToast } from '../ErrorToast';
import { GameInfoButton } from '../GameInfoButton';
import { ReactionBar } from '../ReactionBar';
import { ReactionOverlay } from '../ReactionOverlay';
import { SpectatorBadge, SpectatorCount } from '../SpectatorBadge';
import { useReactions } from '../../hooks/useReactions';
import { useSpectate } from '../../hooks/useSpectate';
import './BohnanzaApp.css';

interface BohnanzaAppProps {
  onBack: () => void;
}

export function BohnanzaApp({ onBack }: BohnanzaAppProps) {
  const { isConnected, lastMessage, sendMessage } =
    useReconnectingWebSocket<BZMessage>(buildWsUrl('/ws/bohnanza'), {
      logPrefix: '[보난자] WebSocket',
      onOpen: () => {
        // 진행 중이던 게임이 있으면 세션 ID로 복귀를 시도한다
        const sessionId = getSessionId(BZ_SESSION_KEY);
        if (sessionId) {
          sendMessage({ type: 'bz_rejoin', payload: { sessionId } });
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
  } = useBohnanzaGameState(lastMessage);

  // 관전 모드 (bz_spectate_joined → 이후 스냅샷은 yourSeat -1)
  const { spectate } = useSpectate(lastMessage, 'bz_spectate_joined');
  const isSpectating = spectate !== null;
  // 리액션 팝 — 훅 토스트 경로와 별개로 bz_event 의 kind 'react' 만 감시
  const reactions = useReactions(lastMessage, 'bz_event');

  const handleFindNewGame = () => {
    reset();
    window.location.reload();
  };

  const inGame = game !== null && game.phase !== 'waiting';
  // 종료 판정: bz_game_over 신호 또는 마지막 스냅샷의 phase.
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
    <div className="app mood-cream bz-scope">
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
      <GameInfoButton game="bohnanza" />
      {isSpectating && <SpectatorBadge roomCode={spectate.roomCode} />}
      {!isSpectating && <SpectatorCount count={game?.spectators ?? 0} />}
      <ReactionOverlay pops={reactions} />
      {canReact && (
        <ReactionBar
          onReact={(emoji) =>
            sendMessage({ type: 'bz_react', payload: { emoji } })
          }
        />
      )}

      {isOver && game ? (
        <BohnanzaGameOver
          game={game}
          result={gameOver}
          roomCode={game.roomCode}
          onFindNewGame={handleFindNewGame}
        />
      ) : inGame && game ? (
        <BohnanzaBoard
          game={game}
          toasts={toasts}
          // 1단계 — 맨 앞 카드만 심기(false) 또는 두 번째까지 심기(true)
          onPlant={(second: boolean) =>
            sendMessage({ type: 'bz_plant', payload: { second } })
          }
          // 수확은 자기 차례가 아니어도 언제든 가능
          onHarvest={(field: number) =>
            sendMessage({ type: 'bz_harvest', payload: { field } })
          }
          // 세 번째 콩밭 구매 — 금화 3개, 게임 중 1회
          onBuyField={() => sendMessage({ type: 'bz_buy_field', payload: {} })}
          // 거래 제안 — want 를 비우면 기부
          onOffer={(offer) => sendMessage({ type: 'bz_offer', payload: offer })}
          onRespond={(offerId: string, accept: boolean) =>
            sendMessage({ type: 'bz_respond', payload: { offerId, accept } })
          }
          // 3단계 — 받은 카드를 밭에 심기
          onPlantReceived={(cardIndex: number, field: number) =>
            sendMessage({
              type: 'bz_plant_received',
              payload: { cardIndex, field },
            })
          }
          // 현재 단계 종료 (2단계 거래 마감 등)
          onEndPhase={() => sendMessage({ type: 'bz_end_phase', payload: {} })}
        />
      ) : (
        <BohnanzaWaitingRoom
          game={game}
          hasJoined={hasJoined}
          toasts={toasts}
          onJoin={(name, room) =>
            sendMessage({
              type: 'bz_join_game',
              // room 생략 = 공용 로비 (기존 와이어 그대로 — 하위 호환)
              payload: room ? { name, room } : { name },
            })
          }
          onStart={() => sendMessage({ type: 'bz_start', payload: {} })}
          onFillBots={() => sendMessage({ type: 'bz_fill_bots', payload: {} })}
          onBack={onBack}
        />
      )}
    </div>
  );
}
