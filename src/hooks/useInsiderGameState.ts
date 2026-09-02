import type {
  IDEvent,
  IDGameOverPayload,
  IDGameState,
  IDMessage,
} from '../types/insider';
import { ID_SESSION_KEY } from '../types/insider';
import {
  useMultiSnapshotGameState,
  type SnapshotToast,
} from './useMultiSnapshotGameState';

// 화면에 잠깐 띄우는 이벤트 토스트
export type IDToast = SnapshotToast<IDEvent>;

// 다인 스냅샷형 공용 훅의 얇은 래퍼 — 프리픽스·세션 키만 다르다
export const useInsiderGameState = (lastMessage: IDMessage | null) =>
  useMultiSnapshotGameState<IDGameState, IDGameOverPayload, IDEvent>(
    lastMessage,
    {
      prefix: 'id',
      sessionKey: ID_SESSION_KEY,
      // 투표는 비공개라 개별 제출은 스냅샷의 voted 플래그로 충분해 토스트에서 거른다
      toastSkip: ['voted', 'react'],
    },
  );
