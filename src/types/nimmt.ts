// 6 님트! 메시지·상태 타입 — 와이어 계약(spec-nimmt.md)과 1:1 대응.
// 메시지 타입명·payload 필드명은 백엔드와 공유하므로 변경 금지.

export type NMPhase =
  | 'waiting'
  | 'picking'
  | 'revealing'
  | 'choosing_row'
  | 'game_over';

export type NMMessageType =
  // 클라 → 서버
  | 'nm_join_game'
  | 'nm_fill_bots'
  | 'nm_start'
  | 'nm_rejoin'
  | 'nm_pick'
  | 'nm_choose_row'
  | 'nm_react'
  // 서버 → 클라
  | 'nm_player_joined'
  | 'nm_spectate_joined'
  | 'nm_game_state'
  | 'nm_event'
  | 'nm_game_over'
  | 'nm_player_disconnected'
  | 'nm_player_reconnected'
  | 'nm_session_expired'
  | 'nm_error';

export interface NMMessage {
  type: NMMessageType;
  payload?: unknown;
}

// 좌석 뷰 — 손패는 은닉(yourHand 본인만), 여기엔 공개 정보만 온다.
export interface NMPlayerView {
  seat: number;
  name: string;
  connected: boolean;
  bot: boolean;
  // picking 중 제출 여부만 공개 (카드는 revealing 에 일괄 공개)
  picked: boolean;
  // 소머리 벌점 누적 (전원 공개, 최소가 승리)
  penalty: number;
}

// revealing 에 일괄 공개되는 제출 카드 (picking 중엔 스냅샷에 부재)
export interface NMPick {
  seat: number;
  card: number;
}

// 직전 배치 결과 — 순차 하이라이트·"행을 먹었다" 안내용
export interface NMPlacement {
  seat: number;
  card: number;
  // 놓인(또는 새로 시작한) 행 0~3
  row: number;
  // true = 그 행 카드를 벌점으로 먹고 새 행 시작
  ate: boolean;
}

// 서버가 상태 변경마다 보내는 개인화 전체 스냅샷
export interface NMGameState {
  gameId: string;
  // 사설 방 코드 (공용 로비는 '' 또는 생략)
  roomCode?: string;
  phase: NMPhase;
  hostSeat: number;
  yourSeat: number;
  // 관전자 수 (생략 가능)
  spectators?: number;
  // 단계 마감 시각 (unixMillis, 없으면 0) — AFK 카운트다운 표시용
  endsAt: number;
  // 현재 트릭 1~10
  trick: number;
  // 4개 행 — 각 행은 카드 오름차순 열. 서버 회귀 대비 ?? [] 방어 필수
  rows?: number[][];
  // 내 손패 (본인만 실값 — 타인·관전자는 빈 배열 [])
  yourHand?: number[];
  // revealing 일괄 공개 — picking 중엔 부재
  picks?: NMPick[];
  players?: NMPlayerView[];
  // choosing_row 에서 행을 고르는 좌석 (-1 = 없음)
  chooserSeat: number;
  lastPlacement?: NMPlacement | null;
}

// 이벤트 kind 는 서버가 추가할 수 있어 열린 문자열로 둔다.
export interface NMEvent {
  kind: string;
  seat?: number;
  name?: string;
  message?: string;
}

// nm_game_over 페이로드 — 종료 화면 자체는 마지막 스냅샷(phase 'game_over')으로
// 그리고, 이 페이로드는 신호+승자 보조로만 쓴다. 필드는 방어적으로 옵셔널.
export interface NMGameOverPayload {
  winnerSeats?: number[];
  winners?: string[];
  message?: string;
}

// sessionStorage 키 — 값을 바꾸면 기존 재접속 세션이 끊기므로 불변
export const NM_SESSION_KEY = 'nm_session_id';

export const NM_MIN_PLAYERS = 2;
export const NM_MAX_PLAYERS = 10;
// nm_fill_bots 는 6인까지 채우고 즉시 시작한다
export const NM_BOT_FILL_TARGET = 6;

export const NM_ROW_COUNT = 4;
// 6번째 카드가 되면 행을 먹는다 → 5장이 찬 행은 경고 표시
export const NM_ROW_MAX = 5;
export const NM_TRICKS = 10;

// 카드별 소머리 수 — 55 는 7, 11의 배수 5, 10의 배수 3, 5의 배수 2, 그 외 1.
// (55 는 5·11 의 배수이기도 하므로 판정 순서가 중요하다)
export function nmBullheads(card: number): number {
  if (card === 55) return 7;
  if (card % 11 === 0) return 5;
  if (card % 10 === 0) return 3;
  if (card % 5 === 0) return 2;
  return 1;
}

// 행의 소머리 합 — 먹었을 때의 벌점
export function nmRowPenalty(row: number[]): number {
  return row.reduce((sum, card) => sum + nmBullheads(card), 0);
}

// 소머리 수 구간 — 카드 잉크 색 식별용 (많을수록 위험)
export function nmCardTier(card: number): 'low' | 'mid' | 'high' {
  const bulls = nmBullheads(card);
  if (bulls <= 1) return 'low';
  if (bulls <= 3) return 'mid';
  return 'high';
}
