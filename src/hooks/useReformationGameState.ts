import { useEffect, useRef, useState } from 'react';
import type {
  RFEvent,
  RFGameOverPayload,
  RFGameState,
  RFMessage,
} from '../types/reformation';
import { RF_SESSION_KEY } from '../types/reformation';
import { clearSessionId, saveSessionId } from '../utils/session';

// 이벤트 피드 한 줄 (최근 3줄 유지)
export interface RFToast {
  id: number;
  event: RFEvent;
}

interface RFState {
  // 참가 요청이 수락됐는지 (이름 입력 → 대기실 전환용)
  hasJoined: boolean;
  game: RFGameState | null;
  gameOver: RFGameOverPayload | null;
  error: string | null;
  // 게임 중 사람 좌석이 끊겨 재접속 대기 중인지 (배너용)
  someoneDisconnected: boolean;
}

const initialState: RFState = {
  hasJoined: false,
  game: null,
  gameOver: null,
  error: null,
  someoneDisconnected: false,
};

// react 는 셸의 useReactions 가 ReactionOverlay 로 따로 띄우므로 피드에서 거른다
const TOAST_SKIP: ReadonlySet<string> = new Set(['react']);

// 이벤트 피드 최대 줄 수
const MAX_FEED = 3;

// 서버가 상태 변경마다 개인화 전체 스냅샷(rf_game_state)을 보내므로
// 이 훅은 스냅샷을 그대로 반영하고 피드/에러만 따로 관리한다.
// (useCoupGameState 결 — 다인 스냅샷형)
export const useReformationGameState = (lastMessage: RFMessage | null) => {
  const [state, setState] = useState<RFState>(initialState);
  const [toasts, setToasts] = useState<RFToast[]>([]);
  const toastId = useRef(0);

  useEffect(() => {
    if (!lastMessage) return;

    switch (lastMessage.type) {
      case 'rf_player_joined': {
        const payload = lastMessage.payload as { sessionId?: string };
        if (payload?.sessionId) {
          saveSessionId(RF_SESSION_KEY, payload.sessionId);
        }
        setState((prev) => ({ ...prev, hasJoined: true }));
        break;
      }

      case 'rf_game_state': {
        const game = lastMessage.payload as RFGameState;
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

      case 'rf_event': {
        const event = lastMessage.payload as RFEvent;
        if (TOAST_SKIP.has(event.kind)) break;
        toastId.current += 1;
        const id = toastId.current;
        setToasts((prev) => [...prev.slice(-(MAX_FEED - 1)), { id, event }]);
        // 피드 줄은 5초 뒤 스스로 사라진다
        setTimeout(() => {
          setToasts((prev) => prev.filter((toast) => toast.id !== id));
        }, 5000);
        break;
      }

      case 'rf_game_over': {
        const gameOver = (lastMessage.payload ?? {}) as RFGameOverPayload;
        clearSessionId(RF_SESSION_KEY);
        setState((prev) => ({ ...prev, gameOver, someoneDisconnected: false }));
        break;
      }

      case 'rf_player_disconnected':
        setState((prev) => ({ ...prev, someoneDisconnected: true }));
        break;

      case 'rf_player_reconnected':
        // 정확한 접속 상태는 뒤따르는 rf_game_state 가 채운다
        setState((prev) => ({ ...prev, someoneDisconnected: false }));
        break;

      case 'rf_session_expired':
        clearSessionId(RF_SESSION_KEY);
        setState((prev) => {
          // 게임 종료 화면은 유지한다 (세션 만료는 정리 신호일 뿐)
          if (prev.gameOver) return prev;
          return { ...initialState };
        });
        break;

      case 'rf_error': {
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
    clearSessionId(RF_SESSION_KEY);
    setState(initialState);
    setToasts([]);
  };

  return { ...state, toasts, clearError, reset };
};
