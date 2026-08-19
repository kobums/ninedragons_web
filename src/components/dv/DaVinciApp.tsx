import { useEffect } from 'react';
import { useReconnectingWebSocket } from '../../hooks/useReconnectingWebSocket';
import { GAMES } from '../../config/games';
import { buildWsUrl } from '../../utils/ws';
import { useDVGameState } from '../../hooks/useDVGameState';
import { DVLobby } from './DVLobby';
import { DVGameBoard } from './DVGameBoard';
import { DVGameOver } from './DVGameOver';
import { ConnectionBanner } from '../ConnectionBanner';
import { ConnectingScreen } from '../ConnectingScreen';
import { GameInfoButton } from '../GameInfoButton';
import { ReactionBar } from '../ReactionBar';
import { ReactionOverlay } from '../ReactionOverlay';
import { SpectatorBadge, SpectatorCount } from '../SpectatorBadge';
import { useReactions } from '../../hooks/useReactions';
import { useSpectate } from '../../hooks/useSpectate';
import type { DVMessage } from '../../types/davinci';
import { DV_SESSION_KEY, getSessionId } from '../../utils/session';


interface DaVinciAppProps {
  onBack: () => void;
}

export function DaVinciApp({ onBack }: DaVinciAppProps) {
  const { isConnected, lastMessage, sendMessage } = useReconnectingWebSocket<DVMessage>(buildWsUrl(GAMES.davinci.wsPath), {
    logPrefix: GAMES.davinci.logPrefix,
    onOpen: () => {
      // 진행 중이던 게임이 있으면 세션 ID로 복귀를 시도한다
      const sessionId = getSessionId(DV_SESSION_KEY);
      if (sessionId) {
        sendMessage({ type: 'dv_rejoin_game', payload: { sessionId } });
      }
    },
  });

  const { lobby, game, gameOver, error, someoneDisconnected, toasts, clearError, reset } =
    useDVGameState(lastMessage);

  // 관전 모드 (dv_spectate_joined → 이후 스냅샷은 yourSeat -1)
  const { spectate } = useSpectate(lastMessage, 'dv_spectate_joined');
  const isSpectating = spectate !== null;
  // 리액션 팝 — 훅 토스트 경로와 별개로 dv_event 의 kind 'react' 만 감시
  const reactions = useReactions(lastMessage, 'dv_event');

  useEffect(() => {
    if (error) {
      alert(error);
      clearError();
    }
  }, [error, clearError]);

  const handlePlayAgain = () => {
    reset();
    window.location.reload();
  };

  // 게임 시작 전에만 전체 화면 연결 대기 표시
  if (!isConnected && !game) {
    return <ConnectingScreen />;
  }

  // 리액션은 좌석 보유자만 (관전자는 서버가 에러 처리) — 로비에서도 허용
  const canReact =
    !isSpectating &&
    !gameOver &&
    (game ? game.yourSeat >= 0 : lobby !== null);

  return (
    <div className="app">
      <ConnectionBanner
        isConnected={isConnected}
        opponentDisconnected={someoneDisconnected}
        isGameActive={Boolean(game) && !gameOver}
      />
      <GameInfoButton game="davinci" />
      {isSpectating && <SpectatorBadge roomCode={spectate.roomCode} />}
      {!isSpectating && <SpectatorCount count={game?.spectators ?? 0} />}
      <ReactionOverlay pops={reactions} />
      {canReact && (
        <ReactionBar
          onReact={(emoji) =>
            sendMessage({ type: 'dv_react', payload: { emoji } })
          }
        />
      )}

      {gameOver ? (
        <DVGameOver
          result={gameOver}
          yourSeat={game?.yourSeat ?? null}
          roomCode={game?.roomCode}
          onPlayAgain={handlePlayAgain}
        />
      ) : game ? (
        <DVGameBoard
          game={game}
          toasts={toasts}
          onDraw={(color) => sendMessage({ type: 'dv_draw_tile', payload: { color } })}
          onTakeInitial={(color) =>
            sendMessage({ type: 'dv_take_initial', payload: { color } })
          }
          onGuess={(targetSeat, tileIndex, value) =>
            sendMessage({ type: 'dv_guess', payload: { targetSeat, tileIndex, value } })
          }
          onContinue={(cont) =>
            sendMessage({ type: 'dv_continue_choice', payload: { continue: cont } })
          }
          onPlaceJoker={(tileId, position) =>
            sendMessage({ type: 'dv_place_joker', payload: { tileId, position } })
          }
          onRevealOwn={(tileIndex) =>
            sendMessage({ type: 'dv_reveal_own', payload: { tileIndex } })
          }
        />
      ) : (
        <DVLobby
          lobby={lobby}
          onJoin={(playerName, room) =>
            sendMessage({
              type: 'dv_join_lobby',
              // room 생략 = 공용 로비 (기존 와이어 그대로 — 하위 호환)
              payload: room ? { playerName, room } : { playerName },
            })
          }
          onStart={() => sendMessage({ type: 'dv_start_game' })}
          onLeave={() => {
            sendMessage({ type: 'dv_leave_lobby' });
            reset();
          }}
          onBack={onBack}
        />
      )}
    </div>
  );
}
