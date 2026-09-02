import type {
  YTEvent,
  YTGameOverPayload,
  YTGameState,
  YTMessage,
} from '../types/yacht';
import { YT_SESSION_KEY } from '../types/yacht';
import {
  useMultiSnapshotGameState,
  type SnapshotToast,
} from './useMultiSnapshotGameState';

// 화면에 잠깐 띄우는 이벤트 토스트
export type YTToast = SnapshotToast<YTEvent>;

// 다인 스냅샷형 공용 훅의 얇은 래퍼 — 프리픽스·세션 키만 다르다
export const useYachtGameState = (lastMessage: YTMessage | null) =>
  useMultiSnapshotGameState<YTGameState, YTGameOverPayload, YTEvent>(
    lastMessage,
    {
      prefix: 'yt',
      sessionKey: YT_SESSION_KEY,
    },
  );
