import { useEffect, useRef, useState } from 'react';
import type {
  SBEvent,
  SBGameOverPayload,
  SBGameState,
  SBMapReveal,
  SBMessage,
} from '../types/saboteur';
import { SB_SESSION_KEY } from '../types/saboteur';
import { clearSessionId, saveSessionId } from '../utils/session';

// 화면에 잠깐 띄우는 이벤트 토스트
export interface SBToast {
  id: number;
  event: SBEvent;
}

interface SBState {
  // 참가 요청이 수락됐는지 (이름 입력 → 대기실 전환용)
  hasJoined: boolean;
  game: SBGameState | null;
  gameOver: SBGameOverPayload | null;
  error: string | null;
  // 게임 중 사람 좌석이 끊겨 재접속 대기 중인지 (배너용)
  someoneDisconnected: boolean;
  // 지도 카드로 나만 확인한 목표 타일 (개인 이벤트 sb_map 누적)
  maps: SBMapReveal[];
}

const initialState: SBState = {
  hasJoined: false,
  game: null,
  gameOver: null,
  error: null,
  someoneDisconnected: false,
  maps: [],
};

// react 는 셸의 useReactions 가 ReactionOverlay 로 따로 띄운다.
// place/action 결과는 보드가 스냅샷(board·lastAction)으로 직접 그린다.
const TOAST_SKIP: ReadonlySet<string> = new Set(['react']);

// 서버가 상태 변경마다 개인화 전체 스냅샷(sb_game_state)을 보내므로
// 이 훅은 스냅샷을 그대로 반영하고 토스트/에러/지도만 따로 관리한다.
// (useKrakenGameState 결 — 다인 정체 은닉 스냅샷형)
export const useSaboteurGameState = (lastMessage: SBMessage | null) => {
  const [state, setState] = useState<SBState>(initialState);
  const [toasts, setToasts] = useState<SBToast[]>([]);
  const toastId = useRef(0);

  useEffect(() => {
    if (!lastMessage) return;

    switch (lastMessage.type) {
      case 'sb_player_joined': {
        const payload = lastMessage.payload as { sessionId?: string };
        if (payload?.sessionId) {
          saveSessionId(SB_SESSION_KEY, payload.sessionId);
        }
        setState((prev) => ({ ...prev, hasJoined: true }));
        break;
      }

      case 'sb_game_state': {
        const game = lastMessage.payload as SBGameState;
        setState((prev) => ({
          ...prev,
          game,
          hasJoined: true,
          someoneDisconnected:
            game.phase !== 'waiting' &&
            game.phase !== 'game_over' &&
            (game.players ?? []).some((p) => !p.connected && !p.bot),
          // 대기실로 돌아가면(새 판) 내가 봤던 지도는 더 이상 유효하지 않다
          maps: game.phase === 'waiting' ? [] : prev.maps,
        }));
        break;
      }

      case 'sb_map': {
        // 지도를 쓴 사람에게만 오는 개인 이벤트 — 같은 목표는 갱신한다
        const reveal = lastMessage.payload as SBMapReveal | undefined;
        if (!reveal || typeof reveal.index !== 'number') break;
        setState((prev) => ({
          ...prev,
          maps: [
            ...prev.maps.filter((m) => m.index !== reveal.index),
            { index: reveal.index, gold: reveal.gold === true },
          ].sort((a, b) => a.index - b.index),
        }));
        break;
      }

      case 'sb_event': {
        const event = lastMessage.payload as SBEvent;
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

      case 'sb_game_over': {
        const gameOver = (lastMessage.payload ?? {}) as SBGameOverPayload;
        clearSessionId(SB_SESSION_KEY);
        setState((prev) => ({ ...prev, gameOver, someoneDisconnected: false }));
        break;
      }

      case 'sb_player_disconnected':
        setState((prev) => ({ ...prev, someoneDisconnected: true }));
        break;

      case 'sb_player_reconnected':
        // 정확한 접속 상태는 뒤따르는 sb_game_state 가 채운다
        setState((prev) => ({ ...prev, someoneDisconnected: false }));
        break;

      case 'sb_session_expired':
        clearSessionId(SB_SESSION_KEY);
        setState((prev) => {
          // 게임 종료 화면은 유지한다 (세션 만료는 정리 신호일 뿐)
          if (prev.gameOver) return prev;
          return { ...initialState };
        });
        break;

      case 'sb_error': {
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
    clearSessionId(SB_SESSION_KEY);
    setState(initialState);
    setToasts([]);
  };

  return { ...state, toasts, clearError, reset };
};
