// 스컬킹 메시지·상태 타입 — 와이어 계약(spec-skullking.md)과 1:1 대응.
// 메시지 타입명·payload 필드명은 백엔드와 공유하므로 변경 금지.
// prefix 는 kg (sk 는 기존 게임 스컬이 이미 쓴다).

// 숫자 카드 4색. 검정(해적기)은 상시 트럼프.
// '' 는 특수 카드(무늬 없음) 또는 리드 무늬 미정 상태를 뜻한다.
export type KGSuit = '' | 'green' | 'yellow' | 'purple' | 'black';

// 카드 종류 — 숫자 + 특수 4종
export type KGCardKind =
  | 'number'
  | 'escape'
  | 'pirate'
  | 'mermaid'
  | 'skullking';

// 카드 1장. 숫자 카드만 suit·rank(1~13)가 의미를 갖고,
// 특수 카드는 suit '' · rank 0 으로 온다.
export interface KGCard {
  kind: KGCardKind;
  suit: KGSuit;
  rank: number;
}

export type KGPhase =
  | 'waiting'
  | 'bidding'
  | 'playing'
  | 'round_end'
  | 'game_over';

export type KGMessageType =
  // 클라 → 서버
  | 'kg_join_game'
  | 'kg_fill_bots'
  | 'kg_start'
  | 'kg_rejoin'
  | 'kg_bid'
  | 'kg_play'
  | 'kg_react'
  // 서버 → 클라
  | 'kg_player_joined'
  | 'kg_spectate_joined'
  | 'kg_game_state'
  | 'kg_event'
  | 'kg_game_over'
  | 'kg_player_disconnected'
  | 'kg_player_reconnected'
  | 'kg_session_expired'
  | 'kg_error';

export interface KGMessage {
  type: KGMessageType;
  payload?: unknown;
}

// 트릭에 놓인 카드 1장 (누가 냈는지 포함)
export interface KGTrickCard {
  seat: number;
  card: KGCard;
}

// 좌석 뷰 — 전원 공개 정보만 담는다.
// bid 는 비딩 중 전원 -1 이고 공개 후 실제 값이 채워진다.
export interface KGPlayerView {
  seat: number;
  name: string;
  connected: boolean;
  bot: boolean;
  // 비드 공개 전 -1
  bid: number;
  // 이번 라운드에 가져간 트릭 수
  tricks: number;
  // 누적 총점
  score: number;
  // 남은 손패 장수
  handCount: number;
  // 비드를 제출했는지 (값은 공개 전까지 숨김)
  bidSubmitted: boolean;
}

// 직전 트릭 — 승자 연출용
export interface KGLastTrick {
  winnerSeat: number;
  cards: KGTrickCard[];
}

// 라운드 정산 표 한 줄
export interface KGRoundRow {
  seat: number;
  bid: number;
  tricks: number;
  // 이번 라운드 증감 (보너스 포함)
  delta: number;
  // 정산 후 누계
  total: number;
}

export interface KGRoundResult {
  rows: KGRoundRow[];
  message?: string;
}

// 서버가 상태 변경마다 보내는 개인화 전체 스냅샷 (은닉형 —
// yourHand·yourBid 는 본인 스냅샷에만 오고 타인·관전자에게는 키 자체가 없다)
export interface KGGameState {
  gameId: string;
  // 사설 방 코드 (공용 로비는 '' 또는 생략)
  roomCode?: string;
  phase: KGPhase;
  hostSeat: number;
  yourSeat: number;
  // 관전자 수 (생략 가능)
  spectators?: number;
  // 단계 마감 시각 (unixMillis, 없으면 0) — 비드 AFK 45초 등
  endsAt: number;
  // 1 ~ maxRound
  round: number;
  // 인원별 최대 라운드 = min(10, 66/인원)
  maxRound: number;
  // 플레이 단계의 차례 좌석 (비딩 중엔 의미 없음)
  currentSeat: number;
  // 이번 트릭의 리드 무늬 — 첫 숫자 카드가 정한다 ('' = 아직 미정)
  leadSuit: KGSuit;
  // 이번 트릭 진행분
  trick?: KGTrickCard[];
  // 본인 손패 (관전자·타인은 키 부재)
  yourHand?: KGCard[];
  // 본인 비드 (미제출 -1, 관전자는 키 부재)
  yourBid?: number;
  players?: KGPlayerView[];
  lastTrick?: KGLastTrick | null;
  roundResult?: KGRoundResult | null;
}

// 이벤트 kind 는 서버가 추가할 수 있어 열린 문자열로 둔다.
export interface KGEvent {
  kind: string;
  seat?: number;
  name?: string;
  message?: string;
}

// kg_game_over 페이로드 — 종료 화면 자체는 마지막 스냅샷(phase 'game_over',
// 총점 확정)으로 그리고, 이 페이로드는 신호+승자 보조로만 쓴다.
export interface KGGameOverPayload {
  // 단독 승자 (동점 공동 우승이면 winnerSeats 가 온다)
  winnerSeat?: number;
  winnerSeats?: number[];
  message?: string;
}

// sessionStorage 키 — 값을 바꾸면 기존 재접속 세션이 끊기므로 불변
export const KG_SESSION_KEY = 'kg_session_id';

export const KG_MIN_PLAYERS = 2;
export const KG_MAX_PLAYERS = 8;
// kg_fill_bots 는 5인까지 채우고 즉시 시작한다
export const KG_BOT_FILL_TARGET = 5;
// 정식 라운드 수 상한 (인원이 많으면 덱이 모자라 줄어든다)
export const KG_TOTAL_ROUNDS = 10;
// 덱 66장 = 숫자 52 + 특수 14
export const KG_DECK_SIZE = 66;

// 인원별 최대 라운드 — r라운드에 각자 r장이므로 인원×라운드 ≤ 66.
// 서버 maxRound 가 비어 있을 때의 안내용 폴백.
export const kgMaxRound = (players: number): number =>
  players <= 0
    ? KG_TOTAL_ROUNDS
    : Math.max(1, Math.min(KG_TOTAL_ROUNDS, Math.floor(KG_DECK_SIZE / players)));

export const KG_SUIT_LABEL: Record<Exclude<KGSuit, ''>, string> = {
  green: '초록',
  yellow: '노랑',
  purple: '보라',
  black: '검정',
};

// 무늬 아이콘 — 앵무새·지도·보물상자·해골(해적기).
// 해적 카드(🏴‍☠️)와 헷갈리지 않게 검정 무늬는 ☠ 로 구분한다.
export const KG_SUIT_ICON: Record<Exclude<KGSuit, ''>, string> = {
  green: '🦜',
  yellow: '🗺',
  purple: '💰',
  black: '☠',
};

export const KG_SPECIAL_LABEL: Record<Exclude<KGCardKind, 'number'>, string> = {
  escape: '탈출',
  pirate: '해적',
  mermaid: '인어',
  skullking: '스컬킹',
};

export const KG_SPECIAL_ICON: Record<Exclude<KGCardKind, 'number'>, string> = {
  escape: '🏳️',
  pirate: '🏴‍☠️',
  mermaid: '🧜‍♀️',
  skullking: '💀',
};

// 카드 한 줄 표기 — 툴팁·정산 문구용
export const kgCardLabel = (card: KGCard): string =>
  card.kind === 'number'
    ? `${KG_SUIT_LABEL[card.suit as Exclude<KGSuit, ''>] ?? ''} ${card.rank}`.trim()
    : KG_SPECIAL_LABEL[card.kind];

// 따라내기 의무 — 리드 무늬 숫자 카드를 가졌으면 그 무늬 또는 특수 카드만.
// 판정은 서버가 하고 이건 보조 필터일 뿐이다 (흐림 처리 + 이유 툴팁용).
export const kgPlayableFlags = (
  hand: KGCard[],
  leadSuit: KGSuit,
): boolean[] => {
  if (!leadSuit) return hand.map(() => true);
  const hasLead = hand.some((c) => c.kind === 'number' && c.suit === leadSuit);
  if (!hasLead) return hand.map(() => true);
  return hand.map((c) => c.kind !== 'number' || c.suit === leadSuit);
};

// 점수 미리보기 문구 — 비드 버튼 아래 안내에 쓴다
export const kgBidHint = (bid: number, round: number): string =>
  bid === 0
    ? `성공 +${10 * round} · 실패 −${10 * round}`
    : `성공 +${20 * bid} · 1개 어긋날 때마다 −10`;
