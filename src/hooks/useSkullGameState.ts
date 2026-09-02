import type {
  SKEvent,
  SKGameOverPayload,
  SKGameState,
  SKMessage,
} from '../types/skull';
import { SK_SESSION_KEY } from '../types/skull';
import {
  useMultiSnapshotGameState,
  type SnapshotToast,
} from './useMultiSnapshotGameState';

// 화면에 잠깐 띄우는 이벤트 토스트
export type SKToast = SnapshotToast<SKEvent>;

// 다인 스냅샷형 공용 훅의 얇은 래퍼 — 프리픽스·세션 키만 다르다
export const useSkullGameState = (lastMessage: SKMessage | null) =>
  useMultiSnapshotGameState<SKGameState, SKGameOverPayload, SKEvent>(
    lastMessage,
    {
      prefix: 'sk',
      sessionKey: SK_SESSION_KEY,
    },
  );
