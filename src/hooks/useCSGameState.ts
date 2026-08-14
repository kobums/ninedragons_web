import type { CSEvent, CSGameOver, CSGameState, CSMessage } from '../types/cantstop';
import { GAMES } from '../config/games';
import { useSnapshotGameState } from './useSnapshotGameState';

// 서버가 상태 변경마다 전체 스냅샷(cs_game_state)을 보내므로
// 공용 스냅샷 훅을 그대로 쓴다. 버스트·완등 연출은 2.5초 표시.
export const useCSGameState = (lastMessage: CSMessage | null) =>
  useSnapshotGameState<CSGameState, CSGameOver, CSEvent>(lastMessage, {
    prefix: 'cs',
    sessionKey: GAMES.cantstop.sessionKey,
    eventTtl: 2500,
    // 연출 가치가 있는 이벤트만 (roll·advance 는 상태로 이미 보인다)
    eventFilter: (event) => event.kind === 'bust' || event.kind === 'claim' || event.kind === 'bank',
  });
