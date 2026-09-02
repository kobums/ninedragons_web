import type {
  RREvent,
  RRGameOverPayload,
  RRGameState,
  RRMessage,
} from '../types/ricochet';
import { RR_SESSION_KEY } from '../types/ricochet';
import {
  useMultiSnapshotGameState,
  type SnapshotToast,
} from './useMultiSnapshotGameState';

// 화면에 잠깐 띄우는 이벤트 토스트
export type RRToast = SnapshotToast<RREvent>;

// 다인 스냅샷형 공용 훅의 얇은 래퍼 — 프리픽스·세션 키만 다르다
export const useRicochetGameState = (lastMessage: RRMessage | null) =>
  useMultiSnapshotGameState<RRGameState, RRGameOverPayload, RREvent>(
    lastMessage,
    {
      prefix: 'rr',
      sessionKey: RR_SESSION_KEY,
    },
  );
