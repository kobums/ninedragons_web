import type {
  CTEvent,
  CTGameOverPayload,
  CTGameState,
  CTMessage,
} from '../types/citadels';
import { CT_SESSION_KEY } from '../types/citadels';
import {
  useMultiSnapshotGameState,
  type SnapshotToast,
} from './useMultiSnapshotGameState';

// 화면에 잠깐 띄우는 이벤트 토스트
export type CTToast = SnapshotToast<CTEvent>;

// 다인 스냅샷형 공용 훅의 얇은 래퍼 — 프리픽스·세션 키만 다르다
export const useCitadelsGameState = (lastMessage: CTMessage | null) =>
  useMultiSnapshotGameState<CTGameState, CTGameOverPayload, CTEvent>(
    lastMessage,
    {
      prefix: 'ct',
      sessionKey: CT_SESSION_KEY,
    },
  );
