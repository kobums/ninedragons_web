import type {
  JOEvent,
  JOGameOverPayload,
  JOGameState,
  JOMessage,
} from '../types/justone';
import { JO_SESSION_KEY } from '../types/justone';
import {
  useMultiSnapshotGameState,
  type SnapshotToast,
} from './useMultiSnapshotGameState';

// 화면에 잠깐 띄우는 이벤트 토스트
export type JOToast = SnapshotToast<JOEvent>;

// 다인 스냅샷형 공용 훅의 얇은 래퍼 — 프리픽스·세션 키만 다르다
export const useJustOneGameState = (lastMessage: JOMessage | null) =>
  useMultiSnapshotGameState<JOGameState, JOGameOverPayload, JOEvent>(
    lastMessage,
    {
      prefix: 'jo',
      sessionKey: JO_SESSION_KEY,
    },
  );
