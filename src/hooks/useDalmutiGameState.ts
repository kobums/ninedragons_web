import type {
  DMEvent,
  DMGameOverPayload,
  DMGameState,
  DMMessage,
} from '../types/dalmuti';
import { DM_SESSION_KEY } from '../types/dalmuti';
import {
  useMultiSnapshotGameState,
  type SnapshotToast,
} from './useMultiSnapshotGameState';

// 화면에 잠깐 띄우는 이벤트 토스트
export type DMToast = SnapshotToast<DMEvent>;

// 다인 스냅샷형 공용 훅의 얇은 래퍼 — 프리픽스·세션 키만 다르다
export const useDalmutiGameState = (lastMessage: DMMessage | null) =>
  useMultiSnapshotGameState<DMGameState, DMGameOverPayload, DMEvent>(
    lastMessage,
    {
      prefix: 'dm',
      sessionKey: DM_SESSION_KEY,
    },
  );
