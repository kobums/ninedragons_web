import { useReconnectingWebSocket } from '../../hooks/useReconnectingWebSocket';
import { buildWsUrl } from '../../utils/ws';
import { useCoupGameState } from '../../hooks/useCoupGameState';
import type { CPMessage } from '../../types/coup';
import { CP_SESSION_KEY } from '../../types/coup';
import { getSessionId } from '../../utils/session';
import { CoupWaitingRoom } from './CoupWaitingRoom';
import { CoupBoard } from './CoupBoard';
import { CoupGameOver } from './CoupGameOver';
import { ConnectionBanner } from '../ConnectionBanner';
import { ConnectingScreen } from '../ConnectingScreen';
import { ErrorToast } from '../ErrorToast';
import { GameInfoButton } from '../GameInfoButton';
import { ReactionBar } from '../ReactionBar';
import { ReactionOverlay } from '../ReactionOverlay';
import { SpectatorBadge, SpectatorCount } from '../SpectatorBadge';
import { useReactions } from '../../hooks/useReactions';
import { useSpectate } from '../../hooks/useSpectate';
import './CoupApp.css';

interface CoupAppProps {
  onBack: () => void;
}

export function CoupApp({ onBack }: CoupAppProps) {
  const { isConnected, lastMessage, sendMessage } =
    useReconnectingWebSocket<CPMessage>(buildWsUrl('/ws/coup'), {
      logPrefix: '[쿠] WebSocket',
      onOpen: () => {
        // 진행 중이던 게임이 있으면 세션 ID로 복귀를 시도한다
        const sessionId = getSessionId(CP_SESSION_KEY);
        if (sessionId) {
          sendMessage({ type: 'cp_rejoin', payload: { sessionId } });
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
  } = useCoupGameState(lastMessage);

  // 관전 모드 (cp_spectate_joined → 이후 스냅샷은 yourSeat -1)
  const { spectate } = useSpectate(lastMessage, 'cp_spectate_joined');
  const isSpectating = spectate !== null;
  // 리액션 팝 — 훅 피드 경로와 별개로 cp_event 의 kind 'react' 만 감시
  const reactions = useReactions(lastMessage, 'cp_event');

  const handleFindNewGame = () => {
    reset();
    window.location.reload();
  };

  const inGame = game !== null && game.phase !== 'waiting';
  // 종료 판정: cp_game_over 신호 또는 마지막 스냅샷의 phase.
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
    <div className="app mood-dark cp-scope">
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
      {/* coup 는 games.ts 등록 전 — 통합 시 캐스팅 제거 */}
      <GameInfoButton game="coup" />
      {isSpectating && <SpectatorBadge roomCode={spectate.roomCode} />}
      {!isSpectating && <SpectatorCount count={game?.spectators ?? 0} />}
      <ReactionOverlay pops={reactions} />
      {canReact && (
        <ReactionBar
          onReact={(emoji) =>
            sendMessage({ type: 'cp_react', payload: { emoji } })
          }
        />
      )}

      {isOver && game ? (
        <CoupGameOver
          game={game}
          gameOver={gameOver}
          roomCode={game.roomCode}
          onFindNewGame={handleFindNewGame}
        />
      ) : inGame && game ? (
        <CoupBoard
          game={game}
          toasts={toasts}
          onAction={(kind, targetSeat) =>
            sendMessage({
              type: 'cp_action',
              payload:
                targetSeat !== undefined ? { kind, targetSeat } : { kind },
            })
          }
          onAllow={() => sendMessage({ type: 'cp_allow', payload: {} })}
          onChallenge={() => sendMessage({ type: 'cp_challenge', payload: {} })}
          onBlock={(role) => sendMessage({ type: 'cp_block', payload: { role } })}
          onLose={(index) => sendMessage({ type: 'cp_lose', payload: { index } })}
          onExchangeKeep={(indices) =>
            sendMessage({ type: 'cp_exchange_keep', payload: { indices } })
          }
        />
      ) : (
        <CoupWaitingRoom
          game={game}
          toasts={toasts}
          hasJoined={hasJoined}
          onJoin={(name, room) =>
            sendMessage({
              type: 'cp_join_game',
              // room 생략 = 공용 로비 (다인 게임 공통 와이어)
              payload: room ? { name, room } : { name },
            })
          }
          onStart={() => sendMessage({ type: 'cp_start', payload: {} })}
          onFillBots={() => sendMessage({ type: 'cp_fill_bots', payload: {} })}
          onBack={onBack}
        />
      )}
    </div>
  );
}
