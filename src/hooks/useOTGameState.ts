import type { OTEvent, OTGameOver, OTGameState, OTMessage } from '../types/onitama';
import { GAMES } from '../config/games';
import { useSnapshotGameState } from './useSnapshotGameState';

// 서버가 상태 변경마다 전체 스냅샷(ot_game_state)을 보내므로
// 공용 스냅샷 훅을 그대로 쓴다. 이동·잡기·패스 이벤트는 2초 표시.
export const useOTGameState = (lastMessage: OTMessage | null) =>
  useSnapshotGameState<OTGameState, OTGameOver, OTEvent>(lastMessage, {
    prefix: 'ot',
    sessionKey: GAMES.onitama.sessionKey,
    eventTtl: 2000,
  });
