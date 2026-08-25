// 스컬(해골과 장미) 메시지·상태 타입 — 와이어 계약(spec-skull.md)과 1:1 대응.
// 메시지 타입명·payload 필드명은 백엔드와 공유하므로 변경 금지.

export type SKCard = 'rose' | 'skull';

export type SKPhase =
  | 'waiting'
  | 'placing'
  | 'bidding'
  | 'flipping'
  | 'round_end'
  | 'game_over';

export type SKMessageType =
  // 클라 → 서버
  | 'sk_join_game'
  | 'sk_fill_bots'
  | 'sk_start'
  | 'sk_rejoin'
  | 'sk_place'
  | 'sk_bid'
  | 'sk_pass'
  | 'sk_flip'
  | 'sk_react'
  // 서버 → 클라
  | 'sk_player_joined'
  | 'sk_spectate_joined'
  | 'sk_game_state'
  | 'sk_event'
  | 'sk_game_over'
  | 'sk_opponent_disconnected'
  | 'sk_reconnected'
  | 'sk_session_expired'
  | 'sk_error';

export interface SKMessage {
  type: SKMessageType;
  payload?: unknown;
}

// 공개 좌석 뷰 — 카드 내용은 절대 없다 (장수·점수·베팅 상태만)
export interface SKPlayerView {
  seat: number;
  name: string;
  connected: boolean;
  bot: boolean;
  alive: boolean;
  handCount: number;
  stackCount: number;
  points: number;
  // 이번 베팅 라운드에서 빠졌는지
  passed: boolean;
  // 현재 선언한 베팅 수 (없으면 0)
  bid: number;
}

// 뒤집기 단계에서 공개된 카드 한 장 (순서대로 쌓인다)
export interface SKFlipEntry {
  seat: number;
  card: SKCard;
}

export interface SKRoundResult {
  kind: 'success' | 'fail';
  seat: number;
  message?: string;
}

// 서버가 상태 변경마다 보내는 개인화 전체 스냅샷.
// yourHand/yourStack 은 내 것만 온다 — 관전자(yourSeat -1)는 빈 배열.
export interface SKGameState {
  gameId: string;
  phase: SKPhase;
  hostSeat: number;
  yourSeat: number;
  // 행동할 좌석 (없으면 -1 — 동시 배치 구간 등)
  currentSeat: number;
  // 현재 단계 마감 시각 (unixMillis, 없으면 0) — AFK 카운트다운 표시용
  endsAt: number;
  // 내 손패 / 내가 내려놓은 더미(아래→위 순서). 서버 회귀 대비 ?? [] 방어 필수.
  yourHand?: SKCard[];
  yourStack?: SKCard[];
  players: SKPlayerView[];
  // 현재 최고 베팅 (없으면 0)
  highBid: number;
  // 도전자 좌석 (-1 없음)
  challengerSeat: number;
  // 이번 뒤집기에서 공개된 카드들 — 순서대로
  flipped?: SKFlipEntry[] | null;
  // 성공까지 남은 장미 수
  flipTarget: number;
  roundResult?: SKRoundResult | null;
  // 사설 방 코드 (공용 로비는 '' 또는 생략)
  roomCode?: string;
  // 관전자 수 (생략 가능)
  spectators?: number;
}

// 이벤트 kind 는 서버가 추가할 수 있어 열린 문자열로 둔다.
// 토스트는 message 우선 → kind 조립 순서로 그린다.
export interface SKEvent {
  kind: string;
  seat?: number;
  name?: string;
  message?: string;
}

// sk_game_over 페이로드 — 종료 화면 자체는 마지막 스냅샷(phase 'game_over')으로
// 그리고, 이 페이로드는 신호+승자 보조로만 쓴다. 필드는 방어적으로 옵셔널.
export interface SKGameOverPayload {
  winnerSeat?: number;
  winner?: string;
  message?: string;
}

// sessionStorage 키 — 값을 바꾸면 기존 재접속 세션이 끊기므로 불변
export const SK_SESSION_KEY = 'sk_session_id';

export const SK_MIN_PLAYERS = 3;
export const SK_MAX_PLAYERS = 6;

// 2점 선취 승리
export const SK_WIN_POINTS = 2;

export const SK_CARD_LABEL: Record<SKCard, string> = {
  rose: '장미',
  skull: '해골',
};

export const SK_CARD_ICON: Record<SKCard, string> = {
  rose: '🌹',
  skull: '💀',
};
