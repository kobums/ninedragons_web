import { useEffect, useRef, useState } from 'react';
import type {
  CREvent,
  CRGameOverPayload,
  CRGameState,
  CRMessage,
  CRPeekPayload,
} from '../types/cockroach';
import { CR_SESSION_KEY } from '../types/cockroach';
import { clearSessionId, saveSessionId } from '../utils/session';

// 화면에 잠깐 띄우는 이벤트 토스트
export interface CRToast {
  id: number;
  event: CREvent;
}

interface CRState {
  // 참가 요청이 수락됐는지 (이름 입력 → 대기실 전환용)
  hasJoined: boolean;
  game: CRGameState | null;
  gameOver: CRGameOverPayload | null;
  error: string | null;
  // 게임 중 사람 좌석이 끊겨 재접속 대기 중인지 (배너용)
  someoneDisconnected: boolean;
  // cr_peek 로 받은 릴레이 카드 실물 (넘기기 확인 패널용, 본 사람만)
  peek: string | null;
}

const initialState: CRState = {
  hasJoined: false,
  game: null,
  gameOver: null,
  error: null,
  someoneDisconnected: false,
  peek: null,
};

// react 는 셸의 useReactions 가 ReactionOverlay 로 따로 띄우므로 토스트에서 거른다
const TOAST_SKIP: ReadonlySet<string> = new Set(['react']);

// 서버가 상태 변경마다 개인화 전체 스냅샷(cr_game_state)을 보내므로
// 이 훅은 스냅샷을 그대로 반영하고 peek/토스트/에러만 따로 관리한다.
// (useNoThanksGameState 결 — 다인 스냅샷형 + 개인 이벤트 cr_peek)
export const useCockroachGameState = (lastMessage: CRMessage | null) => {
  const [state, setState] = useState<CRState>(initialState);
  const [toasts, setToasts] = useState<CRToast[]>([]);
  const toastId = useRef(0);

  useEffect(() => {
    if (!lastMessage) return;

    switch (lastMessage.type) {
      case 'cr_player_joined': {
        const payload = lastMessage.payload as { sessionId?: string };
        if (payload?.sessionId) {
          saveSessionId(CR_SESSION_KEY, payload.sessionId);
        }
        setState((prev) => ({ ...prev, hasJoined: true }));
        break;
      }

      case 'cr_game_state': {
        const game = lastMessage.payload as CRGameState;
        setState((prev) => ({
          ...prev,
          game,
          hasJoined: true,
          someoneDisconnected:
            game.phase !== 'waiting' &&
            game.phase !== 'game_over' &&
            (game.players ?? []).some((p) => !p.connected && !p.bot),
          // peek 는 내가 결정권자로 고민하는 동안만 유효 — 턴이 넘어가거나
          // (판정·전달 완료) 단계가 바뀌면 클리어한다
          peek:
            game.phase === 'deciding' &&
            game.yourSeat >= 0 &&
            game.holderSeat === game.yourSeat
              ? prev.peek
              : null,
        }));
        break;
      }

      case 'cr_peek': {
        // 넘기기 선택자에게만 오는 개인 이벤트 — 릴레이 카드 실물
        const payload = lastMessage.payload as CRPeekPayload | undefined;
        if (payload?.animal) {
          const animal = payload.animal;
          setState((prev) => ({ ...prev, peek: animal }));
        }
        break;
      }

      case 'cr_event': {
        const event = lastMessage.payload as CREvent;
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

      case 'cr_game_over': {
        const gameOver = (lastMessage.payload ?? {}) as CRGameOverPayload;
        clearSessionId(CR_SESSION_KEY);
        setState((prev) => ({
          ...prev,
          gameOver,
          someoneDisconnected: false,
          peek: null,
        }));
        break;
      }

      case 'cr_player_disconnected':
        setState((prev) => ({ ...prev, someoneDisconnected: true }));
        break;

      case 'cr_player_reconnected':
        // 정확한 접속 상태는 뒤따르는 cr_game_state 가 채운다
        setState((prev) => ({ ...prev, someoneDisconnected: false }));
        break;

      case 'cr_session_expired':
        clearSessionId(CR_SESSION_KEY);
        setState((prev) => {
          // 게임 종료 화면은 유지한다 (세션 만료는 정리 신호일 뿐)
          if (prev.gameOver) return prev;
          return { ...initialState };
        });
        break;

      case 'cr_error': {
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
    clearSessionId(CR_SESSION_KEY);
    setState(initialState);
    setToasts([]);
  };

  return { ...state, toasts, clearError, reset };
};
