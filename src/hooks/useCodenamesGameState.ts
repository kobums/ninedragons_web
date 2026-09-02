import type {
  CNEvent,
  CNGameOverPayload,
  CNGameState,
  CNMessage,
} from '../types/codenames';
import { CN_SESSION_KEY } from '../types/codenames';
import {
  useMultiSnapshotGameState,
  type SnapshotToast,
} from './useMultiSnapshotGameState';

// 화면에 잠깐 띄우는 이벤트 토스트
export type CNToast = SnapshotToast<CNEvent>;

// 다인 스냅샷형 공용 훅의 얇은 래퍼 — 프리픽스·세션 키만 다르다
export const useCodenamesGameState = (lastMessage: CNMessage | null) =>
  useMultiSnapshotGameState<CNGameState, CNGameOverPayload, CNEvent>(
    lastMessage,
    {
      prefix: 'cn',
      sessionKey: CN_SESSION_KEY,
    },
  );
