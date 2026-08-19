import { useReconnectingWebSocket } from '../../hooks/useReconnectingWebSocket';
import { buildWsUrl } from '../../utils/ws';
import { useAvalonGameState } from '../../hooks/useAvalonGameState';
import type { AVMessage } from '../../types/avalon';
import { AV_SESSION_KEY } from '../../types/avalon';
import { getSessionId } from '../../utils/session';
import { AvalonWaitingRoom } from './AvalonWaitingRoom';
import { AvalonBoard } from './AvalonBoard';
import { AvalonGameOver } from './AvalonGameOver';
import { ConnectionBanner } from '../ConnectionBanner';
import { ConnectingScreen } from '../ConnectingScreen';
import { ErrorToast } from '../ErrorToast';
import { GameInfoButton } from '../GameInfoButton';

interface AvalonAppProps {
  onBack: () => void;
}

export function AvalonApp({ onBack }: AvalonAppProps) {
  const { isConnected, lastMessage, sendMessage } =
    useReconnectingWebSocket<AVMessage>(buildWsUrl('/ws/avalon'), {
      logPrefix: '[아발론] WebSocket',
      onOpen: () => {
        // 진행 중이던 게임이 있으면 세션 ID로 복귀를 시도한다
        const sessionId = getSessionId(AV_SESSION_KEY);
        if (sessionId) {
          sendMessage({ type: 'av_rejoin', payload: { sessionId } });
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
  } = useAvalonGameState(lastMessage);

  const handleFindNewGame = () => {
    reset();
    window.location.reload();
  };

  const inGame = game !== null && game.phase !== 'waiting';
  // 종료 판정: av_game_over 신호 또는 마지막 스냅샷의 phase.
  // 화면 자체는 스냅샷(전원 역할 공개)으로 그린다.
  const isOver = game !== null && (gameOver !== null || game.phase === 'game_over');

  // 게임 시작 전에만 전체 화면 연결 대기 표시
  if (!isConnected && !inGame) {
    return <ConnectingScreen />;
  }

  return (
    <div className="app">
      <ConnectionBanner
        isConnected={isConnected}
        opponentDisconnected={someoneDisconnected}
        isGameActive={inGame && !isOver}
        disconnectText={`${
          game?.players
            .filter((p) => !p.connected && !p.bot)
            .map((p) => p.name)
            .join(', ') || '참가자'
        }님의 연결이 끊겼습니다 — 90초 내 미복귀 시 봇이 이어받습니다`}
      />
      <ErrorToast error={error} onClear={clearError} />
      <GameInfoButton game="avalon" />

      {isOver && game ? (
        <AvalonGameOver
          game={game}
          winner={gameOver?.winner || game.winner}
          reason={gameOver?.reason}
          onFindNewGame={handleFindNewGame}
        />
      ) : inGame && game ? (
        <AvalonBoard
          game={game}
          toasts={toasts}
          onPick={(seats) => sendMessage({ type: 'av_pick', payload: { seats } })}
          onTeamVote={(approve) =>
            sendMessage({ type: 'av_team_vote', payload: { approve } })
          }
          onQuest={(success) =>
            sendMessage({ type: 'av_quest', payload: { success } })
          }
          onAssassinate={(seat) =>
            sendMessage({ type: 'av_assassinate', payload: { seat } })
          }
        />
      ) : (
        <AvalonWaitingRoom
          game={game}
          toasts={toasts}
          hasJoined={hasJoined}
          onJoin={(name, room) =>
            sendMessage({
              type: 'av_join_game',
              // room 생략 = 공용 로비 (기존 와이어 그대로 — 하위 호환)
              payload: room ? { name, room } : { name },
            })
          }
          onStart={() => sendMessage({ type: 'av_start', payload: {} })}
          onFillBots={() => sendMessage({ type: 'av_fill_bots', payload: {} })}
          onBack={onBack}
        />
      )}
    </div>
  );
}
