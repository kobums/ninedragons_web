import { useEffect, useRef, useState } from 'react';
import type {
  MTEvent,
  MTGameState,
  MTMessage,
  MTResult,
} from '../types/mighty';
import { MT_SESSION_KEY } from '../types/mighty';
import { clearSessionId, saveSessionId } from '../utils/session';

// 화면에 잠깐 띄우는 이벤트 토스트
export interface MTToast {
  id: number;
  event: MTEvent;
}

interface MTState {
  // 참가 요청이 수락됐는지 (이름 입력 → 대기실 전환용)
  hasJoined: boolean;
  game: MTGameState | null;
  gameOver: MTResult | null;
  error: string | null;
  // 게임 중 사람 좌석이 끊겨 재접속 대기 중인지 (배너용)
  someoneDisconnected: boolean;
}

const initialState: MTState = {
  hasJoined: false,
  game: null,
  gameOver: null,
  error: null,
  someoneDisconnected: false,
};

// 매 플레이마다 오는 잔이벤트는 스냅샷 갱신으로 충분해 토스트에서 거른다
const TOAST_SKIP: ReadonlySet<string> = new Set(['play', 'bid', 'pass']);

// 서버가 상태 변경마다 개인화 전체 스냅샷(mt_game_state)을 보내므로
// 이 훅은 스냅샷을 그대로 반영하고 토스트/에러만 따로 관리한다.
// (useDVGameState 결 — 5인이라 useSnapshotGameState(2인 전용)는 쓰지 않는다)
export const useMightyGameState = (lastMessage: MTMessage | null) => {
  const [state, setState] = useState<MTState>(initialState);
  const [toasts, setToasts] = useState<MTToast[]>([]);
  const toastId = useRef(0);

  useEffect(() => {
    if (!lastMessage) return;

    switch (lastMessage.type) {
      case 'mt_player_joined': {
        const payload = lastMessage.payload as { sessionId?: string };
        if (payload?.sessionId) {
          saveSessionId(MT_SESSION_KEY, payload.sessionId);
        }
        setState((prev) => ({ ...prev, hasJoined: true }));
        break;
      }

      case 'mt_game_state': {
        const game = lastMessage.payload as MTGameState;
        setState((prev) => ({
          ...prev,
          game,
          hasJoined: true,
          someoneDisconnected:
            game.phase !== 'waiting' &&
            game.phase !== 'game_over' &&
            game.players.some((p) => !p.connected && !p.bot),
        }));
        break;
      }

      case 'mt_event': {
        const event = lastMessage.payload as MTEvent;
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

      case 'mt_game_over': {
        const gameOver = lastMessage.payload as MTResult;
        clearSessionId(MT_SESSION_KEY);
        setState((prev) => ({ ...prev, gameOver, someoneDisconnected: false }));
        break;
      }

      case 'mt_opponent_disconnected':
        setState((prev) => ({ ...prev, someoneDisconnected: true }));
        break;

      case 'mt_reconnected':
        // 정확한 접속 상태는 뒤따르는 mt_game_state 가 채운다
        setState((prev) => ({ ...prev, someoneDisconnected: false }));
        break;

      case 'mt_session_expired':
        clearSessionId(MT_SESSION_KEY);
        setState((prev) => {
          // 게임 종료 화면은 유지한다 (세션 만료는 정리 신호일 뿐)
          if (prev.gameOver) return prev;
          return { ...initialState };
        });
        break;

      case 'mt_error': {
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
    clearSessionId(MT_SESSION_KEY);
    setState(initialState);
    setToasts([]);
  };

  return { ...state, toasts, clearError, reset };
};
