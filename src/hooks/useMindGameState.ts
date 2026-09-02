import type {
  MIEvent,
  MIGameOverPayload,
  MIGameState,
  MIMessage,
} from '../types/mind';
import { MI_SESSION_KEY } from '../types/mind';
import {
  useMultiSnapshotGameState,
  type SnapshotToast,
} from './useMultiSnapshotGameState';

// 화면에 잠깐 띄우는 이벤트 토스트
export type MIToast = SnapshotToast<MIEvent>;

// 다인 스냅샷형 공용 훅의 얇은 래퍼 — 프리픽스·세션 키만 다르다
export const useMindGameState = (lastMessage: MIMessage | null) =>
  useMultiSnapshotGameState<MIGameState, MIGameOverPayload, MIEvent>(
    lastMessage,
    {
      prefix: 'mi',
      sessionKey: MI_SESSION_KEY,
      // 보드가 스냅샷으로 직접 그리는 것들은 토스트에서 뺀다 — 차례가 없는 실시간
      // 게임이라 초당 여러 건이 쏟아지면 토스트가 화면을 덮는다.
      // play: 중앙의 큰 숫자와 더미가 곧 사실이다.
      // mistake: 실수 패널(lastMistake)이 크게 그린다 — 이 게임 최대의 연출.
      // star_*: 수리검 바(starVote)가 남은 초까지 그린다.
      // (react 는 셸에 useReactions 가 없어 토스트로 보여준다)
      toastSkip: [
        'play',
        'mistake',
        'star_propose',
        'star_accept',
        'star_decline',
      ],
    },
  );
