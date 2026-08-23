import { useEffect, useRef, useState } from 'react';
import type {
  MIEvent,
  MIGameOverPayload,
  MIGameState,
  MIMessage,
} from '../types/mind';
import { MI_SESSION_KEY } from '../types/mind';
import { clearSessionId, saveSessionId } from '../utils/session';

// 화면에 잠깐 띄우는 이벤트 토스트
export interface MIToast {
  id: number;
  event: MIEvent;
}

interface MIState {
  // 참가 요청이 수락됐는지 (이름 입력 → 대기실 전환용)
  hasJoined: boolean;
  game: MIGameState | null;
  gameOver: MIGameOverPayload | null;
  error: string | null;
  // 게임 중 사람 좌석이 끊겨 재접속 대기 중인지 (배너용)
  someoneDisconnected: boolean;
}

const initialState: MIState = {
  hasJoined: false,
  game: null,
  gameOver: null,
  error: null,
  someoneDisconnected: false,
};

// 보드가 스냅샷으로 직접 그리는 것들은 토스트에서 뺀다 — 차례가 없는 실시간
// 게임이라 초당 여러 건이 쏟아지면 토스트가 화면을 덮는다.
// play: 중앙의 큰 숫자와 더미가 곧 사실이다.
// mistake: 실수 패널(lastMistake)이 크게 그린다 — 이 게임 최대의 연출.
// star_*: 수리검 바(starVote)가 남은 초까지 그린다.
const TOAST_SKIP: ReadonlySet<string> = new Set([
  'play',
  'mistake',
  'star_propose',
  'star_accept',
  'star_decline',
]);

// 서버가 상태 변경마다 개인화 전체 스냅샷(mi_game_state)을 보내므로
// 이 훅은 스냅샷을 그대로 반영하고 토스트/에러만 따로 관리한다.
// (useSetGameState·useKrakenGameState 결 — 실시간 + 손패 은닉 스냅샷형)
export const useMindGameState = (lastMessage: MIMessage | null) => {
  const [state, setState] = useState<MIState>(initialState);
  const [toasts, setToasts] = useState<MIToast[]>([]);
  const toastId = useRef(0);

  useEffect(() => {
    if (!lastMessage) return;

    switch (lastMessage.type) {
      case 'mi_player_joined': {
        const payload = lastMessage.payload as { sessionId?: string };
        if (payload?.sessionId) {
          saveSessionId(MI_SESSION_KEY, payload.sessionId);
        }
        setState((prev) => ({ ...prev, hasJoined: true }));
        break;
      }

      case 'mi_game_state': {
        const game = lastMessage.payload as MIGameState;
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

      case 'mi_event': {
        const event = lastMessage.payload as MIEvent;
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

      case 'mi_game_over': {
        const gameOver = (lastMessage.payload ?? {}) as MIGameOverPayload;
        clearSessionId(MI_SESSION_KEY);
        setState((prev) => ({ ...prev, gameOver, someoneDisconnected: false }));
        break;
      }

      case 'mi_player_disconnected':
        setState((prev) => ({ ...prev, someoneDisconnected: true }));
        break;

      case 'mi_player_reconnected':
        // 정확한 접속 상태는 뒤따르는 mi_game_state 가 채운다
        setState((prev) => ({ ...prev, someoneDisconnected: false }));
        break;

      case 'mi_session_expired':
        clearSessionId(MI_SESSION_KEY);
        setState((prev) => {
          // 게임 종료 화면은 유지한다 (세션 만료는 정리 신호일 뿐)
          if (prev.gameOver) return prev;
          return { ...initialState };
        });
        break;

      case 'mi_error': {
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
    clearSessionId(MI_SESSION_KEY);
    setState(initialState);
    setToasts([]);
  };

  return { ...state, toasts, clearError, reset };
};
