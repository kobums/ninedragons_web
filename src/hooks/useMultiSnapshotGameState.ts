import { useEffect, useRef, useState } from 'react';
import { clearSessionId, saveSessionId } from '../utils/session';

// 다인 스냅샷형 게임(서버가 상태 변경마다 전체 스냅샷 `xx_game_state` 를
// 보내고, 연출은 `xx_event` 토스트로 따로 오는 모델)의 공용 상태 훅.
// 아줄·크라켄·보난자 등 30종 가까운 게임이 프리픽스만 다른 같은 구조라 통합했다.
// 2인 게임(상대 1명·재대결)은 useSnapshotGameState, 로비·개인 이벤트가 얽힌
// 다빈치·넘버체인지·사보타지 등은 자체 훅을 유지한다.
//
// 게임별로 갈리는 지점은 옵션으로 받는다.
//  - toastSkip: 보드가 스냅샷으로 직접 그려서 토스트가 필요 없는 이벤트 kind
//    (기본 ['react'] — 셸의 useReactions 가 ReactionOverlay 로 따로 띄우므로)
//  - toastTtl / maxToasts: 토스트 체류 시간·최대 줄 수
//  - countsAsDisconnected: 끊김 배너를 띄울 좌석 판정(뱅은 탈락자를 뺀다)

interface SnapshotMessage {
  type: string;
  payload?: unknown;
}

interface SnapshotPlayer {
  connected: boolean;
  bot: boolean;
}

interface SnapshotGame {
  phase: string;
  players?: SnapshotPlayer[] | null;
}

// 스냅샷의 좌석 뷰 타입 (게임별 players 원소 타입)
type PlayerOf<TGame extends SnapshotGame> = NonNullable<
  TGame['players']
>[number];

// 화면에 잠깐 띄우는 이벤트 토스트
export interface SnapshotToast<TEvent> {
  id: number;
  event: TEvent;
}

export interface MultiSnapshotOptions<TGame extends SnapshotGame> {
  // 메시지 타입 프리픽스 ('az' → 'az_game_state' 등)
  prefix: string;
  sessionKey: string;
  // 토스트로 띄우지 않을 이벤트 kind (기본 ['react'])
  toastSkip?: readonly string[];
  // 토스트가 스스로 사라지기까지의 시간(ms)
  toastTtl?: number;
  // 동시에 유지하는 토스트 최대 개수
  maxToasts?: number;
  // 게임 중 끊김 배너를 띄울 좌석 판정. 기본은 '봇이 아닌데 끊긴 사람'.
  countsAsDisconnected?: (player: PlayerOf<TGame>) => boolean;
}

interface MultiSnapshotState<TGame, TOver> {
  // 참가 요청이 수락됐는지 (이름 입력 → 대기실 전환용)
  hasJoined: boolean;
  game: TGame | null;
  gameOver: TOver | null;
  error: string | null;
  // 같은 문구의 에러가 연달아 와도 보드가 '거부됨'을 알아채도록 세는 카운터
  errorSeq: number;
  // 게임 중 사람 좌석이 끊겨 재접속 대기 중인지 (배너용)
  someoneDisconnected: boolean;
}

const DEFAULT_TOAST_SKIP: readonly string[] = ['react'];
const DEFAULT_TOAST_TTL = 4000;
const DEFAULT_MAX_TOASTS = 4;

export const useMultiSnapshotGameState = <
  TGame extends SnapshotGame,
  TOver,
  TEvent extends { kind: string },
>(
  lastMessage: SnapshotMessage | null,
  {
    prefix,
    sessionKey,
    toastSkip = DEFAULT_TOAST_SKIP,
    toastTtl = DEFAULT_TOAST_TTL,
    maxToasts = DEFAULT_MAX_TOASTS,
    countsAsDisconnected,
  }: MultiSnapshotOptions<TGame>,
) => {
  const initialState: MultiSnapshotState<TGame, TOver> = {
    hasJoined: false,
    game: null,
    gameOver: null,
    error: null,
    errorSeq: 0,
    someoneDisconnected: false,
  };
  const [state, setState] =
    useState<MultiSnapshotState<TGame, TOver>>(initialState);
  const [toasts, setToasts] = useState<SnapshotToast<TEvent>[]>([]);
  const toastId = useRef(0);

  useEffect(() => {
    if (!lastMessage) return;

    const isDisconnected =
      countsAsDisconnected ?? ((p: PlayerOf<TGame>) => !p.connected && !p.bot);

    switch (lastMessage.type) {
      case `${prefix}_player_joined`: {
        const payload = lastMessage.payload as { sessionId?: string };
        if (payload?.sessionId) {
          saveSessionId(sessionKey, payload.sessionId);
        }
        setState((prev) => ({ ...prev, hasJoined: true }));
        break;
      }

      case `${prefix}_game_state`: {
        const game = lastMessage.payload as TGame;
        setState((prev) => ({
          ...prev,
          game,
          hasJoined: true,
          someoneDisconnected:
            game.phase !== 'waiting' &&
            game.phase !== 'game_over' &&
            (game.players ?? []).some(isDisconnected),
        }));
        break;
      }

      case `${prefix}_event`: {
        const event = lastMessage.payload as TEvent;
        if (toastSkip.includes(event.kind)) break;
        toastId.current += 1;
        const id = toastId.current;
        setToasts((prev) => [...prev.slice(-(maxToasts - 1)), { id, event }]);
        // 토스트는 잠시 뒤 스스로 사라진다
        setTimeout(() => {
          setToasts((prev) => prev.filter((toast) => toast.id !== id));
        }, toastTtl);
        break;
      }

      case `${prefix}_game_over`: {
        const gameOver = (lastMessage.payload ?? {}) as TOver;
        clearSessionId(sessionKey);
        setState((prev) => ({ ...prev, gameOver, someoneDisconnected: false }));
        break;
      }

      // 끊김·복귀 알림은 게임에 따라 두 가지 이름을 쓴다 (와이어 불변)
      case `${prefix}_player_disconnected`:
      case `${prefix}_opponent_disconnected`:
        setState((prev) => ({ ...prev, someoneDisconnected: true }));
        break;

      case `${prefix}_player_reconnected`:
      case `${prefix}_reconnected`:
        // 정확한 접속 상태는 뒤따르는 xx_game_state 가 채운다
        setState((prev) => ({ ...prev, someoneDisconnected: false }));
        break;

      case `${prefix}_session_expired`:
        clearSessionId(sessionKey);
        setState((prev) => {
          // 게임 종료 화면은 유지한다 (세션 만료는 정리 신호일 뿐)
          if (prev.gameOver) return prev;
          return { ...initialState };
        });
        break;

      case `${prefix}_error`: {
        const payload = lastMessage.payload as { message?: string };
        setState((prev) => ({
          ...prev,
          error: payload?.message ?? '오류가 발생했습니다',
          errorSeq: prev.errorSeq + 1,
        }));
        break;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastMessage]);

  const clearError = () => setState((prev) => ({ ...prev, error: null }));

  const reset = () => {
    clearSessionId(sessionKey);
    setState(initialState);
    setToasts([]);
  };

  return { ...state, toasts, clearError, reset };
};
