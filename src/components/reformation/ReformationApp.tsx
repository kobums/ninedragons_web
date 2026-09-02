import { useReconnectingWebSocket } from '../../hooks/useReconnectingWebSocket';
import { buildWsUrl } from '../../utils/ws';
import { useReformationGameState } from '../../hooks/useReformationGameState';
import type { RFMessage } from '../../types/reformation';
import { RF_SESSION_KEY } from '../../types/reformation';
import { getSessionId } from '../../utils/session';
import { ReformationWaitingRoom } from './ReformationWaitingRoom';
import { ReformationBoard } from './ReformationBoard';
import { ReformationGameOver } from './ReformationGameOver';
import { ConnectionBanner } from '../ConnectionBanner';
import { ConnectingScreen } from '../ConnectingScreen';
import { ErrorToast } from '../ErrorToast';
import { GameInfoButton } from '../GameInfoButton';
import { ReactionBar } from '../ReactionBar';
import { ReactionOverlay } from '../ReactionOverlay';
import { SpectatorBadge, SpectatorCount } from '../SpectatorBadge';
import { useReactions } from '../../hooks/useReactions';
import { useSpectate } from '../../hooks/useSpectate';
import './ReformationApp.css';

interface ReformationAppProps {
  onBack: () => void;
}

export function ReformationApp({ onBack }: ReformationAppProps) {
  const { isConnected, lastMessage, sendMessage } =
    useReconnectingWebSocket<RFMessage>(buildWsUrl('/ws/reformation'), {
      logPrefix: '[리포메이션] WebSocket',
      onOpen: () => {
        // 진행 중이던 게임이 있으면 세션 ID로 복귀를 시도한다
        const sessionId = getSessionId(RF_SESSION_KEY);
        if (sessionId) {
          sendMessage({ type: 'rf_rejoin', payload: { sessionId } });
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
  } = useReformationGameState(lastMessage);

  // 관전 모드 (rf_spectate_joined → 이후 스냅샷은 yourSeat -1)
  const { spectate } = useSpectate(lastMessage, 'rf_spectate_joined');
  const isSpectating = spectate !== null;
  // 리액션 팝 — 훅 피드 경로와 별개로 rf_event 의 kind 'react' 만 감시
  const reactions = useReactions(lastMessage, 'rf_event');

  const handleFindNewGame = () => {
    reset();
    window.location.reload();
  };

  const inGame = game !== null && game.phase !== 'waiting';
  // 종료 판정: rf_game_over 신호 또는 마지막 스냅샷의 phase.
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
    <div className="app mood-dark rf-scope">
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
      <GameInfoButton game="reformation" />
      {isSpectating && <SpectatorBadge roomCode={spectate.roomCode} />}
      {!isSpectating && <SpectatorCount count={game?.spectators ?? 0} />}
      <ReactionOverlay pops={reactions} />
      {canReact && (
        <ReactionBar
          onReact={(emoji) =>
            sendMessage({ type: 'rf_react', payload: { emoji } })
          }
        />
      )}

      {isOver && game ? (
        <ReformationGameOver
          game={game}
          gameOver={gameOver}
          roomCode={game.roomCode}
          onFindNewGame={handleFindNewGame}
        />
      ) : inGame && game ? (
        <ReformationBoard
          game={game}
          toasts={toasts}
          onAction={(kind, targetSeat) =>
            sendMessage({
              type: 'rf_action',
              payload:
                targetSeat !== undefined ? { kind, targetSeat } : { kind },
            })
          }
          onConvert={() => sendMessage({ type: 'rf_convert', payload: {} })}
          onConvertOther={(targetSeat) =>
            sendMessage({ type: 'rf_convert_other', payload: { targetSeat } })
          }
          onEmbezzle={() => sendMessage({ type: 'rf_embezzle', payload: {} })}
          onPass={() => sendMessage({ type: 'rf_pass', payload: {} })}
          onChallenge={() => sendMessage({ type: 'rf_challenge', payload: {} })}
          onBlock={(role) => sendMessage({ type: 'rf_block', payload: { role } })}
          onLoseCard={(index) =>
            sendMessage({ type: 'rf_lose_card', payload: { index } })
          }
          onExchange={(keep) =>
            sendMessage({ type: 'rf_exchange', payload: { keep } })
          }
        />
      ) : (
        <ReformationWaitingRoom
          game={game}
          toasts={toasts}
          hasJoined={hasJoined}
          onJoin={(name, room) =>
            sendMessage({
              type: 'rf_join_game',
              // room 생략 = 공용 로비 (다인 게임 공통 와이어)
              payload: room ? { name, room } : { name },
            })
          }
          onStart={() => sendMessage({ type: 'rf_start', payload: {} })}
          onFillBots={() => sendMessage({ type: 'rf_fill_bots', payload: {} })}
          onBack={onBack}
        />
      )}
    </div>
  );
}
