import { useReconnectingWebSocket } from '../../hooks/useReconnectingWebSocket';
import { buildWsUrl } from '../../utils/ws';
import { useTichuGameState } from '../../hooks/useTichuGameState';
import { TichuWaitingRoom } from './TichuWaitingRoom';
import { TichuBoard } from './TichuBoard';
import { TichuGameOver } from './TichuGameOver';
import { ConnectionBanner } from '../ConnectionBanner';
import { ConnectingScreen } from '../ConnectingScreen';
import { ErrorToast } from '../ErrorToast';
import { GameInfoButton } from '../GameInfoButton';
import type { TichuCard, TichuMessage } from '../../types/tichu';
import { TC_SESSION_KEY } from '../../types/tichu';
import { getSessionId } from '../../utils/session';

interface TichuAppProps {
  onBack: () => void;
}

export function TichuApp({ onBack }: TichuAppProps) {
  const { isConnected, lastMessage, sendMessage } =
    useReconnectingWebSocket<TichuMessage>(buildWsUrl('/ws/tichu'), {
      logPrefix: '[Tichu] WebSocket',
      onOpen: () => {
        // 진행 중이던 게임이 있으면 세션 ID로 복귀를 시도한다
        const sessionId = getSessionId(TC_SESSION_KEY);
        if (sessionId) {
          sendMessage({ type: 'tc_rejoin', payload: { sessionId } });
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
  } = useTichuGameState(lastMessage);

  // 게임 시작 전에만 전체 화면 연결 대기 표시
  if (!isConnected && !game) {
    return <ConnectingScreen />;
  }

  const isGameOver = Boolean(gameOver) || game?.phase === 'game_over';
  const inGame = Boolean(game) && game!.phase !== 'waiting';

  return (
    <div className="app">
      <ConnectionBanner
        isConnected={isConnected}
        opponentDisconnected={someoneDisconnected}
        isGameActive={!isGameOver && (inGame || Boolean(game))}
        disconnectText={`${
          game?.players
            .filter((p) => !p.connected && !p.bot)
            .map((p) => p.name)
            .join(', ') || '참가자'
        }님의 연결이 끊겼습니다 — 90초 내 미복귀 시 봇이 이어받습니다`}
      />
      <ErrorToast error={error} onClear={clearError} />
      <GameInfoButton game="tichu" />

      {isGameOver ? (
        <TichuGameOver
          game={game}
          gameOver={gameOver}
          // 재대결 없음 — 상태를 비워 대기실(입장 화면)로 돌아간다
          onNewGame={reset}
        />
      ) : inGame && game ? (
        <TichuBoard
          game={game}
          toasts={toasts}
          onCallGrand={(call: boolean) =>
            sendMessage({ type: 'tc_call_grand', payload: { call } })
          }
          onCallTichu={() => sendMessage({ type: 'tc_call_tichu', payload: {} })}
          onExchange={(left: TichuCard, partner: TichuCard, right: TichuCard) =>
            sendMessage({ type: 'tc_exchange', payload: { left, partner, right } })
          }
          onPlay={(cards: TichuCard[], wish?: number) =>
            sendMessage({
              type: 'tc_play',
              payload: wish !== undefined ? { cards, wish } : { cards },
            })
          }
          onPass={() => sendMessage({ type: 'tc_pass', payload: {} })}
          onDragonGive={(seat: number) =>
            sendMessage({ type: 'tc_dragon_give', payload: { seat } })
          }
          onReady={() => sendMessage({ type: 'tc_ready', payload: {} })}
        />
      ) : (
        <TichuWaitingRoom
          game={game}
          toasts={toasts}
          hasJoined={hasJoined}
          onJoin={(name: string) =>
            sendMessage({ type: 'tc_join_game', payload: { name } })
          }
          onSetTarget={(target: 500 | 1000) =>
            sendMessage({ type: 'tc_set_target', payload: { target } })
          }
          onFillBots={() => sendMessage({ type: 'tc_fill_bots', payload: {} })}
          onBack={onBack}
        />
      )}
    </div>
  );
}
