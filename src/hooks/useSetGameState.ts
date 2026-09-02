import type {
  SEEvent,
  SEGameOverPayload,
  SEGameState,
  SEMessage,
} from '../types/set';
import { SE_SESSION_KEY } from '../types/set';
import {
  useMultiSnapshotGameState,
  type SnapshotToast,
} from './useMultiSnapshotGameState';

// 화면에 잠깐 띄우는 이벤트 토스트
export type SEToast = SnapshotToast<SEEvent>;

// 다인 스냅샷형 공용 훅의 얇은 래퍼 — 프리픽스·세션 키만 다르다
export const useSetGameState = (lastMessage: SEMessage | null) =>
  useMultiSnapshotGameState<SEGameState, SEGameOverPayload, SEEvent>(
    lastMessage,
    {
      prefix: 'se',
      sessionKey: SE_SESSION_KEY,
      // claim 판정은 보드가 스냅샷(lastClaim)으로 직접 배너를 그리므로 토스트에서 뺀다 —
      // 실시간 게임이라 초당 여러 건이 쏟아지면 토스트가 화면을 덮는다
      toastSkip: ['react', 'claim'],
    },
  );
