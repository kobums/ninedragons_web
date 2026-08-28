import { useEffect, useRef, useState } from 'react';
import type {
  BGEvent,
  BGGameOverPayload,
  BGGameState,
  BGMessage,
} from '../types/bang';
import { BG_SESSION_KEY } from '../types/bang';
import { clearSessionId, saveSessionId } from '../utils/session';

// 화면에 잠깐 띄우는 이벤트 토스트
export interface BGToast {
  id: number;
  event: BGEvent;
}

interface BGState {
  // 참가 요청이 수락됐는지 (이름 입력 → 대기실 전환용)
  hasJoined: boolean;
  game: BGGameState | null;
  gameOver: BGGameOverPayload | null;
  error: string | null;
  // 게임 중 사람 좌석이 끊겨 재접속 대기 중인지 (배너용)
  someoneDisconnected: boolean;
}

const initialState: BGState = {
  hasJoined: false,
  game: null,
  gameOver: null,
  error: null,
  someoneDisconnected: false,
};

// react 는 셸의 useReactions 가 ReactionOverlay 로 따로 띄운다.
// 뒤집기 결과·피격·탈락처럼 놓치면 흐름을 잃는 사건은 토스트로 남긴다
// (카드 효과가 많은 게임이라 "방금 무슨 일이 있었나" 가 특히 중요하다).
const TOAST_SKIP: ReadonlySet<string> = new Set(['react']);

// 서버가 상태 변경마다 개인화 전체 스냅샷(bg_game_state)을 보내므로
// 이 훅은 스냅샷을 그대로 반영하고 토스트/에러만 따로 관리한다.
// (useKrakenGameState·useCitadelsGameState 결 — 다인 정체 은닉 스냅샷형)
export const useBangGameState = (lastMessage: BGMessage | null) => {
  const [state, setState] = useState<BGState>(initialState);
  const [toasts, setToasts] = useState<BGToast[]>([]);
  const toastId = useRef(0);

  useEffect(() => {
    if (!lastMessage) return;

    switch (lastMessage.type) {
      case 'bg_player_joined': {
        const payload = lastMessage.payload as { sessionId?: string };
        if (payload?.sessionId) {
          saveSessionId(BG_SESSION_KEY, payload.sessionId);
        }
        setState((prev) => ({ ...prev, hasJoined: true }));
        break;
      }

      case 'bg_game_state': {
        const game = lastMessage.payload as BGGameState;
        setState((prev) => ({
          ...prev,
          game,
          hasJoined: true,
          someoneDisconnected:
            game.phase !== 'waiting' &&
            game.phase !== 'game_over' &&
            (game.players ?? []).some(
              (p) => !p.connected && !p.bot && p.alive,
            ),
        }));
        break;
      }

      case 'bg_event': {
        const event = lastMessage.payload as BGEvent;
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

      case 'bg_game_over': {
        const gameOver = (lastMessage.payload ?? {}) as BGGameOverPayload;
        clearSessionId(BG_SESSION_KEY);
        setState((prev) => ({ ...prev, gameOver, someoneDisconnected: false }));
        break;
      }

      case 'bg_player_disconnected':
        setState((prev) => ({ ...prev, someoneDisconnected: true }));
        break;

      case 'bg_player_reconnected':
        // 정확한 접속 상태는 뒤따르는 bg_game_state 가 채운다
        setState((prev) => ({ ...prev, someoneDisconnected: false }));
        break;

      case 'bg_session_expired':
        clearSessionId(BG_SESSION_KEY);
        setState((prev) => {
          // 게임 종료 화면은 유지한다 (세션 만료는 정리 신호일 뿐)
          if (prev.gameOver) return prev;
          return { ...initialState };
        });
        break;

      case 'bg_error': {
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
    clearSessionId(BG_SESSION_KEY);
    setState(initialState);
    setToasts([]);
  };

  return { ...state, toasts, clearError, reset };
};
