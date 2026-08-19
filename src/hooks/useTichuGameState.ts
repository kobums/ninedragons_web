import { useEffect, useRef, useState } from 'react';
import type {
  TichuEvent,
  TichuGameOver,
  TichuGameState,
  TichuMessage,
} from '../types/tichu';
import { TC_SESSION_KEY } from '../types/tichu';
import { clearSessionId, saveSessionId } from '../utils/session';

// 화면에 잠깐 띄우는 이벤트 토스트 (useDVGameState 결)
export interface TichuToast {
  id: number;
  event: TichuEvent;
}

interface TichuState {
  // 참가 요청이 수락됐는지 (대기실 화면 전환용)
  hasJoined: boolean;
  game: TichuGameState | null;
  gameOver: TichuGameOver | null;
  error: string | null;
  // 게임 중 사람 플레이어가 끊겨 재접속 대기 중인지 (배너용)
  someoneDisconnected: boolean;
}

const initialState: TichuState = {
  hasJoined: false,
  game: null,
  gameOver: null,
  error: null,
  someoneDisconnected: false,
};

// 서버가 상태 변경마다 개인화 전체 스냅샷(tc_game_state)을 보내므로
// 이 훅은 스냅샷을 그대로 반영하고 토스트/에러만 따로 관리한다.
// (useSnapshotGameState 는 2인 전용이라 쓰지 않는다 — useDVGameState 원형)
export const useTichuGameState = (lastMessage: TichuMessage | null) => {
  const [state, setState] = useState<TichuState>(initialState);
  const [toasts, setToasts] = useState<TichuToast[]>([]);
  const toastId = useRef(0);

  useEffect(() => {
    if (!lastMessage) return;

    switch (lastMessage.type) {
      case 'tc_player_joined': {
        const payload = lastMessage.payload as { sessionId: string };
        saveSessionId(TC_SESSION_KEY, payload.sessionId);
        setState((prev) => ({ ...prev, hasJoined: true }));
        break;
      }

      case 'tc_game_state': {
        const game = lastMessage.payload as TichuGameState;
        // 게임이 끝나면 세션은 서버에서 정리되므로 재접속 시도를 멈춘다
        if (game.phase === 'game_over') {
          clearSessionId(TC_SESSION_KEY);
        }
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

      case 'tc_event': {
        const event = lastMessage.payload as TichuEvent;
        // react 는 셸의 useReactions 가 ReactionOverlay 로 따로 띄운다
        if (event.kind === 'react') break;
        toastId.current += 1;
        const id = toastId.current;
        setToasts((prev) => [...prev.slice(-3), { id, event }]);
        // 토스트는 4초 뒤 스스로 사라진다
        setTimeout(() => {
          setToasts((prev) => prev.filter((toast) => toast.id !== id));
        }, 4000);
        break;
      }

      case 'tc_game_over': {
        const gameOver = lastMessage.payload as TichuGameOver;
        clearSessionId(TC_SESSION_KEY);
        setState((prev) => ({ ...prev, gameOver }));
        break;
      }

      case 'tc_opponent_disconnected':
        setState((prev) => ({ ...prev, someoneDisconnected: true }));
        break;

      case 'tc_reconnected':
        // 정확한 접속 상태는 뒤따르는 tc_game_state 가 채운다
        setState((prev) => ({ ...prev, someoneDisconnected: false }));
        break;

      case 'tc_session_expired':
        clearSessionId(TC_SESSION_KEY);
        setState((prev) => {
          // 게임 종료 화면은 유지한다 (세션 만료는 정리 신호일 뿐)
          if (prev.gameOver || prev.game?.phase === 'game_over') return prev;
          return { ...initialState };
        });
        break;

      case 'tc_error': {
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
    clearSessionId(TC_SESSION_KEY);
    setState(initialState);
    setToasts([]);
  };

  return { ...state, toasts, clearError, reset };
};
