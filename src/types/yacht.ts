// 요트 다이스 메시지·상태 타입 — 와이어 계약(spec-yacht.md)과 1:1 대응.
// 메시지 타입명·payload 필드명은 백엔드와 공유하므로 변경 금지.

export type YTPhase = 'waiting' | 'playing' | 'game_over';

// 점수표 카테고리 — 와이어 계약의 category 문자열 그대로
export type YTCategory =
  | 'ones'
  | 'twos'
  | 'threes'
  | 'fours'
  | 'fives'
  | 'sixes'
  | 'triple'
  | 'quad'
  | 'fullhouse'
  | 'small'
  | 'large'
  | 'yacht'
  | 'chance';

export type YTMessageType =
  // 클라 → 서버
  | 'yt_join_game'
  | 'yt_fill_bots'
  | 'yt_start'
  | 'yt_rejoin'
  | 'yt_roll'
  | 'yt_score'
  | 'yt_react'
  // 서버 → 클라 (표준 세트)
  | 'yt_player_joined'
  | 'yt_spectate_joined'
  | 'yt_game_state'
  | 'yt_event'
  | 'yt_game_over'
  | 'yt_player_disconnected'
  | 'yt_player_reconnected'
  | 'yt_session_expired'
  | 'yt_error';

export interface YTMessage {
  type: YTMessageType;
  payload?: unknown;
}

export interface YTPlayerView {
  seat: number;
  name: string;
  connected: boolean;
  bot: boolean;
  total: number;
  upperSum: number;
  bonus: number;
  // 카테고리별 점수 — -1 = 미기록 (누락 키도 미기록으로 방어)
  scores: Partial<Record<YTCategory, number>>;
}

// 직전 기록 액션 — 배너 보조 문구용
export interface YTLastAction {
  seat: number;
  category: YTCategory;
  points: number;
}

// 서버가 상태 변경마다 보내는 전체 스냅샷.
// 주사위는 전원 공개(은닉 없음)라 관전자도 같은 스냅샷을 받는다.
export interface YTGameState {
  gameId: string;
  // 사설 방 코드 (공용 로비는 '' 또는 생략)
  roomCode?: string;
  phase: YTPhase;
  hostSeat: number;
  // 관전자는 -1
  yourSeat: number;
  // 관전자 수 (구버전 서버는 생략)
  spectators?: number;
  // 턴 마감 시각 (unixMillis, 없으면 0) — 카운트다운 표시용
  endsAt: number;
  currentSeat: number;
  round: number;
  // 계약상 항상 5개지만 반드시 ?? [] 방어
  dice?: number[];
  held?: boolean[];
  // 남은 굴림 횟수 0~3 (3 = 이번 턴 아직 안 굴림)
  rollsLeft: number;
  players?: YTPlayerView[];
  lastAction?: YTLastAction | null;
  // game_over 시 공동 승자 좌석 목록
  winnerSeats?: number[];
}

// 서버 이벤트 — kind 목록은 백엔드 재량이라 열지 않고,
// 표시 문구는 서버 message 우선 + joined/left 만 클라 조립한다.
export interface YTEvent {
  kind: string;
  seat?: number;
  name?: string;
  message?: string;
}

// yt_game_over 페이로드 — 종료 화면 자체는 마지막 스냅샷(phase 'game_over')
// 으로 그리고, 이 페이로드는 신호+승자 보조로만 쓴다.
export interface YTGameOverPayload {
  winnerSeats?: number[];
}

// sessionStorage 키 — 값을 바꾸면 기존 재접속 세션이 끊기므로 불변
export const YT_SESSION_KEY = 'yt_session_id';

export const YT_MIN_PLAYERS = 2;
export const YT_MAX_PLAYERS = 4;
// 턴당 최대 굴림 횟수
export const YT_MAX_ROLLS = 3;
// 상단 보너스 — 상단 합계 63 이상이면 +35
export const YT_UPPER_BONUS_THRESHOLD = 63;
export const YT_UPPER_BONUS = 35;

export interface YTCategoryMeta {
  id: YTCategory;
  label: string;
  section: 'upper' | 'lower';
  // 점수표 행의 한 줄 설명
  hint: string;
}

// 점수표 행 순서 (상단 6 + 하단 7) — 와이어 category 와 1:1
export const YT_CATEGORIES: YTCategoryMeta[] = [
  { id: 'ones', label: '1 (하나)', section: 'upper', hint: '1의 눈 합' },
  { id: 'twos', label: '2 (둘)', section: 'upper', hint: '2의 눈 합' },
  { id: 'threes', label: '3 (셋)', section: 'upper', hint: '3의 눈 합' },
  { id: 'fours', label: '4 (넷)', section: 'upper', hint: '4의 눈 합' },
  { id: 'fives', label: '5 (다섯)', section: 'upper', hint: '5의 눈 합' },
  { id: 'sixes', label: '6 (여섯)', section: 'upper', hint: '6의 눈 합' },
  { id: 'triple', label: '트리플', section: 'lower', hint: '같은 눈 3개+ · 전체 합' },
  { id: 'quad', label: '포카드', section: 'lower', hint: '같은 눈 4개+ · 전체 합' },
  { id: 'fullhouse', label: '풀하우스', section: 'lower', hint: '3개+2개 · 25점' },
  { id: 'small', label: '스몰 스트레이트', section: 'lower', hint: '4연속 · 30점' },
  { id: 'large', label: '라지 스트레이트', section: 'lower', hint: '5연속 · 40점' },
  { id: 'yacht', label: '요트', section: 'lower', hint: '5개 동일 · 50점' },
  { id: 'chance', label: '찬스', section: 'lower', hint: '전체 합' },
];

export function ytCategoryLabel(category: YTCategory | string): string {
  return YT_CATEGORIES.find((c) => c.id === category)?.label ?? '';
}

// 상단 카테고리 → 해당 눈
const YT_UPPER_FACE: Partial<Record<YTCategory, number>> = {
  ones: 1,
  twos: 2,
  threes: 3,
  fours: 4,
  fives: 5,
  sixes: 6,
};

// 현재 주사위로 해당 칸에 기록하면 받을 점수 — 미리보기 전용.
// 실제 점수는 서버(yt_score 처리)가 계산하므로 여기 값은 표시용이다.
export function computeYachtScore(
  category: YTCategory,
  dice: number[],
): number {
  // counts[1..6] = 각 눈 개수
  const counts = [0, 0, 0, 0, 0, 0, 0];
  let sum = 0;
  for (const d of dice) {
    if (d >= 1 && d <= 6) {
      counts[d] += 1;
      sum += d;
    }
  }

  const face = YT_UPPER_FACE[category];
  if (face !== undefined) return counts[face] * face;

  const hasCount = (n: number) => counts.some((c) => c >= n);
  const runOk = (start: number, len: number) => {
    for (let f = start; f < start + len; f += 1) {
      if (counts[f] === 0) return false;
    }
    return true;
  };

  switch (category) {
    case 'triple':
      return hasCount(3) ? sum : 0;
    case 'quad':
      return hasCount(4) ? sum : 0;
    case 'fullhouse': {
      // 정확히 3개 + 다른 눈 2개 (요트 5개는 요트 칸이 담당)
      const has3 = counts.some((c) => c === 3);
      const has2 = counts.some((c) => c === 2);
      return has3 && has2 ? 25 : 0;
    }
    case 'small':
      return runOk(1, 4) || runOk(2, 4) || runOk(3, 4) ? 30 : 0;
    case 'large':
      return runOk(1, 5) || runOk(2, 5) ? 40 : 0;
    case 'yacht':
      return hasCount(5) ? 50 : 0;
    case 'chance':
      return sum;
    default:
      return 0;
  }
}
