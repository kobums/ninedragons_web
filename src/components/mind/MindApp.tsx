import { useReconnectingWebSocket } from '../../hooks/useReconnectingWebSocket';
import { buildWsUrl } from '../../utils/ws';
import { useMindGameState } from '../../hooks/useMindGameState';
import type { MIMessage } from '../../types/mind';
import { MI_SESSION_KEY } from '../../types/mind';
import { getSessionId } from '../../utils/session';
import { MindWaitingRoom } from './MindWaitingRoom';
import { MindBoard } from './MindBoard';
import { MindGameOver } from './MindGameOver';
import { ConnectionBanner } from '../ConnectionBanner';
import { ConnectingScreen } from '../ConnectingScreen';
import { ErrorToast } from '../ErrorToast';
import { GameInfoButton } from '../GameInfoButton';
import { SpectatorBadge, SpectatorCount } from '../SpectatorBadge';
import { useSpectate } from '../../hooks/useSpectate';

// 리액션 바·오버레이가 없는 유일한 게임이다. 말·채팅·손짓 금지가 규칙의 전부라
// 서버에도 mi_react 가 없다 — 이모지 한 개도 정보 전달이 되기 때문이다.
// (다른 게임 셸을 복사해 올 때 ReactionBar 를 되살리지 말 것)

interface MindAppProps {
  onBack: () => void;
}

export function MindApp({ onBack }: MindAppProps) {
  const { isConnected, lastMessage, sendMessage } =
    useReconnectingWebSocket<MIMessage>(buildWsUrl('/ws/mind'), {
      logPrefix: '[더 마인드] WebSocket',
      onOpen: () => {
        // 진행 중이던 게임이 있으면 세션 ID로 복귀를 시도한다
        const sessionId = getSessionId(MI_SESSION_KEY);
        if (sessionId) {
          sendMessage({ type: 'mi_rejoin', payload: { sessionId } });
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
  } = useMindGameState(lastMessage);

  // 관전 모드 (mi_spectate_joined → 이후 스냅샷은 yourSeat -1, yourHand 키 없음)
  const { spectate } = useSpectate(lastMessage, 'mi_spectate_joined');
  const isSpectating = spectate !== null;

  const handleFindNewGame = () => {
    reset();
    window.location.reload();
  };

  const inGame = game !== null && game.phase !== 'waiting';
  // 종료 판정: mi_game_over 신호 또는 마지막 스냅샷의 phase.
  const isOver =
    game !== null && (gameOver !== null || game.phase === 'game_over');

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
      <GameInfoButton game="mind" />
      {isSpectating && <SpectatorBadge roomCode={spectate.roomCode} />}
      {!isSpectating && <SpectatorCount count={game?.spectators ?? 0} />}

      {isOver && game ? (
        <MindGameOver
          game={game}
          result={gameOver}
          roomCode={game.roomCode}
          onFindNewGame={handleFindNewGame}
        />
      ) : inGame && game ? (
        <MindBoard
          game={game}
          toasts={toasts}
          // 카드 지정이 없다 — 서버가 내 최저 카드를 낸다
          onPlay={() => sendMessage({ type: 'mi_play', payload: {} })}
          onStarPropose={() =>
            sendMessage({ type: 'mi_star_propose', payload: {} })
          }
          onStarAccept={() =>
            sendMessage({ type: 'mi_star_accept', payload: {} })
          }
          onStarDecline={() =>
            sendMessage({ type: 'mi_star_decline', payload: {} })
          }
        />
      ) : (
        <MindWaitingRoom
          game={game}
          hasJoined={hasJoined}
          toasts={toasts}
          onJoin={(name, room) =>
            sendMessage({
              type: 'mi_join_game',
              // room 생략 = 공용 로비 (기존 와이어 그대로 — 하위 호환)
              payload: room ? { name, room } : { name },
            })
          }
          onStart={() => sendMessage({ type: 'mi_start', payload: {} })}
          onFillBots={() => sendMessage({ type: 'mi_fill_bots', payload: {} })}
          onBack={onBack}
        />
      )}
    </div>
  );
}
