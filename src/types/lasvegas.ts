// 라스베가스 메시지·상태 타입 — 와이어 계약(spec-lasvegas.md)과 1:1 대응.
// 메시지 타입명·payload 필드명은 백엔드와 공유하므로 변경 금지.

export type VGPhase = 'waiting' | 'placing' | 'round_end' | 'game_over';

export type VGMessageType =
  // 클라 → 서버
  | 'vg_join_game'
  | 'vg_fill_bots'
  | 'vg_start'
  | 'vg_rejoin'
  | 'vg_place'
  | 'vg_react'
  // 서버 → 클라 (표준 세트)
  | 'vg_player_joined'
  | 'vg_spectate_joined'
  | 'vg_game_state'
  | 'vg_event'
  | 'vg_game_over'
  | 'vg_player_disconnected'
  | 'vg_player_reconnected'
  | 'vg_session_expired'
  | 'vg_error';

export interface VGMessage {
  type: VGMessageType;
  payload?: unknown;
}

export interface VGPlayerView {
  seat: number;
  name: string;
  connected: boolean;
  bot: boolean;
  // 획득한 총액 (만 단위 int — 전부 공개)
  cash: number;
  // 아직 배치하지 않은 주사위 수 (0~8)
  diceLeft: number;
}

// 카지노 한 곳 — 눈(face) 1~6, 깔린 지폐(만 단위 desc 정렬), 좌석별 배치 수
export interface VGCasinoView {
  face: number;
  // 반드시 ?? [] 방어
  bills?: number[];
  // 좌석 → 배치된 주사위 수 (JSON 키는 문자열) — 반드시 ?? {} 방어
  placed?: Record<string, number>;
}

// 라운드 정산 안내 — round_end 스냅샷에 실려 온다
export interface VGRoundResult {
  message?: string;
}

// 서버가 상태 변경마다 보내는 전체 스냅샷.
// 은닉 없음(전부 공개) — 관전자도 같은 스냅샷을 받는다.
export interface VGGameState {
  gameId: string;
  // 사설 방 코드 (공용 로비는 '' 또는 생략)
  roomCode?: string;
  phase: VGPhase;
  hostSeat: number;
  // 관전자는 -1
  yourSeat: number;
  // 관전자 수 (구버전 서버는 생략)
  spectators?: number;
  // 턴 마감 시각 (unixMillis, 없으면 0) — 카운트다운 표시용
  endsAt: number;
  // 라운드 1~4
  round: number;
  currentSeat: number;
  // 현재 차례가 굴린 주사위 — 전원 공개, 차례 아닐 땐 []. 반드시 ?? [] 방어
  dice?: number[];
  // 카지노 6곳 — 반드시 ?? [] 방어
  casinos?: VGCasinoView[];
  players?: VGPlayerView[];
  roundResult?: VGRoundResult | null;
  // game_over 시 공동 승자 좌석 목록 (구버전 서버는 생략 — cash 로 유추)
  winnerSeats?: number[];
}

// 서버 이벤트 — kind 목록은 백엔드 재량이라 열지 않고,
// 표시 문구는 서버 message 우선 + joined/left 만 클라 조립한다.
export interface VGEvent {
  kind: string;
  seat?: number;
  name?: string;
  message?: string;
}

// vg_game_over 페이로드 — 종료 화면 자체는 마지막 스냅샷(phase 'game_over')
// 으로 그리고, 이 페이로드는 신호+승자 보조로만 쓴다.
export interface VGGameOverPayload {
  winnerSeats?: number[];
}

// sessionStorage 키 — 값을 바꾸면 기존 재접속 세션이 끊기므로 불변
export const VG_SESSION_KEY = 'vg_session_id';

export const VG_MIN_PLAYERS = 2;
export const VG_MAX_PLAYERS = 5;
// fill_bots 는 4인을 채워 즉시 시작한다
export const VG_BOT_FILL_TARGET = 4;
export const VG_ROUNDS = 4;
export const VG_DICE_PER_PLAYER = 8;
export const VG_CASINO_COUNT = 6;

// 만 단위 int → 화면 표기 ("8만 달러").
// 한국어판 구성물은 1만~9만 "달러" 지폐라 단위를 붙여야 원판과 맞는다.
export function vgMoney(amount: number): string {
  return `${amount}만 달러`;
}
