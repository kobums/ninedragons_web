import { useEffect, useRef, useState } from 'react';
import type {
  STEvent,
  STGameOver,
  STGameState,
  STMessage,
  STPlayerJoined,
} from '../types/schottentotten';
import { ST_SESSION_KEY, clearSessionId, saveSessionId } from '../utils/session';

interface STState {
  // 참가 요청이 수락됐는지 (대기 화면 전환용)
  hasJoined: boolean;
  game: STGameState | null;
  gameOver: STGameOver | null;
  error: string | null;
  opponentDisconnected: boolean;
}

const initialState: STState = {
  hasJoined: false,
  game: null,
  gameOver: null,
  error: null,
  opponentDisconnected: false,
};

// 서버가 상태 변경마다 개인화 전체 스냅샷(st_game_state)을 보내므로
// 이 훅은 스냅샷을 그대로 반영하고 참가/이벤트/에러만 따로 관리한다.
export const useSTGameState = (lastMessage: STMessage | null) => {
  const [state, setState] = useState<STState>(initialState);
  // 마지막 연출 이벤트 (돌 하이라이트용). 잠시 뒤 스스로 사라진다.
  const [lastEvent, setLastEvent] = useState<STEvent | null>(null);
  const eventTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!lastMessage) return;

    switch (lastMessage.type) {
      case 'st_player_joined': {
        const payload = lastMessage.payload as STPlayerJoined;
        saveSessionId(ST_SESSION_KEY, payload.sessionId);
        setState((prev) => ({ ...prev, hasJoined: true }));
        break;
      }

      case 'st_game_state': {
        const game = lastMessage.payload as STGameState;
        setState((prev) => ({
          ...prev,
          game,
          hasJoined: true,
          opponentDisconnected: !game.opponentConnected,
        }));
        break;
      }

      case 'st_event': {
        const event = lastMessage.payload as STEvent;
        setLastEvent(event);
        if (eventTimer.current) clearTimeout(eventTimer.current);
        eventTimer.current = setTimeout(() => setLastEvent(null), 1500);
        break;
      }

      case 'st_game_over': {
        const gameOver = lastMessage.payload as STGameOver;
        clearSessionId(ST_SESSION_KEY);
        setState((prev) => ({ ...prev, gameOver }));
        break;
      }

      case 'st_opponent_disconnected':
        setState((prev) => ({ ...prev, opponentDisconnected: true }));
        break;

      case 'st_opponent_reconnected':
        setState((prev) => ({ ...prev, opponentDisconnected: false }));
        break;

      case 'st_session_expired':
        clearSessionId(ST_SESSION_KEY);
        setState((prev) => {
          // 게임 종료 화면은 유지한다 (세션 만료는 정리 신호일 뿐)
          if (prev.gameOver) return prev;
          return { ...initialState };
        });
        break;

      case 'st_error': {
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
    clearSessionId(ST_SESSION_KEY);
    setState(initialState);
    setLastEvent(null);
  };

  return { ...state, lastEvent, clearError, reset };
};
