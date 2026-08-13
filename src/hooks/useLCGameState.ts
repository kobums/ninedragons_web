import type { LCEvent, LCGameOver, LCGameState, LCMessage } from '../types/lostcities';
import { GAMES } from '../config/games';
import { useSnapshotGameState } from './useSnapshotGameState';

// 서버가 상태 변경마다 개인화 스냅샷(lc_game_state)을 보내므로
// 공용 스냅샷 훅을 그대로 쓴다. 놓기·버리기·뽑기 이벤트는 2초 표시.
export const useLCGameState = (lastMessage: LCMessage | null) =>
  useSnapshotGameState<LCGameState, LCGameOver, LCEvent>(lastMessage, {
    prefix: 'lc',
    sessionKey: GAMES.lostcities.sessionKey,
    eventTtl: 2000,
  });
