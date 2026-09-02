import type {
  BGEvent,
  BGGameOverPayload,
  BGGameState,
  BGMessage,
} from '../types/bang';
import { BG_SESSION_KEY } from '../types/bang';
import {
  useMultiSnapshotGameState,
  type SnapshotToast,
} from './useMultiSnapshotGameState';

// 화면에 잠깐 띄우는 이벤트 토스트
export type BGToast = SnapshotToast<BGEvent>;

// 다인 스냅샷형 공용 훅의 얇은 래퍼 — 프리픽스·세션 키만 다르다
export const useBangGameState = (lastMessage: BGMessage | null) =>
  useMultiSnapshotGameState<BGGameState, BGGameOverPayload, BGEvent>(
    lastMessage,
    {
      prefix: 'bg',
      sessionKey: BG_SESSION_KEY,
      // 탈락자는 끊겨도 진행에 영향이 없어 끊김 배너에서 뺀다
      countsAsDisconnected: (p) => !p.connected && !p.bot && p.alive,
    },
  );
