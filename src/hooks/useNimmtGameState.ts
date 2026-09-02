import type {
  NMEvent,
  NMGameOverPayload,
  NMGameState,
  NMMessage,
} from '../types/nimmt';
import { NM_SESSION_KEY } from '../types/nimmt';
import {
  useMultiSnapshotGameState,
  type SnapshotToast,
} from './useMultiSnapshotGameState';

// 화면에 잠깐 띄우는 이벤트 토스트
export type NMToast = SnapshotToast<NMEvent>;

// 다인 스냅샷형 공용 훅의 얇은 래퍼 — 프리픽스·세션 키만 다르다
export const useNimmtGameState = (lastMessage: NMMessage | null) =>
  useMultiSnapshotGameState<NMGameState, NMGameOverPayload, NMEvent>(
    lastMessage,
    {
      prefix: 'nm',
      sessionKey: NM_SESSION_KEY,
    },
  );
