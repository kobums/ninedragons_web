import type {
  BZEvent,
  BZGameOverPayload,
  BZGameState,
  BZMessage,
} from '../types/bohnanza';
import { BZ_SESSION_KEY } from '../types/bohnanza';
import {
  useMultiSnapshotGameState,
  type SnapshotToast,
} from './useMultiSnapshotGameState';

// 화면에 잠깐 띄우는 이벤트 토스트
export type BZToast = SnapshotToast<BZEvent>;

// 다인 스냅샷형 공용 훅의 얇은 래퍼 — 프리픽스·세션 키만 다르다
export const useBohnanzaGameState = (lastMessage: BZMessage | null) =>
  useMultiSnapshotGameState<BZGameState, BZGameOverPayload, BZEvent>(
    lastMessage,
    {
      prefix: 'bz',
      sessionKey: BZ_SESSION_KEY,
    },
  );
