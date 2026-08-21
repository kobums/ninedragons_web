// 인디언 포커 메시지·상태 타입 — 와이어 계약(spec-indianpoker.md)과 1:1 대응.
// 메시지 타입명·payload 필드명은 백엔드와 공유하므로 변경 금지.

export type IPPhase =
  | 'waiting'
  | 'betting'
  | 'showdown'
  | 'round_end'
  | 'game_over';

export type IPMessageType =
  // 클라 → 서버
  | 'ip_join_game'
  | 'ip_fill_bots'
  | 'ip_start'
  | 'ip_rejoin'
  | 'ip_call'
  | 'ip_raise'
  | 'ip_fold'
  | 'ip_react'
  // 서버 → 클라
  | 'ip_player_joined'
  | 'ip_spectate_joined'
  | 'ip_game_state'
  | 'ip_event'
  | 'ip_game_over'
  | 'ip_player_disconnected'
  | 'ip_player_reconnected'
  | 'ip_session_expired'
  | 'ip_error';

export interface IPMessage {
  type: IPMessageType;
  payload?: unknown;
}

// 좌석 뷰 — 역은닉의 핵심: card 는 "viewer 본인 좌석만 0"으로 온다.
// 폴드자는 전원에게 0, showdown/round_end 에는 생존자 전원 실값(본인 포함).
export interface IPPlayerView {
  seat: number;
  name: string;
  connected: boolean;
  bot: boolean;
  alive: boolean;
  folded: boolean;
  chips: number;
  betThisRound: number;
  // 1~10 실값, 0 = 은닉(본인/폴드). 서버 회귀 대비 ?? 0 방어 필수.
  card?: number;
}

export interface IPRoundResult {
  winnerSeats?: number[];
  // 카드값 요약 등 서버 조립 문구
  message?: string;
}

// 서버가 상태 변경마다 보내는 개인화 전체 스냅샷.
// 관전자(yourSeat -1)는 전원 카드가 실값으로 보인다 (폴드자만 0).
export interface IPGameState {
  gameId: string;
  phase: IPPhase;
  hostSeat: number;
  yourSeat: number;
  // 행동할 좌석 (없으면 -1)
  currentSeat: number;
  // 현재 단계 마감 시각 (unixMillis, 없으면 0) — AFK 카운트다운 표시용
  endsAt: number;
  // 1~10
  round: number;
  pot: number;
  // 이번 라운드에 맞춰야 하는 베팅액 (개인당)
  currentBet: number;
  // 라운드 전체 레이즈 잔여 횟수 (총 3회 상한)
  raisesLeft: number;
  players?: IPPlayerView[];
  roundResult?: IPRoundResult | null;
  // 사설 방 코드 (공용 로비는 '' 또는 생략)
  roomCode?: string;
  // 관전자 수 (생략 가능)
  spectators?: number;
}

// 이벤트 kind 는 서버가 추가할 수 있어 열린 문자열로 둔다.
export interface IPEvent {
  kind: string;
  seat?: number;
  name?: string;
  message?: string;
}

// ip_game_over 페이로드 — 종료 화면 자체는 마지막 스냅샷(phase 'game_over')으로
// 그리고, 이 페이로드는 신호+승자 보조로만 쓴다. 필드는 방어적으로 옵셔널.
export interface IPGameOverPayload {
  winnerSeats?: number[];
  winners?: string[];
  message?: string;
}

// sessionStorage 키 — 값을 바꾸면 기존 재접속 세션이 끊기므로 불변
export const IP_SESSION_KEY = 'ip_session_id';

export const IP_MIN_PLAYERS = 2;
export const IP_MAX_PLAYERS = 6;
// ip_fill_bots 는 4인까지 채우고 즉시 시작한다 (lv 결)
export const IP_BOT_FILL_TARGET = 4;

export const IP_ROUNDS = 10;
export const IP_START_CHIPS = 20;
// 라운드 전체 레이즈 상한 / 1회 레이즈 최대 폭
export const IP_MAX_RAISES = 3;
export const IP_MAX_RAISE_AMOUNT = 3;
