import type {
  SFEvent,
  SFGameOverPayload,
  SFGameState,
  SFMessage,
} from '../types/skyfall';
import { SF_SESSION_KEY } from '../types/skyfall';
import {
  useMultiSnapshotGameState,
  type SnapshotToast,
} from './useMultiSnapshotGameState';

// 화면에 잠깐 띄우는 이벤트 토스트
export type SFToast = SnapshotToast<SFEvent>;

// 다인 스냅샷형 공용 훅의 얇은 래퍼 — 프리픽스·세션 키만 다르다
export const useSkyfallGameState = (lastMessage: SFMessage | null) =>
  useMultiSnapshotGameState<SFGameState, SFGameOverPayload, SFEvent>(
    lastMessage,
    {
      prefix: 'sf',
      sessionKey: SF_SESSION_KEY,
      // 투표 한 건 한 건은 스냅샷의 공개 투표 목록으로 충분해 토스트에서 거른다
      toastSkip: ['voted', 'react'],
    },
  );
