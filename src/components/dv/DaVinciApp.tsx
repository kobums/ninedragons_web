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

  return (
    <div className="app">
      <ConnectionBanner
        isConnected={isConnected}
        opponentDisconnected={someoneDisconnected}
        isGameActive={Boolean(game) && !gameOver}
      />
      <GameInfoButton game="davinci" />

      {gameOver ? (
        <DVGameOver
          result={gameOver}
          yourSeat={game?.yourSeat ?? null}
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
