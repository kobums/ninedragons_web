// 세트 메시지·상태 타입 — 와이어 계약(spec-set.md)과 1:1 대응.
// 메시지 타입명·payload 필드명은 백엔드와 공유하므로 변경 금지.
//
// 이 게임은 플랫폼 최초의 "차례 없는" 동시 진행 게임이다. currentSeat 같은
// 턴 필드가 아예 없고, 누구든 언제든 se_claim 을 보내 선착순으로 판정받는다.

// 모양 3종 — 다이아몬드·물결·타원 (색 없이도 구분되도록 인라인 SVG 로 그린다)
export type SEShape = 'diamond' | 'wave' | 'oval';

// 채움 3종 — 꽉 참·사선 빗금·외곽선만
export type SEFill = 'solid' | 'stripe' | 'empty';

// 색 3종 — 빨강·초록·보라
export type SEColor = 'red' | 'green' | 'purple';

export type SEPhase = 'waiting' | 'playing' | 'game_over';

export type SEMessageType =
  // 클라 → 서버
  | 'se_join_game'
  | 'se_fill_bots'
  | 'se_start'
  | 'se_rejoin'
  | 'se_claim'
  | 'se_react'
  // 서버 → 클라
  | 'se_player_joined'
  | 'se_spectate_joined'
  | 'se_game_state'
  | 'se_event'
  | 'se_game_over'
  | 'se_player_disconnected'
  | 'se_player_reconnected'
  | 'se_session_expired'
  | 'se_error';

export interface SEMessage {
  type: SEMessageType;
  payload?: unknown;
}

// 바닥에 깔린 카드 한 장. id 는 0~80 고정(속성 조합에서 유도되지만
// 계약대로 속성 4종을 항상 함께 받으므로 프론트는 속성만 보고 그린다).
export interface SECard {
  id: number;
  shape: SEShape;
  // 1~3 — 카드 안에 이 개수만큼 같은 심볼을 세로로 배열한다
  count: number;
  fill: SEFill;
  color: SEColor;
}

// 좌석 뷰 — 은닉이 없는 게임이라 전원 동일한 값을 본다
export interface SEPlayerView {
  seat: number;
  name: string;
  connected: boolean;
  bot: boolean;
  score: number;
  // 오답 잠금 해제 시각 (unixMillis). 0 이면 잠금 없음.
  lockedUntil: number;
}

// 직전 판정 결과 — 누가 성공/실패했는지 배너로 띄운다
export interface SELastClaim {
  seat: number;
  name: string;
  ok: boolean;
  // 판정 대상이 된 카드 3장의 id
  ids: number[];
  message?: string;
}

export interface SEResult {
  winnerSeats: number[];
  winnerNames: string[];
  message?: string;
}

// 서버가 상태 변경마다 보내는 전체 스냅샷.
// 은닉이 없으므로 관전자도 동일한 값을 받고 yourSeat 만 -1 이다.
export interface SEGameState {
  gameId: string;
  // 사설 방 코드 (공용 로비는 '' 또는 생략)
  roomCode?: string;
  phase: SEPhase;
  hostSeat: number;
  yourSeat: number;
  // 관전자 수 (생략 가능)
  spectators?: number;
  // 강제 종료 시각 (unixMillis, 없으면 0) — 시작 후 10분 캡
  endsAt: number;
  // 바닥에 펼쳐진 카드 (12~21장, 대기 중에는 빈 배열)
  board?: SECard[];
  // 덱에 남은 장수
  deckLeft: number;
  // 이번 판에 발견된 세트 총 개수
  setsFound: number;
  players?: SEPlayerView[];
  lastClaim?: SELastClaim | null;
  result?: SEResult | null;
}

// 이벤트 kind 는 서버가 추가할 수 있어 열린 문자열로 둔다.
export interface SEEvent {
  kind: string;
  seat?: number;
  name?: string;
  message?: string;
}

// se_game_over 페이로드 — 종료 화면 자체는 마지막 스냅샷(phase 'game_over')
// 으로 그리고, 이 페이로드는 신호 + 승자 보조로만 쓴다.
export interface SEGameOverPayload {
  winnerSeats?: number[];
  winnerNames?: string[];
  message?: string;
}

// sessionStorage 키 — 값을 바꾸면 기존 재접속 세션이 끊기므로 불변
export const SE_SESSION_KEY = 'se_session_id';

// 혼자서도 연습으로 시작할 수 있다 (차례가 없어 대기할 상대가 필요 없다)
export const SE_MIN_PLAYERS = 1;
export const SE_MAX_PLAYERS = 8;
// se_fill_bots 는 4인까지 채우고 즉시 시작한다
export const SE_BOT_FILL_TARGET = 4;

// 한 번에 고르는 카드 수 — 3장을 채우는 순간 자동 제출된다
export const SE_CLAIM_SIZE = 3;
// 오답 잠금 길이 (서버 lockedUntil 이 진실이고, 이 값은 안내 문구용)
export const SE_LOCK_MS = 5000;
// 바닥 기본 장수 / 세트가 없을 때 늘어나는 상한
export const SE_BOARD_BASE = 12;
export const SE_BOARD_MAX = 21;

// 색약 대비 — 모양·채움·색을 말로도 읽어 주기 위한 한글 라벨 (aria-label 용)
export const SE_SHAPE_LABEL: Record<SEShape, string> = {
  diamond: '다이아몬드',
  wave: '물결',
  oval: '타원',
};

export const SE_FILL_LABEL: Record<SEFill, string> = {
  solid: '채움',
  stripe: '빗금',
  empty: '비움',
};

export const SE_COLOR_LABEL: Record<SEColor, string> = {
  red: '빨강',
  green: '초록',
  purple: '보라',
};

// 카드 한 장을 말로 읽은 문자열 — "빨강 물결 빗금 2개"
export const seCardLabel = (card: SECard): string =>
  `${SE_COLOR_LABEL[card.color]} ${SE_SHAPE_LABEL[card.shape]} ` +
  `${SE_FILL_LABEL[card.fill]} ${card.count}개`;

// 남은 잠금 시간(초, 올림). lockedUntil 0 이거나 지났으면 0.
export const seLockSeconds = (lockedUntil: number, now: number): number =>
  lockedUntil > now ? Math.ceil((lockedUntil - now) / 1000) : 0;
