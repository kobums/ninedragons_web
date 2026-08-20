import { useEffect, useRef, useState } from 'react';
import type {
  LVEvent,
  LVGameOverPayload,
  LVGameState,
  LVMessage,
  LVPrivateInfo,
} from '../types/loveletter';
import { LV_SESSION_KEY } from '../types/loveletter';
import { clearSessionId, saveSessionId } from '../utils/session';

// 화면에 잠깐 띄우는 이벤트 토스트
export interface LVToast {
  id: number;
  event: LVEvent;
}

interface LVState {
  // 참가 요청이 수락됐는지 (이름 입력 → 대기실 전환용)
  hasJoined: boolean;
  game: LVGameState | null;
  gameOver: LVGameOverPayload | null;
  error: string | null;
  // 게임 중 사람 좌석이 끊겨 재접속 대기 중인지 (배너용)
  someoneDisconnected: boolean;
}

const initialState: LVState = {
  hasJoined: false,
  game: null,
  gameOver: null,
  error: null,
  someoneDisconnected: false,
};

// react 는 셸의 useReactions 가 ReactionOverlay 로 따로 띄운다 (TOAST_SKIP 결)
const TOAST_SKIP: ReadonlySet<string> = new Set(['react']);

// 개인 결과 패널(사제 열람·남작 비교)이 화면에 머무는 시간(ms)
const PRIVATE_TTL = 10_000;

// 서버가 상태 변경마다 개인화 전체 스냅샷(lv_game_state)을 보내므로
// 이 훅은 스냅샷을 그대로 반영하고 토스트/개인 정보/에러만 따로 관리한다.
// (useAvalonGameState 결 — 다인이라 2인 전용 스냅샷 훅은 안 쓴다)
export const useLoveLetterGameState = (lastMessage: LVMessage | null) => {
  const [state, setState] = useState<LVState>(initialState);
  const [toasts, setToasts] = useState<LVToast[]>([]);
  const toastId = useRef(0);
  // 사제 열람·남작 비교 결과 — 잠시 뒤 스스로 사라진다 (수동 닫기도 가능)
  const [privateInfo, setPrivateInfo] = useState<LVPrivateInfo | null>(null);
  const privateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!lastMessage) return;

    switch (lastMessage.type) {
      case 'lv_player_joined': {
        const payload = lastMessage.payload as { sessionId?: string };
        if (payload?.sessionId) {
          saveSessionId(LV_SESSION_KEY, payload.sessionId);
        }
        setState((prev) => ({ ...prev, hasJoined: true }));
        break;
      }

      case 'lv_game_state': {
        const game = lastMessage.payload as LVGameState;
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

      case 'lv_event': {
        const event = lastMessage.payload as LVEvent;
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

      case 'lv_private': {
        const info = lastMessage.payload as LVPrivateInfo;
        if (!info?.message) break;
        setPrivateInfo(info);
        if (privateTimer.current) clearTimeout(privateTimer.current);
        privateTimer.current = setTimeout(
          () => setPrivateInfo(null),
          PRIVATE_TTL,
        );
        break;
      }

      case 'lv_game_over': {
        const gameOver = (lastMessage.payload ?? {}) as LVGameOverPayload;
        clearSessionId(LV_SESSION_KEY);
        setState((prev) => ({ ...prev, gameOver, someoneDisconnected: false }));
        break;
      }

      case 'lv_player_disconnected':
        setState((prev) => ({ ...prev, someoneDisconnected: true }));
        break;

      case 'lv_player_reconnected':
        // 정확한 접속 상태는 뒤따르는 lv_game_state 가 채운다
        setState((prev) => ({ ...prev, someoneDisconnected: false }));
        break;

      case 'lv_session_expired':
        clearSessionId(LV_SESSION_KEY);
        setState((prev) => {
          // 게임 종료 화면은 유지한다 (세션 만료는 정리 신호일 뿐)
          if (prev.gameOver) return prev;
          return { ...initialState };
        });
        break;

      case 'lv_error': {
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

  const clearPrivate = () => {
    if (privateTimer.current) clearTimeout(privateTimer.current);
    setPrivateInfo(null);
  };

  const reset = () => {
    clearSessionId(LV_SESSION_KEY);
    setState(initialState);
    setToasts([]);
    setPrivateInfo(null);
  };

  return { ...state, toasts, privateInfo, clearPrivate, clearError, reset };
};
