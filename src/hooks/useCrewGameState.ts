import type {
  CWEvent,
  CWGameOverPayload,
  CWGameState,
  CWMessage,
} from '../types/crew';
import { CW_SESSION_KEY } from '../types/crew';
import {
  useMultiSnapshotGameState,
  type SnapshotToast,
} from './useMultiSnapshotGameState';

// 화면에 잠깐 띄우는 이벤트 토스트
export type CWToast = SnapshotToast<CWEvent>;

// 다인 스냅샷형 공용 훅의 얇은 래퍼 — 프리픽스·세션 키만 다르다
export const useCrewGameState = (lastMessage: CWMessage | null) =>
  useMultiSnapshotGameState<CWGameState, CWGameOverPayload, CWEvent>(
    lastMessage,
    {
      prefix: 'cw',
      sessionKey: CW_SESSION_KEY,
    },
  );
