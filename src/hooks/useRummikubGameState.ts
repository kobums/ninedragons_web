import type {
  RUEvent,
  RUGameOverPayload,
  RUGameState,
  RUMessage,
} from '../types/rummikub';
import { RU_SESSION_KEY } from '../types/rummikub';
import {
  useMultiSnapshotGameState,
  type SnapshotToast,
} from './useMultiSnapshotGameState';

// 화면에 잠깐 띄우는 이벤트 토스트
export type RUToast = SnapshotToast<RUEvent>;

// 다인 스냅샷형 공용 훅의 얇은 래퍼 — 프리픽스·세션 키만 다르다
export const useRummikubGameState = (lastMessage: RUMessage | null) =>
  useMultiSnapshotGameState<RUGameState, RUGameOverPayload, RUEvent>(
    lastMessage,
    {
      prefix: 'ru',
      sessionKey: RU_SESSION_KEY,
      // 확정 거부는 errorSeq 로 보드에 전해진다 (로컬 배치 되돌리기 신호)
    },
  );
