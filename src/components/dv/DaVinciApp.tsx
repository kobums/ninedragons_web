import { useEffect } from 'react';
import { useDVWebSocket } from '../../hooks/useDVWebSocket';
import { useDVGameState } from '../../hooks/useDVGameState';
import { DVLobby } from './DVLobby';
import { DVGameBoard } from './DVGameBoard';
import { DVGameOver } from './DVGameOver';
import { ConnectionBanner } from '../ConnectionBanner';
import { GameInfoButton } from '../GameInfoButton';
import { DV_SESSION_KEY, getSessionId } from '../../utils/session';

// 로컬 개발 시에는 로컬 서버, 그 외에는 배포 서버(wss 고정)로 접속
const isLocalHost =
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1';
const WS_URL = isLocalHost
  ? 'ws://localhost:8003/ws/davinci'
  : 'wss://ninedragonsapi.gowoobro.com/ws/davinci';

interface DaVinciAppProps {
  onBack: () => void;
}

export function DaVinciApp({ onBack }: DaVinciAppProps) {
  const { isConnected, lastMessage, sendMessage } = useDVWebSocket(WS_URL, {
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
    return (
      <div className="app">
        <div className="connecting">서버에 연결 중...</div>
      </div>
    );
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
          onJoin={(playerName) =>
            sendMessage({ type: 'dv_join_lobby', payload: { playerName } })
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
