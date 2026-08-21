import { useEffect, useRef, useState } from 'react';
import type {
  VGEvent,
  VGGameOverPayload,
  VGGameState,
  VGMessage,
} from '../types/lasvegas';
import { VG_SESSION_KEY } from '../types/lasvegas';
import { clearSessionId, saveSessionId } from '../utils/session';

// 화면에 잠깐 띄우는 이벤트 토스트
export interface VGToast {
  id: number;
  event: VGEvent;
}

interface VGState {
  // 참가 요청이 수락됐는지 (이름 입력 → 대기실 전환용)
  hasJoined: boolean;
  game: VGGameState | null;
  gameOver: VGGameOverPayload | null;
  error: string | null;
  // 게임 중 사람 좌석이 끊겨 재접속 대기 중인지 (배너용)
  someoneDisconnected: boolean;
}

const initialState: VGState = {
  hasJoined: false,
  game: null,
  gameOver: null,
  error: null,
  someoneDisconnected: false,
};

// react 는 셸의 useReactions 가 ReactionOverlay 로 따로 띄운다 (TOAST_SKIP 결)
const TOAST_SKIP: ReadonlySet<string> = new Set(['react']);

// 서버가 상태 변경마다 전체 스냅샷(vg_game_state)을 보내므로
// 이 훅은 스냅샷을 그대로 반영하고 토스트/에러만 따로 관리한다.
// (useYachtGameState 결 — 다인 스냅샷 훅)
export const useLasVegasGameState = (lastMessage: VGMessage | null) => {
  const [state, setState] = useState<VGState>(initialState);
  const [toasts, setToasts] = useState<VGToast[]>([]);
  const toastId = useRef(0);

  useEffect(() => {
    if (!lastMessage) return;

    switch (lastMessage.type) {
      case 'vg_player_joined': {
        const payload = lastMessage.payload as { sessionId?: string };
        if (payload?.sessionId) {
          saveSessionId(VG_SESSION_KEY, payload.sessionId);
        }
        setState((prev) => ({ ...prev, hasJoined: true }));
        break;
      }

      case 'vg_game_state': {
        const game = lastMessage.payload as VGGameState;
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

      case 'vg_event': {
        const event = lastMessage.payload as VGEvent;
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

      case 'vg_game_over': {
        const gameOver = (lastMessage.payload ?? {}) as VGGameOverPayload;
        clearSessionId(VG_SESSION_KEY);
        setState((prev) => ({ ...prev, gameOver, someoneDisconnected: false }));
        break;
      }

      case 'vg_player_disconnected':
        setState((prev) => ({ ...prev, someoneDisconnected: true }));
        break;

      case 'vg_player_reconnected':
        // 정확한 접속 상태는 뒤따르는 vg_game_state 가 채운다
        setState((prev) => ({ ...prev, someoneDisconnected: false }));
        break;

      case 'vg_session_expired':
        clearSessionId(VG_SESSION_KEY);
        setState((prev) => {
          // 게임 종료 화면은 유지한다 (세션 만료는 정리 신호일 뿐)
          if (prev.gameOver) return prev;
          return { ...initialState };
        });
        break;

      case 'vg_error': {
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
    clearSessionId(VG_SESSION_KEY);
    setState(initialState);
    setToasts([]);
  };

  return { ...state, toasts, clearError, reset };
};
