import type {
  AVEvent,
  AVGameOverPayload,
  AVGameState,
  AVMessage,
} from '../types/avalon';
import { AV_SESSION_KEY } from '../types/avalon';
import {
  useMultiSnapshotGameState,
  type SnapshotToast,
} from './useMultiSnapshotGameState';

// 화면에 잠깐 띄우는 이벤트 토스트
export type AVToast = SnapshotToast<AVEvent>;

// 다인 스냅샷형 공용 훅의 얇은 래퍼 — 프리픽스·세션 키만 다르다
export const useAvalonGameState = (lastMessage: AVMessage | null) =>
  useMultiSnapshotGameState<AVGameState, AVGameOverPayload, AVEvent>(
    lastMessage,
    {
      prefix: 'av',
      sessionKey: AV_SESSION_KEY,
      // 제출 한 건 한 건은 스냅샷의 votedTeam/questDone 으로 충분해 토스트에서 거른다
      toastSkip: ['voted', 'team_voted', 'quest_played', 'react'],
    },
  );
