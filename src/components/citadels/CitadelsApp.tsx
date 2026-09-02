import { useReconnectingWebSocket } from '../../hooks/useReconnectingWebSocket';
import { buildWsUrl } from '../../utils/ws';
import { useCitadelsGameState } from '../../hooks/useCitadelsGameState';
import type { CTAbilityPayload, CTGatherKind, CTMessage } from '../../types/citadels';
import { CT_SESSION_KEY } from '../../types/citadels';
import { getSessionId } from '../../utils/session';
import { CitadelsWaitingRoom } from './CitadelsWaitingRoom';
import { CitadelsBoard } from './CitadelsBoard';
import { CitadelsGameOver } from './CitadelsGameOver';
import { ConnectionBanner } from '../ConnectionBanner';
import { ConnectingScreen } from '../ConnectingScreen';
import { ErrorToast } from '../ErrorToast';
import { GameInfoButton } from '../GameInfoButton';
import { ReactionBar } from '../ReactionBar';
import { ReactionOverlay } from '../ReactionOverlay';
import { SpectatorBadge, SpectatorCount } from '../SpectatorBadge';
import { useReactions } from '../../hooks/useReactions';
import { useSpectate } from '../../hooks/useSpectate';
import './CitadelsApp.css';

interface CitadelsAppProps {
  onBack: () => void;
}

export function CitadelsApp({ onBack }: CitadelsAppProps) {
  const { isConnected, lastMessage, sendMessage } =
    useReconnectingWebSocket<CTMessage>(buildWsUrl('/ws/citadels'), {
      logPrefix: '[시타델] WebSocket',
      onOpen: () => {
        // 진행 중이던 게임이 있으면 세션 ID로 복귀를 시도한다
        const sessionId = getSessionId(CT_SESSION_KEY);
        if (sessionId) {
          sendMessage({ type: 'ct_rejoin', payload: { sessionId } });
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
  } = useCitadelsGameState(lastMessage);

  // 관전 모드 (ct_spectate_joined → 이후 스냅샷은 yourSeat -1)
  const { spectate } = useSpectate(lastMessage, 'ct_spectate_joined');
  const isSpectating = spectate !== null;
  // 리액션 팝 — 훅 토스트 경로와 별개로 ct_event 의 kind 'react' 만 감시
  const reactions = useReactions(lastMessage, 'ct_event');

  const handleFindNewGame = () => {
    reset();
    window.location.reload();
  };

  const inGame = game !== null && game.phase !== 'waiting';
  // 종료 판정: ct_game_over 신호 또는 마지막 스냅샷의 phase.
  // 화면 자체는 스냅샷(점수 내역 표)으로 그린다.
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
    <div className="app mood-dark ct-scope">
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
      <GameInfoButton game="citadels" />
      {isSpectating && <SpectatorBadge roomCode={spectate.roomCode} />}
      {!isSpectating && <SpectatorCount count={game?.spectators ?? 0} />}
      <ReactionOverlay pops={reactions} />
      {canReact && (
        <ReactionBar
          onReact={(emoji) =>
            sendMessage({ type: 'ct_react', payload: { emoji } })
          }
        />
      )}

      {isOver && game ? (
        <CitadelsGameOver
          game={game}
          result={gameOver}
          roomCode={game.roomCode}
          onFindNewGame={handleFindNewGame}
        />
      ) : inGame && game ? (
        <CitadelsBoard
          game={game}
          toasts={toasts}
          onPickRole={(role: number) =>
            sendMessage({ type: 'ct_pick_role', payload: { role } })
          }
          // ① 자원 — 금화 2 받기 또는 건물 카드 2장 뽑기
          onGather={(kind: CTGatherKind) =>
            sendMessage({ type: 'ct_gather', payload: { kind } })
          }
          // 뽑은 2장 중 남길 카드
          onKeep={(index: number) =>
            sendMessage({ type: 'ct_keep', payload: { index } })
          }
          // ② 건설 — 건축가는 여러 번 보낼 수 있다
          onBuild={(cardId: number) =>
            sendMessage({ type: 'ct_build', payload: { cardId } })
          }
          // ③ 직업 능력 — 직업마다 쓰는 필드가 다르다
          onAbility={(payload: CTAbilityPayload) =>
            sendMessage({ type: 'ct_ability', payload })
          }
          onEndTurn={() => sendMessage({ type: 'ct_end_turn', payload: {} })}
        />
      ) : (
        <CitadelsWaitingRoom
          game={game}
          hasJoined={hasJoined}
          toasts={toasts}
          onJoin={(name, room) =>
            sendMessage({
              type: 'ct_join_game',
              // room 생략 = 공용 로비 (기존 와이어 그대로 — 하위 호환)
              payload: room ? { name, room } : { name },
            })
          }
          onStart={() => sendMessage({ type: 'ct_start', payload: {} })}
          onFillBots={() => sendMessage({ type: 'ct_fill_bots', payload: {} })}
          onBack={onBack}
        />
      )}
    </div>
  );
}
