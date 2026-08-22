// 노 터치 크라켄 메시지·상태 타입 — 와이어 계약(spec-kraken.md)과 1:1 대응.
// 메시지 타입명·payload 필드명은 백엔드와 공유하므로 변경 금지.

// 진영 — 탐험대(보물 전부 공개) vs 해골(크라켄 공개·시간 초과)
export type KRRole = '' | 'expedition' | 'skeleton';

// 카드 3종 — 보물 N장 / 크라켄 1장 / 나머지 꽝
export type KRCard = 'treasure' | 'kraken' | 'blank';

export type KRPhase = 'waiting' | 'revealing' | 'round_end' | 'game_over';

export type KRMessageType =
  // 클라 → 서버
  | 'kr_join_game'
  | 'kr_fill_bots'
  | 'kr_start'
  | 'kr_rejoin'
  | 'kr_point'
  | 'kr_claim'
  | 'kr_react'
  // 서버 → 클라
  | 'kr_player_joined'
  | 'kr_spectate_joined'
  | 'kr_game_state'
  | 'kr_event'
  | 'kr_game_over'
  | 'kr_player_disconnected'
  | 'kr_player_reconnected'
  | 'kr_session_expired'
  | 'kr_error';

export interface KRMessage {
  type: KRMessageType;
  payload?: unknown;
}

// 손패 선언 — 거짓말 가능·구속력 없음. 꽝 수는 남은 장수에서 자동 계산.
// kraken 은 0/1 (토글) — 서버가 boolean 을 보내도 truthy 판정으로 다룬다.
export interface KRClaim {
  treasure: number;
  kraken: number;
}

// 인원별 역할 풀 — 전원 공개 정보 (실제 배분은 풀에서 인원수만큼만 뽑는다)
export interface KRRolePool {
  expedition: number;
  skeleton: number;
}

// 공개 진척 — 전원 공개
export interface KRFound {
  treasure: number;
  treasureTotal: number;
  // 0 또는 1 (1이면 즉시 해골 승)
  kraken: number;
}

// 좌석 뷰 — role 은 게임 종료 시에만 채워진다 (그 전에는 전원 '').
export interface KRPlayerView {
  seat: number;
  name: string;
  connected: boolean;
  bot: boolean;
  // 아직 공개되지 않은 손패 장수 (뒷면 카드 개수)
  handCount: number;
  // 이번 라운드에 이 좌석에서 공개된 카드들
  revealedThisRound?: KRCard[];
  // 본인이 스스로 낸 선언 (거짓 가능) — 없으면 null
  claim?: KRClaim | null;
  // '' = 미공개. game_over 스냅샷에서만 실값.
  role?: KRRole;
}

// 방금 공개된 카드 — 공개 연출용
export interface KRLastReveal {
  // 카드 주인 좌석
  seat: number;
  // 지목한 좌석
  bySeat: number;
  card: KRCard;
  message?: string;
}

export type KRWinner = 'expedition' | 'skeleton';

export type KRReason = 'kraken' | 'all_treasure' | 'timeout';

export interface KRResult {
  winner: KRWinner;
  reason: KRReason;
  message?: string;
}

// 서버가 상태 변경마다 보내는 개인화 전체 스냅샷 (은닉형 —
// yourRole·yourHand 는 본인 스냅샷에만 오고 타인·관전자에게는 키 자체가 없다)
export interface KRGameState {
  gameId: string;
  // 사설 방 코드 (공용 로비는 '' 또는 생략)
  roomCode?: string;
  phase: KRPhase;
  hostSeat: number;
  yourSeat: number;
  // 관전자 수 (생략 가능)
  spectators?: number;
  // 단계 마감 시각 (unixMillis, 없으면 0) — 지목 45초 / round_end 5초
  endsAt: number;
  // 1~4
  round: number;
  // 이번 라운드에 남은 공개 수 (라운드마다 정확히 N번)
  revealsLeft: number;
  // 지목권자 좌석
  currentSeat: number;
  // 인원별 역할 풀 — 전원 공개
  rolePool?: KRRolePool;
  // 본인 역할 (관전자는 부재)
  yourRole?: KRRole;
  // 본인 손패 중 미공개분만 (관전자는 부재)
  yourHand?: KRCard[];
  found?: KRFound;
  players?: KRPlayerView[];
  lastReveal?: KRLastReveal | null;
  result?: KRResult | null;
}

// 이벤트 kind 는 서버가 추가할 수 있어 열린 문자열로 둔다.
export interface KREvent {
  kind: string;
  seat?: number;
  name?: string;
  message?: string;
}

// kr_game_over 페이로드 — 종료 화면 자체는 마지막 스냅샷(phase 'game_over',
// 전원 역할 공개)으로 그리고, 이 페이로드는 신호+승자 보조로만 쓴다.
export interface KRGameOverPayload {
  winner?: KRWinner;
  reason?: KRReason;
  message?: string;
}

// sessionStorage 키 — 값을 바꾸면 기존 재접속 세션이 끊기므로 불변
export const KR_SESSION_KEY = 'kr_session_id';

export const KR_MIN_PLAYERS = 4;
export const KR_MAX_PLAYERS = 8;
// kr_fill_bots 는 5인까지 채우고 즉시 시작한다
export const KR_BOT_FILL_TARGET = 5;
// 총 라운드 수 (4라운드가 끝나면 시간 초과로 해골 승)
export const KR_TOTAL_ROUNDS = 4;

// 인원별 역할 풀 — 서버 rolePool 이 없을 때의 안내용 폴백 (스펙 표 그대로)
export const KR_ROLE_POOL: Record<number, KRRolePool> = {
  4: { expedition: 3, skeleton: 2 },
  5: { expedition: 4, skeleton: 2 },
  6: { expedition: 4, skeleton: 2 },
  7: { expedition: 5, skeleton: 3 },
  8: { expedition: 6, skeleton: 3 },
};

export const KR_ROLE_LABEL: Record<Exclude<KRRole, ''>, string> = {
  expedition: '탐험대',
  skeleton: '해골',
};

// 역할 아이콘 — 탐험대 🗺 / 해골 💀
export const KR_ROLE_ICON: Record<Exclude<KRRole, ''>, string> = {
  expedition: '🗺',
  skeleton: '💀',
};

export const KR_CARD_LABEL: Record<KRCard, string> = {
  treasure: '보물',
  kraken: '크라켄',
  blank: '꽝',
};

// 카드 아이콘 — 보물 💎 / 크라켄 🐙 / 꽝 ⬜
export const KR_CARD_ICON: Record<KRCard, string> = {
  treasure: '💎',
  kraken: '🐙',
  blank: '⬜',
};

// 라운드별 배분 장수 — 라운드 r 에 각자 (6-r)장
export const krHandSizeOf = (round: number): number =>
  Math.max(0, 6 - Math.max(1, round));
