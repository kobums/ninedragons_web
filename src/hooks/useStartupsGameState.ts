import type {
  SUEvent,
  SUGameOverPayload,
  SUGameState,
  SUMessage,
} from '../types/startups';
import { SU_SESSION_KEY } from '../types/startups';
import {
  useMultiSnapshotGameState,
  type SnapshotToast,
} from './useMultiSnapshotGameState';

// 화면에 잠깐 띄우는 이벤트 토스트
export type SUToast = SnapshotToast<SUEvent>;

// 다인 스냅샷형 공용 훅의 얇은 래퍼 — 프리픽스·세션 키만 다르다
export const useStartupsGameState = (lastMessage: SUMessage | null) =>
  useMultiSnapshotGameState<SUGameState, SUGameOverPayload, SUEvent>(
    lastMessage,
    {
      prefix: 'su',
      sessionKey: SU_SESSION_KEY,
    },
  );
