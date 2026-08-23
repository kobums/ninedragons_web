// 더 크루 메시지·상태 타입 — 와이어 계약(spec-crew.md)과 1:1 대응.
// 메시지 타입명·payload 필드명·카드 표기는 백엔드와 공유하므로 변경 금지.

// 색 무늬 4종 — 임무 카드는 반드시 이 중 하나다 (로켓은 임무가 되지 않는다)
export type CWColorSuit = 'blue' | 'green' | 'pink' | 'yellow';
// 로켓은 상시 트럼프 (1~4)
export type CWSuit = CWColorSuit | 'rocket';

// 색 무늬는 1~9, 로켓은 1~4
export interface CWCard {
  suit: CWSuit;
  rank: number;
}

// 소통 선언 — 그 색 안에서 이 카드의 위치. 반드시 진실이어야 하고 서버가 검증한다.
export type CWHint = 'highest' | 'lowest' | 'only';

export type CWPhase = 'waiting' | 'playing' | 'round_end' | 'game_over';

// '' = 아직 실패하지 않음
export type CWFailedReason = '' | 'wrong_winner' | 'out_of_cards';

export type CWMessageType =
  // 클라 → 서버
  | 'cw_join_game'
  | 'cw_fill_bots'
  | 'cw_start'
  | 'cw_rejoin'
  | 'cw_play'
  | 'cw_communicate'
  | 'cw_react'
  // 서버 → 클라
  | 'cw_player_joined'
  | 'cw_spectate_joined'
  | 'cw_game_state'
  | 'cw_event'
  | 'cw_game_over'
  | 'cw_player_disconnected'
  | 'cw_player_reconnected'
  | 'cw_session_expired'
  | 'cw_error';

export interface CWMessage {
  type: CWMessageType;
  payload?: unknown;
}

// 소통으로 공개된 카드 — 손에 남아 있고 전원이 계속 본다
export interface CWRevealed {
  card: CWCard;
  hint: CWHint;
}

export interface CWPlayerView {
  seat: number;
  name: string;
  connected: boolean;
  bot: boolean;
  // 남은 손패 장수 (내용은 본인만 안다)
  handCount: number;
  // 남은 소통 토큰 (라운드마다 1로 초기화 — 서버가 boolean 을 보내도 truthy 판정)
  tokenLeft: number;
  // 아직 소통하지 않았으면 null
  revealed?: CWRevealed | null;
}

// 임무 — 배정받은 좌석이 이 카드가 들어 있는 트릭을 이겨야 한다. 전원 공개.
export interface CWTask {
  suit: CWColorSuit;
  rank: number;
  seat: number;
  done: boolean;
}

export interface CWTrickCard {
  seat: number;
  card: CWCard;
}

export interface CWLastTrick {
  winnerSeat: number;
  cards: CWTrickCard[];
}

export interface CWResult {
  cleared: boolean;
  failedReason: CWFailedReason;
  // 실패했다면 실패한 라운드(난이도), 클리어했다면 마지막 라운드
  mission: number;
  message?: string;
}

// 서버가 상태 변경마다 보내는 개인화 전체 스냅샷 (은닉형 —
// yourHand 는 본인 스냅샷에만 오고 타인·관전자에게는 키 자체가 없다)
export interface CWGameState {
  gameId: string;
  // 사설 방 코드 (공용 로비는 '' 또는 생략)
  roomCode?: string;
  phase: CWPhase;
  hostSeat: number;
  // 관전자는 -1
  yourSeat: number;
  spectators?: number;
  // 단계 마감 시각 (unixMillis, 없으면 0) — 플레이 45초 / round_end 대기
  endsAt: number;
  // 현재 라운드 = 임무 개수 (1 ~ maxMission)
  mission: number;
  maxMission: number;
  // 로켓 4를 가진 좌석 — 라운드 첫 리드
  commanderSeat: number;
  currentSeat: number;
  // '' = 이번 트릭의 리드가 아직 없다
  leadSuit: '' | CWSuit;
  // 이번 트릭 진행분 (낸 순서)
  trick?: CWTrickCard[];
  // 전원 공개
  tasks?: CWTask[];
  // 본인만 (관전자·타인에게는 키 부재)
  yourHand?: CWCard[];
  players?: CWPlayerView[];
  lastTrick?: CWLastTrick | null;
  result?: CWResult | null;
}

// 이벤트 kind 는 서버가 추가할 수 있어 열린 문자열로 둔다.
export interface CWEvent {
  kind: string;
  seat?: number;
  name?: string;
  message?: string;
}

// cw_game_over 페이로드 — 종료 화면 자체는 마지막 스냅샷(phase 'game_over')으로
// 그리고, 이 페이로드는 신호+결과 보조로만 쓴다.
export interface CWGameOverPayload {
  cleared?: boolean;
  failedReason?: CWFailedReason;
  mission?: number;
  message?: string;
}

// sessionStorage 키 — 값을 바꾸면 기존 재접속 세션이 끊기므로 불변
export const CW_SESSION_KEY = 'cw_session_id';

export const CW_MIN_PLAYERS = 3;
export const CW_MAX_PLAYERS = 5;
// cw_fill_bots 는 4인까지 채우고 즉시 시작한다
export const CW_BOT_FILL_TARGET = 4;
// 서버 maxMission 이 없을 때의 폴백
export const CW_DEFAULT_MAX_MISSION = 5;

// 손패 정렬 순서 — 트럼프(로켓)를 맨 앞에 모아 한눈에 보이게 한다
export const CW_SUIT_ORDER: readonly CWSuit[] = [
  'rocket',
  'blue',
  'green',
  'pink',
  'yellow',
];

export const CW_COLOR_SUITS: readonly CWColorSuit[] = [
  'blue',
  'green',
  'pink',
  'yellow',
];

export const CW_SUIT_LABEL: Record<CWSuit, string> = {
  blue: '파랑',
  green: '초록',
  pink: '분홍',
  yellow: '노랑',
  rocket: '로켓',
};

// 색약 대비 — 색 외에 한 글자 마크로도 무늬를 구분할 수 있게 한다
export const CW_SUIT_MARK: Record<CWSuit, string> = {
  blue: '파',
  green: '초',
  pink: '분',
  yellow: '노',
  rocket: '🚀',
};

export const CW_HINT_LABEL: Record<CWHint, string> = {
  highest: '최고',
  lowest: '최저',
  only: '유일',
};

// 좌석 스트립·소통 pill 문구
export const CW_HINT_DESC: Record<CWHint, string> = {
  highest: '이 색에서 가장 큼',
  lowest: '이 색에서 가장 작음',
  only: '이 색은 이 한 장뿐',
};

export const CW_FAIL_TEXT: Record<Exclude<CWFailedReason, ''>, string> = {
  wrong_winner: '임무 카드를 담당자가 아닌 사람이 가져갔습니다',
  out_of_cards: '카드가 다 떨어졌는데 임무가 남았습니다',
};

export const cwCardKey = (card: CWCard): string => `${card.suit}-${card.rank}`;

export const cwSameCard = (a: CWCard, b: CWCard): boolean =>
  a.suit === b.suit && a.rank === b.rank;

// 손패를 화면용으로 정렬하되 서버 인덱스(cw_play 의 index)를 함께 들고 다닌다
export interface CWHandEntry {
  card: CWCard;
  index: number;
}

export const cwSortHand = (hand: CWCard[]): CWHandEntry[] =>
  hand
    .map((card, index) => ({ card, index }))
    .sort((a, b) => {
      const sa = CW_SUIT_ORDER.indexOf(a.card.suit);
      const sb = CW_SUIT_ORDER.indexOf(b.card.suit);
      if (sa !== sb) return sa - sb;
      return a.card.rank - b.card.rank;
    });

// 따라내기 의무 — 리드 색이 손에 있으면 그 색만 낼 수 있다.
// 서버가 최종 판정하지만, 낼 수 없는 카드를 미리 흐리게 하는 데 쓴다.
export const cwLegalIndexes = (
  hand: CWCard[],
  leadSuit: '' | CWSuit,
): Set<number> => {
  const all = new Set(hand.map((_, i) => i));
  if (leadSuit === '') return all;
  const follow = new Set(
    hand.map((c, i) => (c.suit === leadSuit ? i : -1)).filter((i) => i >= 0),
  );
  return follow.size > 0 ? follow : all;
};

// 소통 선언의 진실성 — 내 손패만으로 계산할 수 있다.
// 서버가 최종 검증하므로, 프론트는 명백히 거짓인 선택을 미리 잠그는 용도로만 쓴다.
export const cwHintTruthful = (
  hand: CWCard[],
  index: number,
  hint: CWHint,
): boolean => {
  const card = hand[index];
  // 로켓은 공개 불가
  if (!card || card.suit === 'rocket') return false;
  const same = hand.filter((c) => c.suit === card.suit);
  if (hint === 'only') return same.length === 1;
  if (hint === 'highest') return same.every((c) => c.rank <= card.rank);
  return same.every((c) => c.rank >= card.rank);
};

// 세 선언 중 하나라도 참이면 이 카드는 공개할 수 있다 (중간 숫자는 공개 불가)
export const cwCommunicable = (hand: CWCard[], index: number): boolean =>
  cwHintTruthful(hand, index, 'highest') ||
  cwHintTruthful(hand, index, 'lowest') ||
  cwHintTruthful(hand, index, 'only');
