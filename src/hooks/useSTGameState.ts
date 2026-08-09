import type {
  STEvent,
  STGameOver,
  STGameState,
  STMessage,
} from '../types/schottentotten';
import { GAMES } from '../config/games';
import { useSnapshotGameState } from './useSnapshotGameState';

// 서버가 상태 변경마다 개인화 전체 스냅샷(st_game_state)을 보내므로
// 공용 스냅샷 훅을 그대로 쓴다. 이벤트(돌 하이라이트)는 1.5초 표시.
export const useSTGameState = (lastMessage: STMessage | null) =>
  useSnapshotGameState<STGameState, STGameOver, STEvent>(lastMessage, {
    prefix: 'st',
    sessionKey: GAMES.schottentotten.sessionKey,
    eventTtl: 1500,
  });
