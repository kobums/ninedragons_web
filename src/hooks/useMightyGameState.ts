import type {
  MTEvent,
  MTResult,
  MTGameState,
  MTMessage,
} from '../types/mighty';
import { MT_SESSION_KEY } from '../types/mighty';
import {
  useMultiSnapshotGameState,
  type SnapshotToast,
} from './useMultiSnapshotGameState';

// 화면에 잠깐 띄우는 이벤트 토스트
export type MTToast = SnapshotToast<MTEvent>;

// 다인 스냅샷형 공용 훅의 얇은 래퍼 — 프리픽스·세션 키만 다르다
export const useMightyGameState = (lastMessage: MTMessage | null) =>
  useMultiSnapshotGameState<MTGameState, MTResult, MTEvent>(lastMessage, {
    prefix: 'mt',
    sessionKey: MT_SESSION_KEY,
    // 매 플레이마다 오는 잔이벤트는 스냅샷 갱신으로 충분해 토스트에서 거른다
    toastSkip: ['play', 'bid', 'pass', 'react'],
  });
