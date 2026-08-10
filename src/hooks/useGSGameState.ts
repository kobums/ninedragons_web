import type { GSEvent, GSGameOver, GSGameState, GSMessage } from '../types/geister';
import { GAMES } from '../config/games';
import { useSnapshotGameState } from './useSnapshotGameState';

// 서버가 상태 변경마다 개인화 전체 스냅샷(gs_game_state)을 보내므로
// 공용 스냅샷 훅을 그대로 쓴다. 이동·잡기·탈출 이벤트는 2초 표시.
export const useGSGameState = (lastMessage: GSMessage | null) =>
  useSnapshotGameState<GSGameState, GSGameOver, GSEvent>(lastMessage, {
    prefix: 'gs',
    sessionKey: GAMES.geister.sessionKey,
    eventTtl: 2000,
  });
