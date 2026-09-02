import type {
  CCEvent,
  CCGameOverPayload,
  CCGameState,
  CCMessage,
} from '../types/ciaociao';
import { CC_SESSION_KEY } from '../types/ciaociao';
import {
  useMultiSnapshotGameState,
  type SnapshotToast,
} from './useMultiSnapshotGameState';

// 화면에 잠깐 띄우는 이벤트 토스트
export type CCToast = SnapshotToast<CCEvent>;

// 다인 스냅샷형 공용 훅의 얇은 래퍼 — 프리픽스·세션 키만 다르다
export const useCiaoCiaoGameState = (lastMessage: CCMessage | null) =>
  useMultiSnapshotGameState<CCGameState, CCGameOverPayload, CCEvent>(
    lastMessage,
    {
      prefix: 'cc',
      sessionKey: CC_SESSION_KEY,
    },
  );
