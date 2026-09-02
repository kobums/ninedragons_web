import type {
  CPEvent,
  CPGameOverPayload,
  CPGameState,
  CPMessage,
} from '../types/coup';
import { CP_SESSION_KEY } from '../types/coup';
import {
  useMultiSnapshotGameState,
  type SnapshotToast,
} from './useMultiSnapshotGameState';

// 화면에 잠깐 띄우는 이벤트 토스트
export type CPToast = SnapshotToast<CPEvent>;

// 다인 스냅샷형 공용 훅의 얇은 래퍼 — 프리픽스·세션 키만 다르다
export const useCoupGameState = (lastMessage: CPMessage | null) =>
  useMultiSnapshotGameState<CPGameState, CPGameOverPayload, CPEvent>(
    lastMessage,
    {
      prefix: 'cp',
      sessionKey: CP_SESSION_KEY,
      // 이벤트 피드 결 — 최근 3줄을 5초간 유지
      toastTtl: 5000,
      maxToasts: 3,
    },
  );
