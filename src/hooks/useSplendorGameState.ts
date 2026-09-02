import type {
  SLEvent,
  SLGameOverPayload,
  SLGameState,
  SLMessage,
} from '../types/splendor';
import { SL_SESSION_KEY } from '../types/splendor';
import {
  useMultiSnapshotGameState,
  type SnapshotToast,
} from './useMultiSnapshotGameState';

// 화면에 잠깐 띄우는 이벤트 토스트
export type SLToast = SnapshotToast<SLEvent>;

// 다인 스냅샷형 공용 훅의 얇은 래퍼 — 프리픽스·세션 키만 다르다
export const useSplendorGameState = (lastMessage: SLMessage | null) =>
  useMultiSnapshotGameState<SLGameState, SLGameOverPayload, SLEvent>(
    lastMessage,
    {
      prefix: 'sl',
      sessionKey: SL_SESSION_KEY,
    },
  );
