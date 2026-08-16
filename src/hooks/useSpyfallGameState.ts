import { useEffect, useRef, useState } from 'react';
import type { SPEvent, SPGameState, SPMessage } from '../types/spyfall';
import { SP_SESSION_KEY } from '../types/spyfall';
import { clearSessionId, saveSessionId } from '../utils/session';

// 화면에 잠깐 띄우는 이벤트 토스트
export interface SPToast {
  id: number;
  event: SPEvent;
}

interface SPState {
  // 참가 요청이 수락됐는지 (이름 입력 → 대기실 전환용)
  hasJoined: boolean;
  game: SPGameState | null;
  // sp_game_over 신호 — 종료 화면 자체는 마지막 스냅샷(result 포함)으로 그린다
  gameOver: boolean;
  error: string | null;
  // 게임 중 사람 좌석이 끊겨 재접속 대기 중인지 (배너용)
  someoneDisconnected: boolean;
}

const initialState: SPState = {
  hasJoined: false,
  game: null,
  gameOver: false,
  error: null,
  someoneDisconnected: false,
};

// 서버가 상태 변경마다 개인화 전체 스냅샷(sp_game_state)을 보내므로
// 이 훅은 스냅샷을 그대로 반영하고 토스트/에러만 따로 관리한다.
// (useSkyfallGameState 결 — 다인이라 2인 전용 훅은 안 쓴다)
export const useSpyfallGameState = (lastMessage: SPMessage | null) => {
  const [state, setState] = useState<SPState>(initialState);
  const [toasts, setToasts] = useState<SPToast[]>([]);
  const toastId = useRef(0);

  useEffect(() => {
    if (!lastMessage) return;

    switch (lastMessage.type) {
      case 'sp_player_joined': {
        const payload = lastMessage.payload as { sessionId?: string };
        if (payload?.sessionId) {
          saveSessionId(SP_SESSION_KEY, payload.sessionId);
        }
        setState((prev) => ({ ...prev, hasJoined: true }));
        break;
      }

      case 'sp_game_state': {
        const game = lastMessage.payload as SPGameState;
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

      case 'sp_event': {
        const event = lastMessage.payload as SPEvent;
        toastId.current += 1;
        const id = toastId.current;
        setToasts((prev) => [...prev.slice(-3), { id, event }]);
        // 토스트는 4초 뒤 스스로 사라진다
        setTimeout(() => {
          setToasts((prev) => prev.filter((toast) => toast.id !== id));
        }, 4000);
        break;
      }

      case 'sp_game_over':
        clearSessionId(SP_SESSION_KEY);
        setState((prev) => ({
          ...prev,
          gameOver: true,
          someoneDisconnected: false,
        }));
        break;

      case 'sp_opponent_disconnected':
        setState((prev) => ({ ...prev, someoneDisconnected: true }));
        break;

      case 'sp_reconnected':
        // 정확한 접속 상태는 뒤따르는 sp_game_state 가 채운다
        setState((prev) => ({ ...prev, someoneDisconnected: false }));
        break;

      case 'sp_session_expired':
        clearSessionId(SP_SESSION_KEY);
        setState((prev) => {
          // 게임 종료 화면은 유지한다 (세션 만료는 정리 신호일 뿐)
          if (prev.gameOver) return prev;
          return { ...initialState };
        });
        break;

      case 'sp_error': {
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
    clearSessionId(SP_SESSION_KEY);
    setState(initialState);
    setToasts([]);
  };

  return { ...state, toasts, clearError, reset };
};
