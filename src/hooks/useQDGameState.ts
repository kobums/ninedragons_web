import type { QDEvent, QDGameOver, QDGameState, QDMessage } from '../types/quoridor';
import { GAMES } from '../config/games';
import { useSnapshotGameState } from './useSnapshotGameState';

// 서버가 상태 변경마다 전체 스냅샷(qd_game_state)을 보내므로
// 공용 스냅샷 훅을 그대로 쓴다. 이동·벽 설치 이벤트는 2초 표시.
export const useQDGameState = (lastMessage: QDMessage | null) =>
  useSnapshotGameState<QDGameState, QDGameOver, QDEvent>(lastMessage, {
    prefix: 'qd',
    sessionKey: GAMES.quoridor.sessionKey,
    eventTtl: 2000,
  });
