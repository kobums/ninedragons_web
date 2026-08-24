// 익스플로딩 키튼 메시지·상태 타입 — 와이어 계약(spec-kittens.md)과 1:1 대응.
// 메시지 타입명·payload 필드명은 백엔드와 공유하므로 변경 금지.
//
// 은닉 규칙: yourHand 는 본인 스냅샷에만 실리고 타인·관전자에게는 키 자체가
// 없다. 덱 내용·폭탄 위치는 어디에도 오지 않으며, 미래 예측 결과(ek_future)는
// 그 사람에게만 가는 개인 이벤트다.

// 카드 13종 — 기능 8종 + 고양이 5종.
// 고양이는 기능이 없고 같은 종류 2장으로만 쓴다(훔치기).
export type EKCard =
  | 'bomb'
  | 'defuse'
  | 'attack'
  | 'skip'
  | 'favor'
  | 'shuffle'
  | 'future'
  | 'nope'
  | 'taco'
  | 'rainbow'
  | 'beard'
  | 'potato'
  | 'melon';

export type EKPhase =
  | 'waiting'
  | 'turn'
  | 'nope_window'
  | 'favor_wait'
  | 'defuse_place'
  | 'game_over';

export type EKMessageType =
  // 클라 → 서버
  | 'ek_join_game'
  | 'ek_fill_bots'
  | 'ek_start'
  | 'ek_rejoin'
  | 'ek_play'
  | 'ek_play_pair'
  | 'ek_draw'
  | 'ek_nope'
  | 'ek_pass'
  | 'ek_give'
  | 'ek_defuse_place'
  | 'ek_react'
  // 서버 → 클라
  | 'ek_player_joined'
  | 'ek_spectate_joined'
  | 'ek_game_state'
  | 'ek_event'
  | 'ek_future'
  | 'ek_game_over'
  | 'ek_player_disconnected'
  | 'ek_player_reconnected'
  | 'ek_session_expired'
  | 'ek_error';

export interface EKMessage {
  type: EKMessageType;
  payload?: unknown;
}

// 내 손패 한 장 — 계약이 객체 배열이라 kind 만 꺼내 쓴다
export interface EKHandCard {
  kind: EKCard;
}

// 좌석 뷰 — 손패 "수"만 공개. 내용은 본인 yourHand 에만 있다.
export interface EKPlayerView {
  seat: number;
  name: string;
  connected: boolean;
  bot: boolean;
  handCount: number;
  // false 면 탈락 — 방을 나가지 않고 관전으로 전환된다
  alive: boolean;
}

// 아뇨 창의 대상 — 지금 판정을 기다리는 기능 카드 한 장.
// kind 는 서버가 카드 종류 문자열을 그대로 싣는다(고양이 짝은 'pair' 류가
// 올 수 있어 열린 문자열로 둔다).
export interface EKPending {
  kind: string;
  // 낸 사람 (아뇨가 겹치면 마지막으로 낸 사람)
  bySeat: number;
  // 대상이 있는 카드(호의·훔치기)면 대상 좌석, 없으면 -1
  targetSeat: number;
  // 지금까지 겹친 아뇨 장수 — 짝수면 원래 효과가 살아 있다
  nopeCount: number;
}

export interface EKLastAction {
  seat: number;
  name: string;
  message: string;
}

export interface EKResult {
  winnerSeat: number;
  winnerName: string;
  message?: string;
}

// 서버가 상태 변경마다 보내는 개인화 전체 스냅샷
export interface EKGameState {
  gameId: string;
  // 사설 방 코드 (공용 로비는 '' 또는 생략)
  roomCode?: string;
  phase: EKPhase;
  hostSeat: number;
  yourSeat: number;
  // 관전자 수 (생략 가능)
  spectators?: number;
  // 단계 마감 시각 (unixMillis, 없으면 0)
  endsAt: number;
  currentSeat: number;
  // attack 누적 — 지금 차례 주인이 연달아 가져야 하는 남은 차례 수
  turnsLeft: number;
  deckLeft: number;
  // 버린 더미 맨 위 ('' 이면 비어 있음)
  discardTop: '' | EKCard | string;
  // 아뇨 창 대상 (없으면 null)
  pending?: EKPending | null;
  // 본인 손패 — 타인·관전자에게는 키 자체가 없다
  yourHand?: EKHandCard[];
  players?: EKPlayerView[];
  lastAction?: EKLastAction | null;
  result?: EKResult | null;
}

// 이벤트 kind 는 서버가 추가할 수 있어 열린 문자열로 둔다.
export interface EKEvent {
  kind: string;
  seat?: number;
  name?: string;
  message?: string;
}

// ek_game_over 페이로드 — 종료 화면은 마지막 스냅샷으로 그리고
// 이 페이로드는 신호 + 승자 보조로만 쓴다.
export interface EKGameOverPayload {
  winnerSeat?: number;
  winnerName?: string;
  message?: string;
}

// 개인 이벤트 — 미래 예측(future)를 낸 사람에게만 덱 맨 위 3장이 온다
export interface EKFuturePayload {
  cards?: EKCard[];
}

// sessionStorage 키 — 값을 바꾸면 기존 재접속 세션이 끊기므로 불변
export const EK_SESSION_KEY = 'ek_session_id';

export const EK_MIN_PLAYERS = 2;
export const EK_MAX_PLAYERS = 5;
// ek_fill_bots 는 4인까지 채우고 즉시 시작한다
export const EK_BOT_FILL_TARGET = 4;

// 미래 예측로 보는 장수
export const EK_FUTURE_COUNT = 3;

// 카드 표현 — 외부 에셋 없이 이모지 + 색 블록으로 그린다.
// 이모지만으로는 구분이 어려우므로 한글 이름을 반드시 함께 보여주고,
// 색은 CSS 의 .kind-* 클래스가 --ek-card-color 로 주입한다.
export interface EKCardMeta {
  emoji: string;
  // 카드 앞면에 크게 쓰는 짧은 이름
  short: string;
  // 문장에 쓰는 정식 이름
  name: string;
  // 한 줄 효과 설명
  effect: string;
}

export const EK_CARDS: Record<EKCard, EKCardMeta> = {
  bomb: {
    emoji: '💣',
    short: '폭탄',
    name: '폭탄 고양이',
    effect: '해체 카드가 없으면 즉시 탈락',
  },
  defuse: {
    emoji: '🛡',
    short: '해체',
    name: '해체',
    effect: '폭탄을 막고 덱 아무 곳에 되꽂는다',
  },
  attack: {
    emoji: '⚔️',
    short: '공격',
    name: '공격',
    effect: '내 차례를 끝내고 다음 사람이 2번 (누적)',
  },
  skip: {
    emoji: '⏭',
    short: '건너뛰기',
    name: '건너뛰기',
    effect: '뽑지 않고 차례를 끝낸다',
  },
  favor: {
    emoji: '🙏',
    short: '호의',
    name: '호의',
    effect: '고른 상대가 카드 1장을 골라 준다',
  },
  shuffle: {
    emoji: '🔀',
    short: '섞기',
    name: '섞기',
    effect: '덱을 섞는다',
  },
  future: {
    emoji: '🔮',
    short: '미래',
    name: '미래 예측',
    effect: '덱 맨 위 3장을 나만 본다',
  },
  nope: {
    emoji: '🚫',
    short: '아뇨',
    name: '아뇨',
    effect: '남이 낸 기능 카드를 무효화한다',
  },
  taco: {
    emoji: '🌮',
    short: '타코',
    name: '타코냥이',
    effect: '같은 고양이 2장으로 카드 훔치기',
  },
  rainbow: {
    emoji: '🌈',
    short: '무지개',
    name: '무지개냥이',
    effect: '같은 고양이 2장으로 카드 훔치기',
  },
  beard: {
    emoji: '😼',
    short: '수염',
    name: '수염냥이',
    effect: '같은 고양이 2장으로 카드 훔치기',
  },
  potato: {
    emoji: '🥔',
    short: '털감자',
    name: '털감자냥이',
    effect: '같은 고양이 2장으로 카드 훔치기',
  },
  melon: {
    emoji: '🍉',
    short: '수박',
    name: '수박냥이',
    effect: '같은 고양이 2장으로 카드 훔치기',
  },
};

// 기능 없는 고양이 5종
export const EK_CAT_KINDS: readonly EKCard[] = [
  'taco',
  'rainbow',
  'beard',
  'potato',
  'melon',
];

// 자기 차례에 한 장으로 낼 수 있는 카드 (아뇨는 아뇨 창에서만,
// 폭탄·해체는 뽑기 처리에서 자동으로 쓰인다)
export const EK_SOLO_PLAYABLE: readonly EKCard[] = [
  'attack',
  'skip',
  'favor',
  'shuffle',
  'future',
];

// 서버가 모르는 문자열을 보내도 화면이 깨지지 않게 한다
export const ekIsCard = (kind: string): kind is EKCard => kind in EK_CARDS;

export const ekCardMeta = (kind: string): EKCardMeta =>
  ekIsCard(kind)
    ? EK_CARDS[kind]
    : { emoji: '❔', short: '카드', name: '카드', effect: '' };

export const ekIsCat = (kind: string): boolean =>
  EK_CAT_KINDS.includes(kind as EKCard);

export const ekIsSoloPlayable = (kind: string): boolean =>
  EK_SOLO_PLAYABLE.includes(kind as EKCard);

// 대상 좌석이 필요한 카드
export const ekNeedsTarget = (kind: string): boolean => kind === 'favor';

// 아뇨 겹침 판정 — 짝수(0 포함)면 원래 효과가 살아 있다
export const ekEffectAlive = (nopeCount: number): boolean =>
  (nopeCount ?? 0) % 2 === 0;

// 되꽂기 위치 라벨 — 0=맨 위 … len=맨 아래
export const ekPlaceLabel = (position: number, deckLeft: number): string => {
  if (position <= 0) return '맨 위';
  if (position >= deckLeft) return '맨 아래';
  return `위에서 ${position + 1}번째`;
};

// 한 장으로 낼 수 없는 이유 (없으면 null)
export const ekSoloBlockReason = (kind: string): string | null => {
  if (ekIsSoloPlayable(kind)) return null;
  if (kind === 'nope') return '아뇨는 아뇨 창에서만 낼 수 있습니다';
  if (kind === 'defuse') return '해체는 폭탄을 뽑을 때 자동으로 쓰입니다';
  if (kind === 'bomb') return '폭탄은 낼 수 없습니다';
  if (ekIsCat(kind)) return '고양이는 같은 종류 2장을 모아야 합니다';
  return '낼 수 없는 카드입니다';
};
