import { useEffect, useRef, useState } from 'react';
import type {
  DVEvent,
  DVGameOver,
  DVGameState,
  DVLobbyState,
  DVMessage,
} from '../types/davinci';
import { DV_SESSION_KEY, clearSessionId, saveSessionId } from '../utils/session';

// 화면에 잠깐 띄우는 이벤트 토스트
export interface DVToast {
  id: number;
  event: DVEvent;
}

interface DVState {
  lobby: DVLobbyState | null;
  game: DVGameState | null;
  gameOver: DVGameOver | null;
  error: string | null;
  // 게임 중 한 명이라도 끊겨 재접속 대기 중인지 (배너용)
  someoneDisconnected: boolean;
}

const initialState: DVState = {
  lobby: null,
  game: null,
  gameOver: null,
  error: null,
  someoneDisconnected: false,
};

// 서버가 상태 변경마다 개인화 전체 스냅샷(dv_game_state)을 보내므로
// 이 훅은 스냅샷을 그대로 반영하고 로비/토스트/에러만 따로 관리한다.
export const useDVGameState = (lastMessage: DVMessage | null) => {
  const [state, setState] = useState<DVState>(initialState);
  const [toasts, setToasts] = useState<DVToast[]>([]);
  const toastId = useRef(0);

  useEffect(() => {
    if (!lastMessage) return;

    switch (lastMessage.type) {
      case 'dv_lobby_state': {
        const lobby = lastMessage.payload as DVLobbyState;
        saveSessionId(DV_SESSION_KEY, lobby.sessionId);
        setState((prev) => ({ ...prev, lobby, game: null, gameOver: null }));
        break;
      }

      case 'dv_game_state': {
        const game = lastMessage.payload as DVGameState;
        setState((prev) => ({
          ...prev,
          game,
          lobby: null,
          someoneDisconnected: game.players.some(
            (p) => !p.connected && !p.eliminated,
          ),
        }));
        break;
      }

      case 'dv_event': {
        const event = lastMessage.payload as DVEvent;
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

      case 'dv_game_over': {
        const gameOver = lastMessage.payload as DVGameOver;
        clearSessionId(DV_SESSION_KEY);
        setState((prev) => ({ ...prev, gameOver }));
        break;
      }

      case 'dv_player_disconnected':
        setState((prev) => ({ ...prev, someoneDisconnected: true }));
        break;

      case 'dv_player_reconnected':
        // 정확한 접속 상태는 뒤따르는 dv_game_state 가 채운다
        setState((prev) => ({ ...prev, someoneDisconnected: false }));
        break;

      case 'dv_session_expired':
        clearSessionId(DV_SESSION_KEY);
        setState((prev) => {
          // 게임 종료 화면은 유지한다 (세션 만료는 정리 신호일 뿐)
          if (prev.gameOver) return prev;
          return { ...initialState };
        });
        break;

      case 'dv_error': {
        const payload = lastMessage.payload as { message?: string };
        setState((prev) => ({ ...prev, error: payload?.message ?? '오류가 발생했습니다' }));
        break;
      }
    }
  }, [lastMessage]);

  const clearError = () => setState((prev) => ({ ...prev, error: null }));

  const reset = () => {
    clearSessionId(DV_SESSION_KEY);
    setState(initialState);
    setToasts([]);
  };

  return { ...state, toasts, clearError, reset };
};
