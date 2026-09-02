import type {
  VGEvent,
  VGGameOverPayload,
  VGGameState,
  VGMessage,
} from '../types/lasvegas';
import { VG_SESSION_KEY } from '../types/lasvegas';
import {
  useMultiSnapshotGameState,
  type SnapshotToast,
} from './useMultiSnapshotGameState';

// 화면에 잠깐 띄우는 이벤트 토스트
export type VGToast = SnapshotToast<VGEvent>;

// 다인 스냅샷형 공용 훅의 얇은 래퍼 — 프리픽스·세션 키만 다르다
export const useLasVegasGameState = (lastMessage: VGMessage | null) =>
  useMultiSnapshotGameState<VGGameState, VGGameOverPayload, VGEvent>(
    lastMessage,
    {
      prefix: 'vg',
      sessionKey: VG_SESSION_KEY,
    },
  );
