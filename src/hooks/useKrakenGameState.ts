import type {
  KREvent,
  KRGameOverPayload,
  KRGameState,
  KRMessage,
} from '../types/kraken';
import { KR_SESSION_KEY } from '../types/kraken';
import {
  useMultiSnapshotGameState,
  type SnapshotToast,
} from './useMultiSnapshotGameState';

// 화면에 잠깐 띄우는 이벤트 토스트
export type KRToast = SnapshotToast<KREvent>;

// 다인 스냅샷형 공용 훅의 얇은 래퍼 — 프리픽스·세션 키만 다르다
export const useKrakenGameState = (lastMessage: KRMessage | null) =>
  useMultiSnapshotGameState<KRGameState, KRGameOverPayload, KREvent>(
    lastMessage,
    {
      prefix: 'kr',
      sessionKey: KR_SESSION_KEY,
    },
  );
