import { useEffect, useRef, useState } from 'react';
import type {
  SLEvent,
  SLGameOverPayload,
  SLGameState,
  SLMessage,
} from '../types/splendor';
import { SL_SESSION_KEY } from '../types/splendor';
import { clearSessionId, saveSessionId } from '../utils/session';

// 화면에 잠깐 띄우는 이벤트 토스트
export interface SLToast {
  id: number;
  event: SLEvent;
}

interface SLState {
  // 참가 요청이 수락됐는지 (이름 입력 → 대기실 전환용)
  hasJoined: boolean;
  game: SLGameState | null;
  gameOver: SLGameOverPayload | null;
  error: string | null;
  // 게임 중 사람 좌석이 끊겨 재접속 대기 중인지 (배너용)
  someoneDisconnected: boolean;
}

const initialState: SLState = {
  hasJoined: false,
  game: null,
  gameOver: null,
  error: null,
  someoneDisconnected: false,
};

// react 는 셸의 useReactions 가 ReactionOverlay 로 따로 띄운다.
// 토큰 획득·구매·예약은 보드가 스냅샷(lastAction)으로 직접 그리지만,
// 귀족 획득처럼 놓치면 안 되는 사건은 토스트로도 남긴다.
const TOAST_SKIP: ReadonlySet<string> = new Set(['react']);

// 서버가 상태 변경마다 개인화 전체 스냅샷(sl_game_state)을 보내므로
// 이 훅은 스냅샷을 그대로 반영하고 토스트/에러만 따로 관리한다.
// (useKrakenGameState 결 — 다인 은닉 스냅샷형)
export const useSplendorGameState = (lastMessage: SLMessage | null) => {
  const [state, setState] = useState<SLState>(initialState);
  const [toasts, setToasts] = useState<SLToast[]>([]);
  const toastId = useRef(0);

  useEffect(() => {
    if (!lastMessage) return;

    switch (lastMessage.type) {
      case 'sl_player_joined': {
        const payload = lastMessage.payload as { sessionId?: string };
        if (payload?.sessionId) {
          saveSessionId(SL_SESSION_KEY, payload.sessionId);
        }
        setState((prev) => ({ ...prev, hasJoined: true }));
        break;
      }

      case 'sl_game_state': {
        const game = lastMessage.payload as SLGameState;
        setState((prev) => ({
          ...prev,
          game,
          hasJoined: true,
          someoneDisconnected:
            game.phase !== 'waiting' &&
            game.phase !== 'game_over' &&
            (game.players ?? []).some((p) => !p.connected && !p.bot),
        }));
        break;
      }

      case 'sl_event': {
        const event = lastMessage.payload as SLEvent;
        if (TOAST_SKIP.has(event.kind)) break;
        toastId.current += 1;
        const id = toastId.current;
        setToasts((prev) => [...prev.slice(-3), { id, event }]);
        // 토스트는 4초 뒤 스스로 사라진다
        setTimeout(() => {
          setToasts((prev) => prev.filter((toast) => toast.id !== id));
        }, 4000);
        break;
      }

      case 'sl_game_over': {
        const gameOver = (lastMessage.payload ?? {}) as SLGameOverPayload;
        clearSessionId(SL_SESSION_KEY);
        setState((prev) => ({ ...prev, gameOver, someoneDisconnected: false }));
        break;
      }

      case 'sl_player_disconnected':
        setState((prev) => ({ ...prev, someoneDisconnected: true }));
        break;

      case 'sl_player_reconnected':
        // 정확한 접속 상태는 뒤따르는 sl_game_state 가 채운다
        setState((prev) => ({ ...prev, someoneDisconnected: false }));
        break;

      case 'sl_session_expired':
        clearSessionId(SL_SESSION_KEY);
        setState((prev) => {
          // 게임 종료 화면은 유지한다 (세션 만료는 정리 신호일 뿐)
          if (prev.gameOver) return prev;
          return { ...initialState };
        });
        break;

      case 'sl_error': {
        const payload = lastMessage.payload as { message?: string };
        setState((prev) => ({
          ...prev,
          error: payload?.message ?? '오류가 발생했습니다',
        }));
        break;
      }
    }
  }, [lastMessage]);

  const clearError = () => setState((prev) => ({ ...prev, error: null }));

  const reset = () => {
    clearSessionId(SL_SESSION_KEY);
    setState(initialState);
    setToasts([]);
  };

  return { ...state, toasts, clearError, reset };
};
