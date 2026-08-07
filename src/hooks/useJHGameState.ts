import { useEffect, useRef, useState } from 'react';
import type {
  JHEvent,
  JHGameOver,
  JHGameState,
  JHMessage,
  JHPlayerJoined,
} from '../types/jekyllhyde';
import { JH_SESSION_KEY, clearSessionId, saveSessionId } from '../utils/session';

interface JHState {
  // 참가 요청이 수락됐는지 (대기 화면 전환용)
  hasJoined: boolean;
  game: JHGameState | null;
  gameOver: JHGameOver | null;
  error: string | null;
  opponentDisconnected: boolean;
}

const initialState: JHState = {
  hasJoined: false,
  game: null,
  gameOver: null,
  error: null,
  opponentDisconnected: false,
};

// 서버가 상태 변경마다 개인화 전체 스냅샷(jh_game_state)을 보내므로
// 이 훅은 스냅샷을 그대로 반영하고 참가/이벤트/에러만 따로 관리한다.
export const useJHGameState = (lastMessage: JHMessage | null) => {
  const [state, setState] = useState<JHState>(initialState);
  // 마지막 연출 이벤트 (트릭 결과·물약 효과 표시용). 잠시 뒤 스스로 사라진다.
  const [lastEvent, setLastEvent] = useState<JHEvent | null>(null);
  const eventTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!lastMessage) return;

    switch (lastMessage.type) {
      case 'jh_player_joined': {
        const payload = lastMessage.payload as JHPlayerJoined;
        saveSessionId(JH_SESSION_KEY, payload.sessionId);
        setState((prev) => ({ ...prev, hasJoined: true }));
        break;
      }

      case 'jh_game_state': {
        const game = lastMessage.payload as JHGameState;
        setState((prev) => ({
          ...prev,
          game,
          hasJoined: true,
          opponentDisconnected: !game.opponentConnected,
        }));
        break;
      }

      case 'jh_event': {
        const event = lastMessage.payload as JHEvent;
        // 연출 가치가 있는 이벤트만 잠시 보여준다
        if (
          event.kind === 'trick_resolved' ||
          event.kind === 'rank_reset' ||
          event.kind === 'trick_stolen' ||
          event.kind === 'greed_exchanged' ||
          event.kind === 'round_result'
        ) {
          setLastEvent(event);
          if (eventTimer.current) clearTimeout(eventTimer.current);
          eventTimer.current = setTimeout(() => setLastEvent(null), 2500);
        }
        break;
      }

      case 'jh_game_over': {
        const gameOver = lastMessage.payload as JHGameOver;
        clearSessionId(JH_SESSION_KEY);
        setState((prev) => ({ ...prev, gameOver }));
        break;
      }

      case 'jh_opponent_disconnected':
        setState((prev) => ({ ...prev, opponentDisconnected: true }));
        break;

      case 'jh_opponent_reconnected':
        setState((prev) => ({ ...prev, opponentDisconnected: false }));
        break;

      case 'jh_session_expired':
        clearSessionId(JH_SESSION_KEY);
        setState((prev) => {
          // 게임 종료 화면은 유지한다 (세션 만료는 정리 신호일 뿐)
          if (prev.gameOver) return prev;
          return { ...initialState };
        });
        break;

      case 'jh_error': {
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
    clearSessionId(JH_SESSION_KEY);
    setState(initialState);
    setLastEvent(null);
  };

  return { ...state, lastEvent, clearError, reset };
};
