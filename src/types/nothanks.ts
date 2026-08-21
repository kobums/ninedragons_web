// 노 땡스! 메시지·상태 타입 — 와이어 계약(spec-nothanks.md)과 1:1 대응.
// 메시지 타입명·payload 필드명은 백엔드와 공유하므로 변경 금지.

export type NTPhase = 'waiting' | 'playing' | 'game_over';

export type NTMessageType =
  // 클라 → 서버
  | 'nt_join_game'
  | 'nt_fill_bots'
  | 'nt_start'
  | 'nt_rejoin'
  | 'nt_pass'
  | 'nt_take'
  | 'nt_react'
  // 서버 → 클라
  | 'nt_player_joined'
  | 'nt_spectate_joined'
  | 'nt_game_state'
  | 'nt_event'
  | 'nt_game_over'
  | 'nt_player_disconnected'
  | 'nt_player_reconnected'
  | 'nt_session_expired'
  | 'nt_error';

export interface NTMessage {
  type: NTMessageType;
  payload?: unknown;
}

// 좌석 뷰 — 은닉의 핵심: chips 는 본인만 실값, 타인은 -1 로 온다.
// 쇼다운(game_over)에만 전원 공개. 관전자는 전원 -1.
export interface NTPlayerView {
  seat: number;
  name: string;
  connected: boolean;
  bot: boolean;
  // -1 = 은닉 (타인·관전자) — "?" 로 렌더한다
  chips: number;
  // 획득 카드 (정렬, 전원 공개) — 서버 회귀 대비 ?? [] 방어 필수
  cards?: number[];
  // game_over 에만 실값, 그 외 0
  score?: number;
}

// 서버가 상태 변경마다 보내는 개인화 전체 스냅샷
export interface NTGameState {
  gameId: string;
  // 사설 방 코드 (공용 로비는 '' 또는 생략)
  roomCode?: string;
  phase: NTPhase;
  hostSeat: number;
  yourSeat: number;
  // 관전자 수 (생략 가능)
  spectators?: number;
  // 턴 마감 시각 (unixMillis, 없으면 0) — AFK 카운트다운 표시용
  endsAt: number;
  currentSeat: number;
  deckCount: number;
  // 현재 공개 카드 (3~35, 없으면 0)
  card: number;
  // 공개 카드 위에 얹힌 칩 수
  potChips: number;
  players?: NTPlayerView[];
}

// 이벤트 kind 는 서버가 추가할 수 있어 열린 문자열로 둔다.
export interface NTEvent {
  kind: string;
  seat?: number;
  name?: string;
  message?: string;
}

// nt_game_over 페이로드 — 종료 화면 자체는 마지막 스냅샷(phase 'game_over')으로
// 그리고, 이 페이로드는 신호+승자 보조로만 쓴다. 필드는 방어적으로 옵셔널.
export interface NTGameOverPayload {
  winnerSeats?: number[];
  winners?: string[];
  message?: string;
}

// sessionStorage 키 — 값을 바꾸면 기존 재접속 세션이 끊기므로 불변
export const NT_SESSION_KEY = 'nt_session_id';

export const NT_MIN_PLAYERS = 3;
export const NT_MAX_PLAYERS = 7;
// nt_fill_bots 는 5인까지 채우고 즉시 시작한다
export const NT_BOT_FILL_TARGET = 5;

// 덱 상수 — 3~35 카드 33장 중 9장 비공개 제거 후 24장 사용
export const NT_DECK_SIZE = 24;
export const NT_START_CHIPS = 11;

// 획득 카드를 연속 시퀀스끼리 묶는다 (오름차순, 예: [3,4,5],[9],[22,23])
export function ntGroupCards(cards: number[]): number[][] {
  const sorted = [...cards].sort((a, b) => a - b);
  const groups: number[][] = [];
  for (const v of sorted) {
    const last = groups[groups.length - 1];
    if (last && v === last[last.length - 1] + 1) {
      last.push(v);
    } else {
      groups.push([v]);
    }
  }
  return groups;
}

// 카드 점수 합 — 연속 시퀀스는 최솟값만 계산 (예: 22·23·24 = 22점)
export function ntCardSum(cards: number[]): number {
  return ntGroupCards(cards).reduce((sum, group) => sum + group[0], 0);
}

// 카드값 구간 — 실물 카드의 잉크 색 식별용 (낮음=순함, 높음=위험)
export function ntCardTier(value: number): 'low' | 'mid' | 'high' {
  if (value <= 13) return 'low';
  if (value <= 24) return 'mid';
  return 'high';
}
