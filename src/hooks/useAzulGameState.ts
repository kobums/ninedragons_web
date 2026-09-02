import type {
  AZEvent,
  AZGameOverPayload,
  AZGameState,
  AZMessage,
} from '../types/azul';
import { AZ_SESSION_KEY } from '../types/azul';
import {
  useMultiSnapshotGameState,
  type SnapshotToast,
} from './useMultiSnapshotGameState';

// 화면에 잠깐 띄우는 이벤트 토스트
export type AZToast = SnapshotToast<AZEvent>;

// 다인 스냅샷형 공용 훅의 얇은 래퍼 — 프리픽스·세션 키만 다르다
export const useAzulGameState = (lastMessage: AZMessage | null) =>
  useMultiSnapshotGameState<AZGameState, AZGameOverPayload, AZEvent>(
    lastMessage,
    {
      prefix: 'az',
      sessionKey: AZ_SESSION_KEY,
    },
  );
