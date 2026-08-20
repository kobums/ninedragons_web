import type { OmokEvent, OmokGameOver, OmokGameState, OmokMessage } from '../types/omok';
import { OMOK_SESSION_KEY } from '../types/omok';
import { useSnapshotGameState } from './useSnapshotGameState';

// 서버가 착수마다 개인화 전체 스냅샷(om_game_state)을 보내는 스냅샷형 계약이라
// 공용 스냅샷 훅을 그대로 쓴다. 착수는 스냅샷의 lastMove 표식으로 충분하므로
// 연출 이벤트는 입장(joined)만 2초 표시한다.
export const useOmokGameState = (lastMessage: OmokMessage | null) =>
  useSnapshotGameState<OmokGameState, OmokGameOver, OmokEvent>(lastMessage, {
    prefix: 'om',
    sessionKey: OMOK_SESSION_KEY,
    eventTtl: 2000,
    eventFilter: (event) => event.kind === 'joined',
  });
