import type {
  JHEvent,
  JHGameOver,
  JHGameState,
  JHMessage,
} from '../types/jekyllhyde';
import { GAMES } from '../config/games';
import { useSnapshotGameState } from './useSnapshotGameState';

// 서버가 상태 변경마다 개인화 전체 스냅샷(jh_game_state)을 보내므로
// 공용 스냅샷 훅을 그대로 쓴다. 연출 가치가 있는 이벤트만 2.5초 표시.
export const useJHGameState = (lastMessage: JHMessage | null) =>
  useSnapshotGameState<JHGameState, JHGameOver, JHEvent>(lastMessage, {
    prefix: 'jh',
    sessionKey: GAMES.jekyllhyde.sessionKey,
    eventTtl: 2500,
    eventFilter: (event) =>
      event.kind === 'trick_resolved' ||
      event.kind === 'rank_reset' ||
      event.kind === 'trick_stolen' ||
      event.kind === 'greed_exchanged' ||
      event.kind === 'round_result',
  });
