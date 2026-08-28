// 뱅! 메시지·상태 타입 — 와이어 계약(spec-bang.md)과 1:1 대응.
// 메시지 타입명·payload 필드명·kind 값은 백엔드와 공유하므로 변경 금지.
//
// 용어 원칙: 와이어 값(bang·miss·beer …)은 영문 고정이고 화면 표기만
// 정식 한국어판 용어를 쓴다 — "미스"·"술집"·"개틀링" 같은 임의 표기 금지.
//   갈색 12종: 뱅! · 빗나감! · 맥주 · 주점 · 결투 · 기관총 · 인디언! ·
//              역마차 · 웰스파고 · 잡화점 · 캣 벌로우 · 강탈!
//   파란색 10종: 술통 · 감옥 · 다이너마이트 · 야생마 · 조준경 ·
//                스코필드 · 레밍턴 · 카빈 · 윈체스터 · 볼캐닉
//   역할 4종: 보안관 · 부관 · 무법자 · 배신자

// ---------- 카드 ----------

// 카드 종류 23종 — 와이어 값 고정
export type BGCardKind =
  | 'bang'
  | 'miss'
  | 'beer'
  | 'saloon'
  | 'duel'
  | 'gatling'
  | 'indians'
  | 'stagecoach'
  | 'wellsfargo'
  | 'store'
  | 'catbalou'
  | 'panic'
  | 'barrel'
  | 'jail'
  | 'dynamite'
  | 'mustang'
  | 'scope'
  | 'schofield'
  | 'remington'
  | 'carabine'
  | 'winchester'
  | 'volcanic';

// 갈색(즉시 사용) / 파란색(장비)
export type BGCardColor = 'brown' | 'blue';

// 카드 1장. suit·rank 는 "뒤집기"(술통·감옥·다이너마이트) 판정에 쓰이므로
// 화면에 반드시 보여야 한다.
export interface BGCard {
  id: number;
  kind: BGCardKind | string;
  // 서버가 '♠' 글리프로 줄 수도, 'S'/'spades' 로 줄 수도 있어 문자열로 받는다
  suit: string;
  // A · 2~10 · J · Q · K
  rank: string;
}

// ---------- 역할 ----------

export type BGRole = 'sheriff' | 'deputy' | 'outlaw' | 'renegade';

// ---------- 단계 ----------

export type BGPhase =
  | 'waiting'
  // ① 다이너마이트·감옥 판정 → ② 카드 2장 뽑기 (서버가 자동 진행)
  | 'draw'
  // ③ 원하는 만큼 카드 사용
  | 'turn'
  // 뱅!·기관총·인디언!·결투에 대한 대응 대기
  | 'respond'
  // 잡화점 — 공개된 카드를 차례로 1장씩 고른다
  | 'store_pick'
  // ④ 손패를 체력 수만큼으로 줄이기
  | 'discard'
  | 'game_over';

export type BGMessageType =
  // 클라 → 서버
  | 'bg_join_game'
  | 'bg_fill_bots'
  | 'bg_start'
  | 'bg_rejoin'
  | 'bg_play'
  | 'bg_respond'
  | 'bg_pick'
  | 'bg_discard'
  | 'bg_end_turn'
  | 'bg_react'
  // 서버 → 클라
  | 'bg_player_joined'
  | 'bg_spectate_joined'
  | 'bg_game_state'
  | 'bg_event'
  | 'bg_game_over'
  | 'bg_player_disconnected'
  | 'bg_player_reconnected'
  | 'bg_session_expired'
  | 'bg_error';

export interface BGMessage {
  type: BGMessageType;
  payload?: unknown;
}

// bg_play 페이로드 — 카드마다 쓰는 필드가 다르다
export interface BGPlayPayload {
  // 내 손패 인덱스
  index: number;
  // 뱅!·결투·캣 벌로우·강탈!·감옥 — 대상 좌석
  targetSeat?: number;
  // 캣 벌로우·강탈! — 대상의 카드 (손패는 0..handCount-1,
  // 장비는 handCount + 장비 인덱스로 이어 센다)
  targetCardIndex?: number;
}

// ---------- 스냅샷 ----------

// 지금 누가 무엇에 대응해야 하는지. targetSeat 이 음수면 "나머지 전원"
// (기관총·인디언!)이고, 0 이상이면 그 좌석 한 명만 대응한다.
export interface BGPending {
  // 대응을 유발한 카드 (bang · gatling · indians · duel)
  kind: BGCardKind | string;
  bySeat: number;
  targetSeat: number;
  // 내야 하는 카드 (뱅!에는 miss, 인디언!·결투에는 bang)
  need: BGCardKind | string;
  // 이미 포기했거나 처리가 끝난 좌석
  passed?: number[];
}

// 좌석 뷰 — 공개 정보만. 손패는 장수(handCount)로만 보인다.
export interface BGPlayerView {
  seat: number;
  name: string;
  connected: boolean;
  bot: boolean;
  alive: boolean;
  hp: number;
  maxHp: number;
  handCount: number;
  // 앞에 깔린 파란색 카드 (무기·술통·야생마·조준경·감옥·다이너마이트)
  equipment?: BGCard[];
  // 보안관은 시작부터 공개, 나머지는 사망 시 공개 (그 외에는 키가 없다)
  role?: BGRole | string;
  // 내 기준 거리 (탈락자 제외 + 야생마·조준경 보정 포함, 관전자는 -1)
  distanceFromYou?: number;
}

export interface BGLastAction {
  seat: number;
  name: string;
  message: string;
}

export interface BGResult {
  winner?: 'sheriff' | 'outlaw' | 'renegade' | string;
  winnerSeats?: number[];
  winnerNames?: string[];
  message?: string;
}

// 서버가 상태 변경마다 보내는 개인화 전체 스냅샷.
// yourRole·yourHand 는 본인 스냅샷에만 온다 — 타인·관전자에게는 키가 없다.
export interface BGGameState {
  gameId: string;
  // 사설 방 코드 (공용 로비는 '' 또는 생략)
  roomCode?: string;
  phase: BGPhase;
  hostSeat: number;
  yourSeat: number;
  spectators?: number;
  // 단계 마감 시각 (unixMillis, 없으면 0)
  endsAt: number;
  currentSeat: number;
  deckLeft: number;
  discardTop?: BGCard | null;
  pending?: BGPending | null;
  // 잡화점 공개분
  storeCards?: BGCard[];
  // 본인만
  yourRole?: BGRole | string;
  yourHand?: BGCard[];
  // 서버가 채워 주면 이 값을 쓰고, 없으면 화면이 로컬로 추적한다
  // (한 차례에 뱅! 1장 제한 판정용)
  yourBangUsed?: boolean;
  players?: BGPlayerView[];
  lastAction?: BGLastAction | null;
  result?: BGResult | null;
}

// 이벤트 kind 는 서버가 추가할 수 있어 열린 문자열로 둔다.
export interface BGEvent {
  kind: string;
  seat?: number;
  name?: string;
  message?: string;
}

export interface BGGameOverPayload {
  winner?: string;
  winnerSeats?: number[];
  winnerNames?: string[];
  message?: string;
}

// sessionStorage 키 — 값을 바꾸면 기존 재접속 세션이 끊기므로 불변
export const BG_SESSION_KEY = 'bg_session_id';

export const BG_MIN_PLAYERS = 4;
export const BG_MAX_PLAYERS = 7;
// bg_fill_bots 는 5인까지 채우고 즉시 시작한다
export const BG_BOT_FILL_TARGET = 5;

// AFK 제한 (안내 문구용 — 실제 판정은 서버 endsAt)
export const BG_TURN_SECONDS = 60;
export const BG_RESPOND_SECONDS = 20;
export const BG_STORE_SECONDS = 15;
export const BG_DISCARD_SECONDS = 15;

// 무기를 들지 않았을 때의 사거리
export const BG_BASE_RANGE = 1;
// 강탈!은 거리 1 이내만 노릴 수 있다
export const BG_PANIC_RANGE = 1;
// 맥주는 2인만 남으면 효과가 없다
export const BG_BEER_DEAD_PLAYERS = 2;

// ---------- 역할 4종 ----------

export const BG_ROLES: readonly BGRole[] = [
  'sheriff',
  'deputy',
  'outlaw',
  'renegade',
];

// 정식 한국어판 표기 — 직역·음차로 바꾸지 않는다
export const BG_ROLE_NAME: Record<BGRole, string> = {
  sheriff: '보안관',
  deputy: '부관',
  outlaw: '무법자',
  renegade: '배신자',
};

export const BG_ROLE_ICON: Record<BGRole, string> = {
  sheriff: '⭐',
  deputy: '🎖️',
  outlaw: '🐺',
  renegade: '🃏',
};

export const BG_ROLE_GOAL: Record<BGRole, string> = {
  sheriff: '무법자 전원과 배신자를 모두 제거하세요 (정체 공개 · 체력 +1)',
  deputy: '보안관을 지켜 보안관이 이기게 하세요 (정체 비공개)',
  outlaw: '보안관을 제거하세요 (정체 비공개)',
  renegade: '마지막까지 혼자 살아남으세요 (정체 비공개)',
};

// 같은 편끼리 색을 묶는다 — 보안관·부관 / 무법자 / 배신자
export const BG_ROLE_SIDE: Record<BGRole, 'law' | 'outlaw' | 'renegade'> = {
  sheriff: 'law',
  deputy: 'law',
  outlaw: 'outlaw',
  renegade: 'renegade',
};

export function bgRoleName(role: BGRole | string | undefined): string {
  if (!role) return '비공개';
  return BG_ROLE_NAME[role as BGRole] ?? '비공개';
}

export function bgRoleIcon(role: BGRole | string | undefined): string {
  if (!role) return '🎴';
  return BG_ROLE_ICON[role as BGRole] ?? '🎴';
}

// 인원별 역할 구성 (대기실 안내용)
export const BG_ROLE_SETUP: Record<number, string> = {
  4: '보안관 1 · 무법자 2 · 배신자 1',
  5: '보안관 1 · 부관 1 · 무법자 2 · 배신자 1',
  6: '보안관 1 · 부관 1 · 무법자 3 · 배신자 1',
  7: '보안관 1 · 부관 2 · 무법자 3 · 배신자 1',
};

// 승리 진영 문구
export const BG_WINNER_LABEL: Record<string, string> = {
  sheriff: '⭐ 보안관·부관 승리',
  outlaw: '🐺 무법자 승리',
  renegade: '🃏 배신자 승리',
};

// ---------- 카드 효과 표 ----------
// 카드 종류가 많은 게임이라 이름·아이콘·색·효과·대상 규칙을 한 표에 모은다.
// 화면(손패·장비·대응 창·잡화점·범례)은 전부 이 표만 읽는다.

// 대상 선택 규칙
export type BGTargetRule =
  // 대상 없음 (자신에게 쓰거나 전원에게 적용)
  | 'none'
  // 사거리 안 1명 (뱅!)
  | 'range'
  // 거리 무관 1명 (결투·캣 벌로우·감옥)
  | 'any'
  // 거리 1 이내 1명 (강탈!)
  | 'near';

export interface BGCardInfo {
  name: string;
  icon: string;
  color: BGCardColor;
  // 기본판 장수
  count: number;
  // 한 줄 효과
  desc: string;
  rule: BGTargetRule;
  // 대상의 카드 1장까지 골라야 하는가 (캣 벌로우·강탈!)
  needsCard?: boolean;
  // 무기 사거리 (무기가 아니면 없음)
  range?: number;
}

export const BG_CARD_INFO: Record<BGCardKind, BGCardInfo> = {
  bang: {
    name: '뱅!',
    icon: '💥',
    color: 'brown',
    count: 25,
    desc: '사거리 안 1명을 쏩니다. 상대가 빗나감!을 내지 못하면 체력 −1. 한 차례에 1장(볼캐닉은 무제한)',
    rule: 'range',
  },
  miss: {
    name: '빗나감!',
    icon: '💨',
    color: 'brown',
    count: 12,
    desc: '나를 향한 뱅!을 무효로 만듭니다 (대응 창에서만 냅니다)',
    rule: 'none',
  },
  beer: {
    name: '맥주',
    icon: '🍺',
    color: 'brown',
    count: 6,
    desc: '체력 +1 (최대치까지). 2명만 남으면 효과가 없습니다',
    rule: 'none',
  },
  saloon: {
    name: '주점',
    icon: '🍻',
    color: 'brown',
    count: 1,
    desc: '자신을 제외한 전원의 체력 +1',
    rule: 'none',
  },
  duel: {
    name: '결투',
    icon: '⚔️',
    color: 'brown',
    count: 3,
    desc: '거리 무관 1명과 뱅!을 번갈아 냅니다. 먼저 못 내는 쪽이 체력 −1',
    rule: 'any',
  },
  gatling: {
    name: '기관총',
    icon: '🔥',
    color: 'brown',
    count: 1,
    desc: '나머지 전원에게 뱅! (각자 빗나감!으로 막습니다)',
    rule: 'none',
  },
  indians: {
    name: '인디언!',
    icon: '🏹',
    color: 'brown',
    count: 2,
    desc: '나머지 전원이 뱅! 1장을 버리거나 체력 −1',
    rule: 'none',
  },
  stagecoach: {
    name: '역마차',
    icon: '🚚',
    color: 'brown',
    count: 2,
    desc: '카드 2장을 뽑습니다',
    rule: 'none',
  },
  wellsfargo: {
    name: '웰스파고',
    icon: '📮',
    color: 'brown',
    count: 1,
    desc: '카드 3장을 뽑습니다',
    rule: 'none',
  },
  store: {
    name: '잡화점',
    icon: '🏪',
    color: 'brown',
    count: 2,
    desc: '인원수만큼 카드를 공개해 차례로 1장씩 가져갑니다',
    rule: 'none',
  },
  catbalou: {
    name: '캣 벌로우',
    icon: '🐈',
    color: 'brown',
    count: 4,
    desc: '거리 무관 1명의 카드 1장을 버리게 합니다',
    rule: 'any',
    needsCard: true,
  },
  panic: {
    name: '강탈!',
    icon: '✋',
    color: 'brown',
    count: 4,
    desc: '거리 1 이내 1명의 카드 1장을 뺏습니다',
    rule: 'near',
    needsCard: true,
  },
  barrel: {
    name: '술통',
    icon: '🛢️',
    color: 'blue',
    count: 2,
    desc: '뱅!을 받을 때 카드 1장을 뒤집어 ♥면 회피합니다',
    rule: 'none',
  },
  jail: {
    name: '감옥',
    icon: '⛓️',
    color: 'blue',
    count: 3,
    desc: '남에게 걸어 둡니다. 그 사람 차례에 뒤집어 ♥면 탈출, 아니면 차례를 통째로 건너뜁니다',
    rule: 'any',
  },
  dynamite: {
    name: '다이너마이트',
    icon: '🧨',
    color: 'blue',
    count: 1,
    desc: '내 차례 시작에 뒤집어 ♠2~9면 체력 −3, 아니면 왼쪽 사람에게 넘어갑니다',
    rule: 'none',
  },
  mustang: {
    name: '야생마',
    icon: '🐎',
    color: 'blue',
    count: 2,
    desc: '남이 나를 볼 때 거리 +1',
    rule: 'none',
  },
  scope: {
    name: '조준경',
    icon: '🔭',
    color: 'blue',
    count: 1,
    desc: '내가 남을 볼 때 거리 −1',
    rule: 'none',
  },
  schofield: {
    name: '스코필드',
    icon: '🔫',
    color: 'blue',
    count: 3,
    desc: '무기 · 사거리 2',
    rule: 'none',
    range: 2,
  },
  remington: {
    name: '레밍턴',
    icon: '🔫',
    color: 'blue',
    count: 1,
    desc: '무기 · 사거리 3',
    rule: 'none',
    range: 3,
  },
  carabine: {
    name: '카빈',
    icon: '🔫',
    color: 'blue',
    count: 1,
    desc: '무기 · 사거리 4',
    rule: 'none',
    range: 4,
  },
  winchester: {
    name: '윈체스터',
    icon: '🔫',
    color: 'blue',
    count: 1,
    desc: '무기 · 사거리 5',
    rule: 'none',
    range: 5,
  },
  volcanic: {
    name: '볼캐닉',
    icon: '🌋',
    color: 'blue',
    count: 2,
    desc: '무기 · 사거리 1 · 한 차례에 뱅!을 무제한으로 낼 수 있습니다',
    rule: 'none',
    range: 1,
  },
};

// 갈색 12종 · 파란색 10종 (대기실 범례 순서)
export const BG_BROWN_KINDS: readonly BGCardKind[] = [
  'bang',
  'miss',
  'beer',
  'saloon',
  'duel',
  'gatling',
  'indians',
  'stagecoach',
  'wellsfargo',
  'store',
  'catbalou',
  'panic',
];

export const BG_BLUE_KINDS: readonly BGCardKind[] = [
  'barrel',
  'jail',
  'dynamite',
  'mustang',
  'scope',
  'schofield',
  'remington',
  'carabine',
  'winchester',
  'volcanic',
];

// 알 수 없는 kind 가 와도 화면이 깨지지 않게 방어한다
const BG_UNKNOWN_CARD: BGCardInfo = {
  name: '알 수 없는 카드',
  icon: '🎴',
  color: 'brown',
  count: 0,
  desc: '',
  rule: 'none',
};

export function bgCardInfo(kind: BGCardKind | string): BGCardInfo {
  return BG_CARD_INFO[kind as BGCardKind] ?? BG_UNKNOWN_CARD;
}

export function bgCardName(kind: BGCardKind | string): string {
  return bgCardInfo(kind).name;
}

export function bgCardIcon(kind: BGCardKind | string): string {
  return bgCardInfo(kind).icon;
}

export function bgCardColor(kind: BGCardKind | string): BGCardColor {
  return bgCardInfo(kind).color;
}

export const BG_COLOR_LABEL: Record<BGCardColor, string> = {
  brown: '갈색 · 즉시 사용',
  blue: '파란색 · 장비',
};

// ---------- 무늬·숫자 ----------
// "뒤집기"(술통·감옥·다이너마이트)는 무늬와 숫자를 보고 판정하므로
// 화면에 반드시 보여야 한다. 서버 표기가 글리프든 약자든 받아 준다.

export type BGSuit = '♠' | '♥' | '♦' | '♣';

const SUIT_ALIAS: Record<string, BGSuit> = {
  '♠': '♠',
  '♥': '♥',
  '♦': '♦',
  '♣': '♣',
  S: '♠',
  H: '♥',
  D: '♦',
  C: '♣',
  s: '♠',
  h: '♥',
  d: '♦',
  c: '♣',
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
};

export function bgSuitSymbol(suit: string | undefined): string {
  if (!suit) return '?';
  return SUIT_ALIAS[suit] ?? SUIT_ALIAS[suit.toLowerCase()] ?? suit;
}

// ♥·♦ 는 빨강, ♠·♣ 는 검정 — 술통 판정(♥)이 한눈에 보이도록
export function bgSuitIsRed(suit: string | undefined): boolean {
  const s = bgSuitSymbol(suit);
  return s === '♥' || s === '♦';
}

export const BG_SUIT_NAME: Record<string, string> = {
  '♠': '스페이드',
  '♥': '하트',
  '♦': '다이아',
  '♣': '클로버',
};

export function bgSuitName(suit: string | undefined): string {
  const s = bgSuitSymbol(suit);
  return BG_SUIT_NAME[s] ?? s;
}

export function bgRankLabel(rank: string | undefined): string {
  return rank && rank.length > 0 ? rank : '?';
}

// "♥ K" — 스크린리더·툴팁용 한 줄
export function bgCardFace(card: BGCard): string {
  return `${bgSuitSymbol(card.suit)}${bgRankLabel(card.rank)}`;
}

export function bgCardLabel(card: BGCard): string {
  return `${bgCardName(card.kind)} · ${bgSuitName(card.suit)} ${bgRankLabel(card.rank)}`;
}

// ---------- 장비 ----------

export function bgEquipOf(
  equipment: BGCard[] | undefined,
  kind: BGCardKind,
): BGCard | null {
  return (equipment ?? []).find((c) => c.kind === kind) ?? null;
}

export function bgHasEquip(
  equipment: BGCard[] | undefined,
  kind: BGCardKind,
): boolean {
  return bgEquipOf(equipment, kind) !== null;
}

// 앞에 깔린 무기 (없으면 null = 기본 사거리 1)
export function bgWeaponOf(equipment: BGCard[] | undefined): BGCard | null {
  return (
    (equipment ?? []).find(
      (c) => bgCardInfo(c.kind).range !== undefined,
    ) ?? null
  );
}

export function bgWeaponRange(equipment: BGCard[] | undefined): number {
  const weapon = bgWeaponOf(equipment);
  if (!weapon) return BG_BASE_RANGE;
  return bgCardInfo(weapon.kind).range ?? BG_BASE_RANGE;
}

// 무기 이름 — 없으면 "맨손"
export function bgWeaponName(equipment: BGCard[] | undefined): string {
  const weapon = bgWeaponOf(equipment);
  return weapon ? bgCardName(weapon.kind) : '기본 무기';
}

// 볼캐닉을 들면 한 차례에 뱅!을 무제한으로 낼 수 있다
export function bgUnlimitedBang(equipment: BGCard[] | undefined): boolean {
  return bgHasEquip(equipment, 'volcanic');
}

// ---------- 거리·대상 판정 ----------
// 이 게임에서 가장 자주 묻는 질문은 "저 사람을 지금 쏠 수 있나, 없다면 왜
// 못 쏘나" 다. 좌석 카드·손패·대상 패널이 같은 답을 쓰도록 여기 한 곳에 모은다.

export interface BGTargetCheck {
  ok: boolean;
  // 못 고르는 이유 (또는 고를 수 있을 때의 한 줄 확인)
  reason: string;
}

// 거리 표시 문구 — 관전자·나 자신·탈락자는 숫자가 없다
export function bgDistanceLabel(
  target: BGPlayerView,
  mySeat: number,
): string {
  if (target.seat === mySeat) return '나';
  if (!target.alive) return '탈락';
  const d = target.distanceFromYou;
  if (d === undefined || d < 0) return '—';
  return `거리 ${d}`;
}

export interface BGShootContext {
  // 내 좌석 (관전자는 -1)
  mySeat: number;
  // 내 무기 사거리
  range: number;
  // 이번 차례에 이미 뱅!을 썼는가
  bangUsed: boolean;
  // 볼캐닉 장비 여부 (뱅! 무제한)
  unlimited: boolean;
  // 지금이 내 차례인가
  isMyTurn: boolean;
}

// 뱅!을 이 좌석에 쏠 수 있는가 — 못 쏘면 사유를 그대로 화면에 띄운다
export function bgBangCheck(
  target: BGPlayerView,
  ctx: BGShootContext,
): BGTargetCheck {
  if (ctx.mySeat < 0) {
    return { ok: false, reason: '관전 중 — 행동할 수 없습니다' };
  }
  if (target.seat === ctx.mySeat) {
    return { ok: false, reason: '자기 자신은 쏠 수 없습니다' };
  }
  if (!target.alive) {
    return { ok: false, reason: '이미 탈락한 사람입니다' };
  }
  if (!ctx.isMyTurn) {
    return { ok: false, reason: '내 차례가 아닙니다' };
  }
  if (ctx.bangUsed && !ctx.unlimited) {
    return { ok: false, reason: '이번 차례에 이미 뱅!을 썼습니다' };
  }
  const d = target.distanceFromYou;
  if (d === undefined || d < 0) {
    return { ok: false, reason: '거리를 알 수 없습니다' };
  }
  if (d > ctx.range) {
    return {
      ok: false,
      reason: `거리 ${d} — 내 무기 사거리 ${ctx.range} 밖`,
    };
  }
  return { ok: true, reason: `거리 ${d} ≤ 사거리 ${ctx.range} — 쏠 수 있습니다` };
}

// 강탈!·캣 벌로우·결투·감옥의 대상 판정
export function bgTargetCheck(
  kind: BGCardKind | string,
  target: BGPlayerView,
  mySeat: number,
): BGTargetCheck {
  const info = bgCardInfo(kind);
  if (mySeat < 0) {
    return { ok: false, reason: '관전 중 — 행동할 수 없습니다' };
  }
  if (!target.alive) {
    return { ok: false, reason: '이미 탈락한 사람입니다' };
  }
  if (target.seat === mySeat) {
    return { ok: false, reason: '자기 자신은 고를 수 없습니다' };
  }

  const d = target.distanceFromYou ?? -1;

  if (info.rule === 'near') {
    if (d < 0) return { ok: false, reason: '거리를 알 수 없습니다' };
    if (d > BG_PANIC_RANGE) {
      return {
        ok: false,
        reason: `거리 ${d} — 강탈!은 거리 ${BG_PANIC_RANGE} 이내만 노릴 수 있습니다`,
      };
    }
  }

  if (info.needsCard) {
    const cards = target.handCount + (target.equipment ?? []).length;
    if (cards <= 0) {
      return { ok: false, reason: '가진 카드가 없습니다' };
    }
  }

  if (kind === 'jail') {
    if (bgHasEquip(target.equipment, 'jail')) {
      return { ok: false, reason: '이미 감옥에 갇혀 있습니다' };
    }
    return { ok: true, reason: '차례를 건너뛰게 걸어 둡니다' };
  }

  if (kind === 'duel') {
    return { ok: true, reason: '거리 무관 — 뱅!을 번갈아 냅니다' };
  }

  if (info.rule === 'near') {
    return { ok: true, reason: `거리 ${d} — 카드 1장을 뺏습니다` };
  }

  return { ok: true, reason: '거리 무관 — 카드 1장을 버리게 합니다' };
}

// 손패의 이 카드를 지금 낼 수 있는가 (차례 중 판정)
export interface BGPlayContext extends BGShootContext {
  hp: number;
  maxHp: number;
  alivePlayers: number;
  // 이미 앞에 깔아 둔 장비
  equipment: BGCard[];
  // 사거리 안에 쏠 수 있는 상대가 있는가
  hasBangTarget: boolean;
  // 거리 1 이내에 상대가 있는가 (강탈!)
  hasNearTarget: boolean;
  // 나 말고 살아 있는 상대가 있는가
  hasOtherTarget: boolean;
}

export function bgPlayCheck(
  card: BGCard,
  ctx: BGPlayContext,
): BGTargetCheck {
  const info = bgCardInfo(card.kind);

  if (!ctx.isMyTurn) {
    return { ok: false, reason: '내 차례가 아닙니다' };
  }

  switch (card.kind) {
    case 'bang': {
      if (ctx.bangUsed && !ctx.unlimited) {
        return { ok: false, reason: '이번 차례에 이미 뱅!을 썼습니다' };
      }
      if (!ctx.hasBangTarget) {
        return {
          ok: false,
          reason: `사거리 ${ctx.range} 안에 쏠 수 있는 상대가 없습니다`,
        };
      }
      return { ok: true, reason: `사거리 ${ctx.range} 안의 상대를 고르세요` };
    }
    case 'miss':
      return {
        ok: false,
        reason: '뱅!을 받았을 때 대응 창에서만 낼 수 있습니다',
      };
    case 'beer': {
      if (ctx.alivePlayers <= BG_BEER_DEAD_PLAYERS) {
        return { ok: false, reason: '2명만 남아 맥주는 효과가 없습니다' };
      }
      if (ctx.hp >= ctx.maxHp) {
        return { ok: false, reason: `체력이 이미 최대(${ctx.maxHp})입니다` };
      }
      return { ok: true, reason: `체력 ${ctx.hp} → ${ctx.hp + 1}` };
    }
    case 'duel':
    case 'catbalou':
    case 'panic':
    case 'jail': {
      if (!ctx.hasOtherTarget) {
        return { ok: false, reason: '고를 수 있는 상대가 없습니다' };
      }
      if (card.kind === 'panic' && !ctx.hasNearTarget) {
        return {
          ok: false,
          reason: `거리 ${BG_PANIC_RANGE} 이내에 상대가 없습니다`,
        };
      }
      return { ok: true, reason: '대상을 고르세요' };
    }
    default:
      break;
  }

  // 파란색 장비 — 같은 장비를 두 번 깔 수 없다
  if (info.color === 'blue') {
    if (bgHasEquip(ctx.equipment, card.kind as BGCardKind)) {
      return { ok: false, reason: '이미 같은 장비를 깔아 뒀습니다' };
    }
    if (info.range !== undefined) {
      const now = bgWeaponRange(ctx.equipment);
      return {
        ok: true,
        reason: `무기 교체 — 사거리 ${now} → ${info.range}`,
      };
    }
    return { ok: true, reason: '내 앞에 깔아 둡니다' };
  }

  return { ok: true, reason: info.desc };
}

// ---------- 대응 창 ----------

// 이 스냅샷에서 내가 대응해야 하는가
export function bgMustRespond(
  pending: BGPending | null | undefined,
  phase: BGPhase,
  mySeat: number,
  alive: boolean,
): boolean {
  if (!pending || phase !== 'respond' || mySeat < 0 || !alive) return false;
  if ((pending.passed ?? []).includes(mySeat)) return false;
  // 대상이 지정된 대응(뱅!·결투)은 그 좌석만
  if (pending.targetSeat >= 0) return pending.targetSeat === mySeat;
  // 기관총·인디언!은 시전자를 뺀 전원
  return pending.bySeat !== mySeat;
}

// 대응 창 제목 — "누가 무엇을 했는지"
export function bgPendingTitle(
  pending: BGPending,
  byName: string,
  targetName: string,
): string {
  const card = bgCardName(pending.kind);
  const icon = bgCardIcon(pending.kind);
  if (pending.kind === 'gatling' || pending.kind === 'indians') {
    return `${icon} ${byName}님이 ${card}을(를) 썼습니다 — 나머지 전원 대응`;
  }
  if (pending.kind === 'duel') {
    return `${icon} ${byName}님이 ${targetName}님에게 ${card}을(를) 걸었습니다`;
  }
  return `${icon} ${byName}님이 ${targetName}님에게 ${card}을(를) 쐈습니다`;
}

// 대응 창 안내 — "무엇을 내야 하고, 못 내면 어떻게 되는지"
export function bgPendingDemand(pending: BGPending): string {
  const need = bgCardName(pending.need);
  if (pending.kind === 'indians') {
    return `${need} 1장을 버리지 않으면 체력 −1`;
  }
  if (pending.kind === 'duel') {
    return `${need} 1장을 내지 못하면 체력 −1`;
  }
  return `${need} 1장을 내지 않으면 체력 −1`;
}

// 손패 줄이기 — 체력 수를 넘긴 만큼 버려야 한다
export function bgDiscardNeed(handCount: number, hp: number): number {
  return Math.max(0, handCount - Math.max(0, hp));
}
