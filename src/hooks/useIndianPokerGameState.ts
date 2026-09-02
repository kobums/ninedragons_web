import type {
  IPEvent,
  IPGameOverPayload,
  IPGameState,
  IPMessage,
} from '../types/indianpoker';
import { IP_SESSION_KEY } from '../types/indianpoker';
import {
  useMultiSnapshotGameState,
  type SnapshotToast,
} from './useMultiSnapshotGameState';

// 화면에 잠깐 띄우는 이벤트 토스트
export type IPToast = SnapshotToast<IPEvent>;

// 다인 스냅샷형 공용 훅의 얇은 래퍼 — 프리픽스·세션 키만 다르다
export const useIndianPokerGameState = (lastMessage: IPMessage | null) =>
  useMultiSnapshotGameState<IPGameState, IPGameOverPayload, IPEvent>(
    lastMessage,
    {
      prefix: 'ip',
      sessionKey: IP_SESSION_KEY,
    },
  );
