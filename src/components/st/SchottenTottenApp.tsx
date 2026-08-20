import { useReconnectingWebSocket } from '../../hooks/useReconnectingWebSocket';
import { GAMES } from '../../config/games';
import { buildWsUrl } from '../../utils/ws';
import { useSTGameState } from '../../hooks/useSTGameState';
import { STWaitingRoom } from './STWaitingRoom';
import { STGameBoard } from './STGameBoard';
import { STGameOver } from './STGameOver';
import { ConnectionBanner } from '../ConnectionBanner';
import { ErrorToast } from '../ErrorToast';
import { ConnectingScreen } from '../ConnectingScreen';
import { GameInfoButton } from '../GameInfoButton';
import type { STMessage } from '../../types/schottentotten';
import { ST_SESSION_KEY, getSessionId } from '../../utils/session';


interface SchottenTottenAppProps {
  onBack: () => void;
}

export function SchottenTottenApp({ onBack }: SchottenTottenAppProps) {
  const { isConnected, lastMessage, sendMessage } = useReconnectingWebSocket<STMessage>(buildWsUrl(GAMES.schottentotten.wsPath), {
    logPrefix: GAMES.schottentotten.logPrefix,
    onOpen: () => {
      // 진행 중이던 게임이 있으면 세션 ID로 복귀를 시도한다
      const sessionId = getSessionId(ST_SESSION_KEY);
      if (sessionId) {
        sendMessage({ type: 'st_rejoin_game', payload: { sessionId } });
      }
    },
  });

  const {
    hasJoined,
    game,
    gameOver,
    error,
    opponentDisconnected,
    rematchOffered,
    lastEvent,
    clearError,
    reset,
  } = useSTGameState(lastMessage);


  const handlePlayAgain = () => {
    reset();
    window.location.reload();
  };

  // 게임 시작 전에만 전체 화면 연결 대기 표시
  if (!isConnected && !game) {
    return <ConnectingScreen />;
  }

  return (
    <div className="app mood-cream">
      <ConnectionBanner
        isConnected={isConnected}
        opponentDisconnected={opponentDisconnected}
        isGameActive={Boolean(game) && !gameOver}
      />
      <ErrorToast error={error} onClear={clearError} />
      <GameInfoButton game="schottentotten" />

      {gameOver ? (
        <STGameOver
          result={gameOver}
          yourSide={game?.yourSide ?? null}
          onPlayAgain={handlePlayAgain}
          rematchOffered={rematchOffered}
          onRematch={() => sendMessage({ type: 'st_rematch' })}
        />
      ) : game ? (
        <STGameBoard
          game={game}
          lastEvent={lastEvent}
          onPlayCard={(handIndex, stoneIndex) =>
            sendMessage({ type: 'st_play_card', payload: { handIndex, stoneIndex } })
          }
          onPlayRuse={(payload) =>
            sendMessage({ type: 'st_play_ruse', payload })
          }
          onClaimStone={(stoneIndex) =>
            sendMessage({ type: 'st_claim_stone', payload: { stoneIndex } })
          }
          onEndTurn={() => sendMessage({ type: 'st_end_turn' })}
          onDraw={(deck) => sendMessage({ type: 'st_draw', payload: { deck } })}
          onPass={() => sendMessage({ type: 'st_pass' })}
          onRecruiterDraw={(deck) =>
            sendMessage({ type: 'st_recruiter_draw', payload: { deck } })
          }
          onRecruiterReturn={(handIndex) =>
            sendMessage({ type: 'st_recruiter_return', payload: { handIndex } })
          }
        />
      ) : (
        <STWaitingRoom
          hasJoined={hasJoined}
          onJoinGame={(playerName, mode) =>
            sendMessage({ type: 'st_join_game', payload: { playerName, mode } })
          }
          onBack={onBack}
        />
      )}
    </div>
  );
}
