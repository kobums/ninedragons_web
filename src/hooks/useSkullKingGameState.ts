import type {
  KGEvent,
  KGGameOverPayload,
  KGGameState,
  KGMessage,
} from '../types/skullking';
import { KG_SESSION_KEY } from '../types/skullking';
import {
  useMultiSnapshotGameState,
  type SnapshotToast,
} from './useMultiSnapshotGameState';

// 화면에 잠깐 띄우는 이벤트 토스트
export type KGToast = SnapshotToast<KGEvent>;

// 다인 스냅샷형 공용 훅의 얇은 래퍼 — 프리픽스·세션 키만 다르다
export const useSkullKingGameState = (lastMessage: KGMessage | null) =>
  useMultiSnapshotGameState<KGGameState, KGGameOverPayload, KGEvent>(
    lastMessage,
    {
      prefix: 'kg',
      sessionKey: KG_SESSION_KEY,
    },
  );
