import type {
  RFEvent,
  RFGameOverPayload,
  RFGameState,
  RFMessage,
} from '../types/reformation';
import { RF_SESSION_KEY } from '../types/reformation';
import {
  useMultiSnapshotGameState,
  type SnapshotToast,
} from './useMultiSnapshotGameState';

// 화면에 잠깐 띄우는 이벤트 토스트
export type RFToast = SnapshotToast<RFEvent>;

// 다인 스냅샷형 공용 훅의 얇은 래퍼 — 프리픽스·세션 키만 다르다
export const useReformationGameState = (lastMessage: RFMessage | null) =>
  useMultiSnapshotGameState<RFGameState, RFGameOverPayload, RFEvent>(
    lastMessage,
    {
      prefix: 'rf',
      sessionKey: RF_SESSION_KEY,
      // 이벤트 피드 결 — 최근 3줄을 5초간 유지
      toastTtl: 5000,
      maxToasts: 3,
    },
  );
