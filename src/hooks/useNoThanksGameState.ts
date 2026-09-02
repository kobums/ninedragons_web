import type {
  NTEvent,
  NTGameOverPayload,
  NTGameState,
  NTMessage,
} from '../types/nothanks';
import { NT_SESSION_KEY } from '../types/nothanks';
import {
  useMultiSnapshotGameState,
  type SnapshotToast,
} from './useMultiSnapshotGameState';

// 화면에 잠깐 띄우는 이벤트 토스트
export type NTToast = SnapshotToast<NTEvent>;

// 다인 스냅샷형 공용 훅의 얇은 래퍼 — 프리픽스·세션 키만 다르다
export const useNoThanksGameState = (lastMessage: NTMessage | null) =>
  useMultiSnapshotGameState<NTGameState, NTGameOverPayload, NTEvent>(
    lastMessage,
    {
      prefix: 'nt',
      sessionKey: NT_SESSION_KEY,
    },
  );
