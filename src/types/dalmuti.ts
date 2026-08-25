// 위대한 달무티 메시지·상태 타입 — 와이어 계약(spec-dalmuti.md)과 1:1 대응.
// 메시지 타입명·payload 필드명은 백엔드와 공유하므로 변경 금지.

export type DMPhase = 'waiting' | 'playing' | 'hand_end' | 'game_over';

export type DMMessageType =
  // 클라 → 서버
  | 'dm_join_game'
  | 'dm_fill_bots'
  | 'dm_start'
  | 'dm_rejoin'
  | 'dm_play'
  | 'dm_pass'
  | 'dm_react'
  // 서버 → 클라
  | 'dm_player_joined'
  | 'dm_spectate_joined'
  | 'dm_game_state'
  | 'dm_event'
  | 'dm_game_over'
  | 'dm_player_disconnected'
  | 'dm_player_reconnected'
  | 'dm_session_expired'
  | 'dm_error';

export interface DMMessage {
  type: DMMessageType;
  payload?: unknown;
}

// 좌석 뷰 — 손패는 은닉이고 장수(handCount)만 전원 공개.
export interface DMPlayerView {
  seat: number;
  name: string;
  connected: boolean;
  bot: boolean;
  // 남은 손패 장수 (전원 공개)
  handCount: number;
  // 이번 핸드에서 손을 다 털어 순위가 확정된 상태
  out: boolean;
  // 핸드 내 순위 (0 = 미확정, 1 = 1등 …)
  rank: number;
  // 누적 점수 (1등 = 인원-1점, 2등 = 인원-2점 … 꼴찌 0점)
  points: number;
}

// 테이블에 놓인 현재 이길 대상 세트 (null 이면 새 리드)
export interface DMTableSet {
  rank: number;
  count: number;
  // 제출한 좌석
  seat: number;
}

// hand_end 순위 연출 payload — order 는 손을 턴 순서(= 순위 순) 좌석 배열
export interface DMHandResult {
  order?: number[];
  message?: string;
}

// 서버가 상태 변경마다 보내는 개인화 전체 스냅샷
export interface DMGameState {
  gameId: string;
  // 사설 방 코드 (공용 로비는 '' 또는 생략)
  roomCode?: string;
  phase: DMPhase;
  hostSeat: number;
  yourSeat: number;
  // 관전자 수 (생략 가능)
  spectators?: number;
  // 턴 마감·다음 핸드 시각 (unixMillis, 없으면 0) — 카운트다운 표시용
  endsAt: number;
  // 현재 핸드 번호 (1~3)
  handNo: number;
  currentSeat: number;
  leadSeat: number;
  // 현재 이길 대상 세트 (null 이면 리드가 자유롭게 낸다)
  tableSet?: DMTableSet | null;
  // 내 손패 (랭크 오름차순 정렬, 본인만 — 타인·관전자는 [])
  yourHand?: number[];
  players?: DMPlayerView[];
  // hand_end 연출용 (playing 중에는 null)
  handResult?: DMHandResult | null;
}

// 이벤트 kind 는 서버가 추가할 수 있어 열린 문자열로 둔다.
export interface DMEvent {
  kind: string;
  seat?: number;
  name?: string;
  message?: string;
}

// dm_game_over 페이로드 — 종료 화면 자체는 마지막 스냅샷(phase 'game_over')으로
// 그리고, 이 페이로드는 신호+승자 보조로만 쓴다. 필드는 방어적으로 옵셔널.
export interface DMGameOverPayload {
  winnerSeats?: number[];
  winners?: string[];
  message?: string;
}

// sessionStorage 키 — 값을 바꾸면 기존 재접속 세션이 끊기므로 불변
export const DM_SESSION_KEY = 'dm_session_id';

export const DM_MIN_PLAYERS = 4;
export const DM_MAX_PLAYERS = 8;
// dm_fill_bots 는 5인까지 채우고 즉시 시작한다
export const DM_BOT_FILL_TARGET = 5;
// 3핸드 후 총점 최고 승
export const DM_TOTAL_HANDS = 3;
// 조커 — 와일드. 세트에 섞으면 그 숫자 취급, 단독으로 내면 13 취급
export const DM_JOKER = 13;

// 계급 이름 — 낮을수록 강함 (1 = 달무티 최강). 카드 전면 풍미용.
const DM_RANK_NAMES: Record<number, string> = {
  1: '달무티',
  2: '대주교',
  3: '시종장',
  4: '남작부인',
  5: '수녀원장',
  6: '기사',
  7: '재봉사',
  8: '석공',
  9: '요리사',
  10: '양치기',
  11: '광부',
  12: '농노',
  13: '어릿광대',
};

export function dmRankName(rank: number): string {
  return DM_RANK_NAMES[rank] ?? String(rank);
}

// 계급 구간 — 카드 잉크 색 식별용 (귀족 / 중산 / 평민 / 조커)
export function dmRankTier(rank: number): 'noble' | 'mid' | 'low' | 'joker' {
  if (rank === DM_JOKER) return 'joker';
  if (rank <= 4) return 'noble';
  if (rank <= 8) return 'mid';
  return 'low';
}

// 손패의 같은 숫자 스택 그룹 (랭크 오름차순 = 강한 카드부터)
export interface DMHandGroup {
  rank: number;
  count: number;
}

export function dmGroupHand(hand: number[]): DMHandGroup[] {
  const counts = new Map<number, number>();
  for (const rank of hand) {
    counts.set(rank, (counts.get(rank) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([rank, count]) => ({ rank, count }))
    .sort((a, b) => a.rank - b.rank);
}

// 순위 뱃지 문구 (1 = 👑, 이후 N등) — rank 0(미확정)은 빈 문자열
export function dmRankBadge(rank: number): string {
  if (rank <= 0) return '';
  return rank === 1 ? '👑 1등' : `${rank}등`;
}
