import { useReconnectingWebSocket } from '../../hooks/useReconnectingWebSocket';
import { buildWsUrl } from '../../utils/ws';
import { useKittensGameState } from '../../hooks/useKittensGameState';
import type { EKMessage } from '../../types/kittens';
import { EK_SESSION_KEY } from '../../types/kittens';
import { getSessionId } from '../../utils/session';
import type { GameId } from '../../config/games';
import { KittensWaitingRoom } from './KittensWaitingRoom';
import { KittensBoard } from './KittensBoard';
import { KittensGameOver } from './KittensGameOver';
import { ConnectionBanner } from '../ConnectionBanner';
import { ConnectingScreen } from '../ConnectingScreen';
import { ErrorToast } from '../ErrorToast';
import { GameInfoButton } from '../GameInfoButton';
import { ReactionBar } from '../ReactionBar';
import { ReactionOverlay } from '../ReactionOverlay';
import { SpectatorBadge, SpectatorCount } from '../SpectatorBadge';
import { useReactions } from '../../hooks/useReactions';
import { useSpectate } from '../../hooks/useSpectate';
import './KittensApp.css';

interface KittensAppProps {
  onBack: () => void;
}

export function KittensApp({ onBack }: KittensAppProps) {
  const { isConnected, lastMessage, sendMessage } =
    useReconnectingWebSocket<EKMessage>(buildWsUrl('/ws/kittens'), {
      logPrefix: '[익스플로딩 키튼] WebSocket',
      onOpen: () => {
        // 진행 중이던 게임이 있으면 세션 ID로 복귀를 시도한다
        const sessionId = getSessionId(EK_SESSION_KEY);
        if (sessionId) {
          sendMessage({ type: 'ek_rejoin', payload: { sessionId } });
        }
      },
    });

  const {
    hasJoined,
    game,
    gameOver,
    error,
    someoneDisconnected,
    futureCards,
    toasts,
    clearError,
    reset,
  } = useKittensGameState(lastMessage);

  // 관전 모드 (ek_spectate_joined → 이후 스냅샷은 yourSeat -1)
  const { spectate } = useSpectate(lastMessage, 'ek_spectate_joined');
  const isSpectating = spectate !== null;
  // 리액션 팝 — 훅 토스트 경로와 별개로 ek_event 의 kind 'react' 만 감시
  const reactions = useReactions(lastMessage, 'ek_event');

  const handleFindNewGame = () => {
    reset();
    window.location.reload();
  };

  const inGame = game !== null && game.phase !== 'waiting';
  // 종료 판정: ek_game_over 신호 또는 마지막 스냅샷의 phase.
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
    <div className="app mood-cream ek-scope">
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
      <GameInfoButton game={'kittens' as GameId} />
      {isSpectating && <SpectatorBadge roomCode={spectate.roomCode} />}
      {!isSpectating && <SpectatorCount count={game?.spectators ?? 0} />}
      <ReactionOverlay pops={reactions} />
      {canReact && (
        <ReactionBar
          onReact={(emoji) =>
            sendMessage({ type: 'ek_react', payload: { emoji } })
          }
        />
      )}

      {isOver && game ? (
        <KittensGameOver
          game={game}
          gameOver={gameOver}
          roomCode={game.roomCode}
          onFindNewGame={handleFindNewGame}
        />
      ) : inGame && game ? (
        <KittensBoard
          game={game}
          toasts={toasts}
          futureCards={futureCards}
          onPlay={(index, targetSeat) =>
            sendMessage({
              type: 'ek_play',
              payload:
                targetSeat !== undefined ? { index, targetSeat } : { index },
            })
          }
          onPlayPair={(indexes, targetSeat) =>
            sendMessage({ type: 'ek_play_pair', payload: { indexes, targetSeat } })
          }
          onDraw={() => sendMessage({ type: 'ek_draw', payload: {} })}
          onNope={() => sendMessage({ type: 'ek_nope', payload: {} })}
          onPass={() => sendMessage({ type: 'ek_pass', payload: {} })}
          onGive={(index) => sendMessage({ type: 'ek_give', payload: { index } })}
          onDefusePlace={(position) =>
            sendMessage({ type: 'ek_defuse_place', payload: { position } })
          }
        />
      ) : (
        <KittensWaitingRoom
          game={game}
          hasJoined={hasJoined}
          toasts={toasts}
          onJoin={(name, room) =>
            sendMessage({
              type: 'ek_join_game',
              // room 생략 = 공용 로비 (다인 게임 공통 와이어)
              payload: room ? { name, room } : { name },
            })
          }
          onStart={() => sendMessage({ type: 'ek_start', payload: {} })}
          onFillBots={() => sendMessage({ type: 'ek_fill_bots', payload: {} })}
          onBack={onBack}
        />
      )}
    </div>
  );
}
