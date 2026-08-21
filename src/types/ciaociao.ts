// 차오차오 메시지·상태 타입 — 와이어 계약(spec-ciaociao.md)과 1:1 대응.
// 메시지 타입명·payload 필드명은 백엔드와 공유하므로 변경 금지.

export type CCPhase = 'waiting' | 'rolling' | 'doubt_window' | 'game_over';

export type CCMessageType =
  // 클라 → 서버
  | 'cc_join_game'
  | 'cc_fill_bots'
  | 'cc_start'
  | 'cc_rejoin'
  | 'cc_declare'
  | 'cc_doubt'
  | 'cc_allow'
  | 'cc_react'
  // 서버 → 클라
  | 'cc_player_joined'
  | 'cc_spectate_joined'
  | 'cc_game_state'
  | 'cc_event'
  | 'cc_game_over'
  | 'cc_player_disconnected'
  | 'cc_player_reconnected'
  | 'cc_session_expired'
  | 'cc_error';

export interface CCMessage {
  type: CCMessageType;
  payload?: unknown;
}

// 좌석 뷰 — 말 3개로 시작, 다리 위 말 위치는 onBridge(칸 위치 배열)로 온다.
export interface CCPlayerView {
  seat: number;
  name: string;
  connected: boolean;
  bot: boolean;
  // 말을 전부 잃으면 false (탈락)
  alive: boolean;
  // 아직 다리에 올리지 않은 예비 말 수
  pawnsLeft: number;
  // 다리 위 말들의 칸 위치 배열 — 서버 회귀 대비 ?? [] 방어 필수
  onBridge?: number[];
  // 다리를 끝까지 건너 통과시킨 말 수 (2개면 승리)
  crossed: number;
}

// 판정 공개 — 의심 창이 닫힌 직후 실제 주사위 값과 결과를 전원에게 공개
export interface CCLastReveal {
  // 선언자 좌석
  seat: number;
  // 선언했던 값 (1~4)
  declared: number;
  // 실제 주사위 값 (1~4, 0 = X)
  actual: number;
  // 의심자 좌석 (의심 없이 통과면 -1 또는 생략)
  doubterSeat?: number;
  // 서버가 정의하는 판정 종류 — 열린 문자열로 둔다
  result?: string;
  message?: string;
}

// 서버가 상태 변경마다 보내는 개인화 전체 스냅샷
export interface CCGameState {
  gameId: string;
  // 사설 방 코드 (공용 로비는 '' 또는 생략)
  roomCode?: string;
  phase: CCPhase;
  hostSeat: number;
  yourSeat: number;
  // 관전자 수 (생략 가능)
  spectators?: number;
  // 단계 마감 시각 (unixMillis, 없으면 0) — AFK·의심 창 카운트다운 표시용
  endsAt: number;
  currentSeat: number;
  // 은닉의 핵심: 본인 차례 rolling 에만 실값(1~4, 0 = X).
  // 타인·관전자에게는 필드 자체가 없다 — undefined 방어 필수.
  yourRoll?: number;
  // 선언 값 (doubt_window 에 1~4)
  declared?: number;
  // 직전 판정 공개 (없으면 null/생략)
  lastReveal?: CCLastReveal | null;
  players?: CCPlayerView[];
  // 다리 칸 수 (기본 7)
  bridgeLen?: number;
}

// 이벤트 kind 는 서버가 추가할 수 있어 열린 문자열로 둔다.
export interface CCEvent {
  kind: string;
  seat?: number;
  name?: string;
  message?: string;
}

// cc_game_over 페이로드 — 종료 화면 자체는 마지막 스냅샷(phase 'game_over')으로
// 그리고, 이 페이로드는 신호+승자 보조로만 쓴다. 필드는 방어적으로 옵셔널.
export interface CCGameOverPayload {
  winnerSeats?: number[];
  winners?: string[];
  message?: string;
}

// sessionStorage 키 — 값을 바꾸면 기존 재접속 세션이 끊기므로 불변
export const CC_SESSION_KEY = 'cc_session_id';

export const CC_MIN_PLAYERS = 2;
export const CC_MAX_PLAYERS = 4;
// cc_fill_bots 는 4인까지 채우고 즉시 시작한다
export const CC_BOT_FILL_TARGET = 4;

export const CC_BRIDGE_LEN = 7;
export const CC_START_PAWNS = 3;
export const CC_WIN_CROSSED = 2;

// 주사위 값(1~4)의 3×3 눈금 칸 인덱스 — YachtBoard 의 CSS 도트 결
export const CC_PIP_CELLS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
};

// 다리 칸 위치를 렌더 가능한 1~bridgeLen 범위로 접는다 (서버 회귀 방어)
export function ccClampPos(pos: number, bridgeLen: number): number {
  return Math.min(Math.max(pos, 1), bridgeLen);
}
