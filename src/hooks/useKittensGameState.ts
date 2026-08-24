import { useEffect, useRef, useState } from 'react';
import type {
  EKCard,
  EKEvent,
  EKFuturePayload,
  EKGameOverPayload,
  EKGameState,
  EKMessage,
} from '../types/kittens';
import { EK_FUTURE_COUNT, EK_SESSION_KEY, ekIsCard } from '../types/kittens';
import { clearSessionId, saveSessionId } from '../utils/session';

// 화면에 잠깐 띄우는 이벤트 토스트
export interface EKToast {
  id: number;
  event: EKEvent;
}

// 미리보기 결과 — 나에게만 온 덱 맨 위 3장.
// ctx 는 이 결과가 유효한 스냅샷 컨텍스트다. 개인 이벤트가 스냅샷보다 먼저
// 도착할 수도 있어, 스냅샷이 아직 없으면 null 로 두고 다음 스냅샷에서 고정한다.
interface EKFutureState {
  cards: EKCard[];
  ctx: string | null;
}

interface EKState {
  // 참가 요청이 수락됐는지 (이름 입력 → 대기실 전환용)
  hasJoined: boolean;
  game: EKGameState | null;
  gameOver: EKGameOverPayload | null;
  error: string | null;
  // 게임 중 사람 좌석이 끊겨 재접속 대기 중인지 (배너용)
  someoneDisconnected: boolean;
  future: EKFutureState | null;
}

const initialState: EKState = {
  hasJoined: false,
  game: null,
  gameOver: null,
  error: null,
  someoneDisconnected: false,
  future: null,
};

// react 는 셸의 useReactions 가 ReactionOverlay 로 따로 띄운다.
const TOAST_SKIP: ReadonlySet<string> = new Set(['react']);

// 미리보기 결과가 유효한 컨텍스트 키.
// 미리보기 카드 자체는 덱 잔량·차례를 바꾸지 않으므로 이 둘만 본다 — 하나라도
// 바뀌면(누가 뽑았거나 차례가 넘어갔으면) 본 3장은 더 이상 덱 맨 위가 아니다.
// phase 는 넣지 않는다. 안돼 창처럼 잠깐 끼어드는 단계에서 지워지면 안 된다.
const futureCtxOf = (game: EKGameState): string =>
  `${game.currentSeat}|${game.deckLeft}`;

// 서버가 상태 변경마다 개인화 전체 스냅샷(ek_game_state)을 보내므로
// 이 훅은 스냅샷을 그대로 반영하고 토스트·에러·개인 미리보기만 따로 관리한다.
// (useKrakenGameState 결 — 다인 은닉 스냅샷형)
export const useKittensGameState = (lastMessage: EKMessage | null) => {
  const [state, setState] = useState<EKState>(initialState);
  const [toasts, setToasts] = useState<EKToast[]>([]);
  const toastId = useRef(0);

  useEffect(() => {
    if (!lastMessage) return;

    switch (lastMessage.type) {
      case 'ek_player_joined': {
        const payload = lastMessage.payload as { sessionId?: string };
        if (payload?.sessionId) {
          saveSessionId(EK_SESSION_KEY, payload.sessionId);
        }
        setState((prev) => ({ ...prev, hasJoined: true }));
        break;
      }

      case 'ek_game_state': {
        const game = lastMessage.payload as EKGameState;
        setState((prev) => {
          const ctx = futureCtxOf(game);
          let future = prev.future;
          if (future) {
            if (game.phase === 'game_over' || game.phase === 'waiting') {
              future = null;
            } else if (future.ctx === null) {
              // 스냅샷보다 먼저 온 개인 이벤트 — 여기서 컨텍스트를 고정한다
              future = { ...future, ctx };
            } else if (future.ctx !== ctx) {
              future = null;
            }
          }
          return {
            ...prev,
            game,
            hasJoined: true,
            future,
            someoneDisconnected:
              game.phase !== 'waiting' &&
              game.phase !== 'game_over' &&
              (game.players ?? []).some((p) => !p.connected && !p.bot),
          };
        });
        break;
      }

      case 'ek_future': {
        const payload = (lastMessage.payload ?? {}) as EKFuturePayload;
        const cards = (payload.cards ?? [])
          .filter((c): c is EKCard => ekIsCard(c as string))
          .slice(0, EK_FUTURE_COUNT);
        if (cards.length === 0) break;
        setState((prev) => ({
          ...prev,
          // 스냅샷이 이미 있으면 그 컨텍스트에 바로 묶는다
          future: { cards, ctx: prev.game ? futureCtxOf(prev.game) : null },
        }));
        break;
      }

      case 'ek_event': {
        const event = lastMessage.payload as EKEvent;
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

      case 'ek_game_over': {
        const gameOver = (lastMessage.payload ?? {}) as EKGameOverPayload;
        clearSessionId(EK_SESSION_KEY);
        setState((prev) => ({
          ...prev,
          gameOver,
          future: null,
          someoneDisconnected: false,
        }));
        break;
      }

      case 'ek_player_disconnected':
        setState((prev) => ({ ...prev, someoneDisconnected: true }));
        break;

      case 'ek_player_reconnected':
        // 정확한 접속 상태는 뒤따르는 ek_game_state 가 채운다
        setState((prev) => ({ ...prev, someoneDisconnected: false }));
        break;

      case 'ek_session_expired':
        clearSessionId(EK_SESSION_KEY);
        setState((prev) => {
          // 게임 종료 화면은 유지한다 (세션 만료는 정리 신호일 뿐)
          if (prev.gameOver) return prev;
          return { ...initialState };
        });
        break;

      case 'ek_error': {
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
    clearSessionId(EK_SESSION_KEY);
    setState(initialState);
    setToasts([]);
  };

  return {
    ...state,
    // 보드는 카드 배열만 쓴다 (컨텍스트 고정은 훅 내부 사정)
    futureCards: state.future?.cards ?? null,
    toasts,
    clearError,
    reset,
  };
};
