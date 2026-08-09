import { useEffect, useRef, useState } from 'react';
import { clearSessionId, saveSessionId } from '../utils/session';

// 스냅샷형 게임(서버가 상태 변경마다 개인화 전체 스냅샷을 보내는 모델)의
// 공용 상태 훅. 쇼텐토텐·지킬앤하이드가 프리픽스만 다른 같은 구조라 통합했다.
// 다빈치는 로비·토스트·N인 접속 판정이 달라 자체 훅(useDVGameState)을 유지한다.

interface SnapshotMessage {
  type: string;
  payload?: unknown;
}

interface SnapshotOptions<TEvent> {
  // 메시지 타입 프리픽스 ('st' → 'st_game_state' 등)
  prefix: string;
  sessionKey: string;
  // 연출 이벤트가 화면에 머무는 시간(ms)
  eventTtl: number;
  // 연출 가치가 있는 이벤트만 남기고 싶을 때
  eventFilter?: (event: TEvent) => boolean;
}

interface SnapshotState<TGame, TOver> {
  // 참가 요청이 수락됐는지 (대기 화면 전환용)
  hasJoined: boolean;
  game: TGame | null;
  gameOver: TOver | null;
  error: string | null;
  opponentDisconnected: boolean;
}

export const useSnapshotGameState = <
  TGame extends { opponentConnected: boolean },
  TOver,
  TEvent,
>(
  lastMessage: SnapshotMessage | null,
  { prefix, sessionKey, eventTtl, eventFilter }: SnapshotOptions<TEvent>,
) => {
  const initialState: SnapshotState<TGame, TOver> = {
    hasJoined: false,
    game: null,
    gameOver: null,
    error: null,
    opponentDisconnected: false,
  };
  const [state, setState] = useState<SnapshotState<TGame, TOver>>(initialState);
  // 마지막 연출 이벤트. 잠시 뒤 스스로 사라진다.
  const [lastEvent, setLastEvent] = useState<TEvent | null>(null);
  const eventTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!lastMessage) return;

    switch (lastMessage.type) {
      case `${prefix}_player_joined`: {
        const payload = lastMessage.payload as { sessionId: string };
        saveSessionId(sessionKey, payload.sessionId);
        setState((prev) => ({ ...prev, hasJoined: true }));
        break;
      }

      case `${prefix}_game_state`: {
        const game = lastMessage.payload as TGame;
        setState((prev) => ({
          ...prev,
          game,
          hasJoined: true,
          opponentDisconnected: !game.opponentConnected,
        }));
        break;
      }

      case `${prefix}_event`: {
        const event = lastMessage.payload as TEvent;
        if (eventFilter && !eventFilter(event)) break;
        setLastEvent(event);
        if (eventTimer.current) clearTimeout(eventTimer.current);
        eventTimer.current = setTimeout(() => setLastEvent(null), eventTtl);
        break;
      }

      case `${prefix}_game_over`: {
        const gameOver = lastMessage.payload as TOver;
        clearSessionId(sessionKey);
        setState((prev) => ({ ...prev, gameOver }));
        break;
      }

      case `${prefix}_opponent_disconnected`:
        setState((prev) => ({ ...prev, opponentDisconnected: true }));
        break;

      case `${prefix}_opponent_reconnected`:
        setState((prev) => ({ ...prev, opponentDisconnected: false }));
        break;

      case `${prefix}_session_expired`:
        clearSessionId(sessionKey);
        setState((prev) => {
          // 게임 종료 화면은 유지한다 (세션 만료는 정리 신호일 뿐)
          if (prev.gameOver) return prev;
          return { ...initialState };
        });
        break;

      case `${prefix}_error`: {
        const payload = lastMessage.payload as { message?: string };
        setState((prev) => ({
          ...prev,
          error: payload?.message ?? '오류가 발생했습니다',
        }));
        break;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastMessage]);

  const clearError = () => setState((prev) => ({ ...prev, error: null }));

  const reset = () => {
    clearSessionId(sessionKey);
    setState(initialState);
    setLastEvent(null);
  };

  return { ...state, lastEvent, clearError, reset };
};
