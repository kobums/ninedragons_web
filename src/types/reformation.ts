// 쿠: 리포메이션(Coup: Reformation) 메시지·상태 타입 — 와이어 계약
// (spec-reformation.md)과 1:1 대응. 메시지 타입명·payload 필드명은 백엔드와
// 공유하므로 변경 금지. 쿠(cp)의 확장판이지만 접두사 rf 로 완전히 독립이다.

export type RFPhase =
  | 'waiting'
  | 'action'
  | 'challenge_window'
  | 'block_window'
  | 'lose_card'
  | 'exchange'
  | 'game_over';

export type RFRole =
  | 'duke'
  | 'assassin'
  | 'captain'
  | 'ambassador'
  | 'contessa';

// 진영 — 전원 공개. 같은 진영끼리는 강탈·암살·쿠를 할 수 없다.
export type RFFaction = 'loyalist' | 'reformist';

// rf_action 의 kind (기본 쿠 액션 7종)
export type RFActionKind =
  | 'income'
  | 'aid'
  | 'coup'
  | 'tax'
  | 'assassinate'
  | 'steal'
  | 'exchange';

// 리포메이션 확장 액션 — rf_action 이 아니라 전용 메시지로 나간다
export type RFExtraKind = 'convert' | 'convert_other' | 'embezzle';

// 액션 메뉴에 함께 그려지는 전체 목록
export type RFMenuKind = RFActionKind | RFExtraKind;

// 차단 선언에 쓸 수 있는 역할 (암살자는 차단 역할이 아니다)
export type RFBlockRole = 'duke' | 'contessa' | 'captain' | 'ambassador';

export type RFMessageType =
  // 클라 → 서버
  | 'rf_join_game'
  | 'rf_fill_bots'
  | 'rf_start'
  | 'rf_rejoin'
  | 'rf_action'
  | 'rf_convert'
  | 'rf_convert_other'
  | 'rf_embezzle'
  | 'rf_challenge'
  | 'rf_block'
  | 'rf_pass'
  | 'rf_lose_card'
  | 'rf_exchange'
  | 'rf_react'
  // 서버 → 클라
  | 'rf_player_joined'
  | 'rf_spectate_joined'
  | 'rf_game_state'
  | 'rf_event'
  | 'rf_game_over'
  | 'rf_player_disconnected'
  | 'rf_player_reconnected'
  | 'rf_session_expired'
  | 'rf_error';

export interface RFMessage {
  type: RFMessageType;
  payload?: unknown;
}

// 좌석 뷰 — 손패는 cardCount 로만 보이고, 잃은 카드(lostRoles)만 공개된다.
// faction 은 전원 공개다.
export interface RFPlayerView {
  seat: number;
  name: string;
  connected: boolean;
  bot: boolean;
  alive: boolean;
  coins: number;
  faction: RFFaction;
  // 잃어서 공개로 뒤집힌 카드 — 서버 회귀 대비 ?? [] 방어 필수
  lostRoles?: RFRole[];
  // 아직 비공개로 들고 있는 카드 수 (0이면 탈락)
  cardCount: number;
}

// 진행 중인 액션/차단 컨텍스트 — 창(window) 단계에서만 의미가 있다.
// 필드는 서버 조립 편의에 따라 비거나 -1 일 수 있어 전부 방어적으로 읽는다.
export interface RFPending {
  // 기본 액션 7종 + 확장(embezzle 등)이 올 수 있어 열린 문자열로 둔다
  kind?: RFMenuKind | string;
  // 액션을 건 좌석
  bySeat?: number;
  targetSeat?: number;
  // 주장한 역할 (없으면 역할 주장 없는 액션)
  claimRole?: RFRole | '';
  // 차단이 선언됐으면 그 역할 — 이때 창은 "차단에 대한 도전" 창이다
  blockRole?: RFBlockRole | '';
  // 차단을 선언한 좌석 (서버가 별도로 주면 사용, 없으면 bySeat 로 유도)
  blockerSeat?: number;
  // 이미 허용(rf_pass)한 좌석들 — 응답 진행률 표시용
  passed?: number[];
  // 서버 조립 안내 문구 (있으면 우선 표시)
  message?: string;
}

// 마지막으로 처리된 행동 한 줄 (배너 보조)
export interface RFLastAction {
  seat?: number;
  name?: string;
  message?: string;
}

// 승리 판정 — 최후 1인(seat) 또는 진영 전체(loyalist/reformist) 승리
export interface RFResult {
  winner?: 'seat' | RFFaction | string;
  winnerSeats?: number[];
  winnerNames?: string[];
  message?: string;
}

// 서버가 상태 변경마다 보내는 개인화 전체 스냅샷.
// 은닉: yourRoles/yourExchange 는 본인에게만 온다 (관전자·타인은 키 부재).
export interface RFGameState {
  gameId: string;
  phase: RFPhase;
  hostSeat: number;
  yourSeat: number;
  // 차례 좌석 (없으면 -1)
  currentSeat: number;
  // 현재 단계 마감 시각 (unixMillis, 없으면 0) — 창 카운트다운·AFK 표시용
  endsAt: number;
  // 국고 — rf_convert/rf_convert_other 로 쌓이고 횡령으로 통째로 털린다
  treasury: number;
  pending?: RFPending | null;
  // 내 비공개 카드 (본인만 — 관전자·타인 부재. ?? [] 방어 필수)
  yourRoles?: RFRole[];
  // 교환 선택지 (교환 당사자만 — ?? [] 방어 필수)
  yourExchange?: RFRole[];
  players?: RFPlayerView[];
  lastAction?: RFLastAction | null;
  result?: RFResult | null;
  // 잃을 카드를 고르는 좌석 — 계약에는 없지만 서버가 얹어줄 수 있어
  // 옵셔널로 받아두고, 없으면 pending.targetSeat 로 유도한다
  loseSeat?: number;
  // 사설 방 코드 (공용 로비는 '' 또는 생략)
  roomCode?: string;
  // 관전자 수 (생략 가능)
  spectators?: number;
}

// 이벤트 kind 는 서버가 추가할 수 있어 열린 문자열로 둔다.
export interface RFEvent {
  kind: string;
  seat?: number;
  name?: string;
  message?: string;
}

// rf_game_over 페이로드 — 종료 화면 자체는 마지막 스냅샷(phase 'game_over')
// 으로 그리고, 이 페이로드는 신호 + 승자 보조로만 쓴다.
export type RFGameOverPayload = RFResult;

// sessionStorage 키 — 값을 바꾸면 기존 재접속 세션이 끊기므로 불변
export const RF_SESSION_KEY = 'rf_session_id';

export const RF_MIN_PLAYERS = 2;
export const RF_MAX_PLAYERS = 10;
// rf_fill_bots 는 5인까지 채우고 즉시 시작한다
export const RF_BOT_FILL_TARGET = 5;

export const RF_COUP_COST = 7;
export const RF_ASSASSINATE_COST = 3;
// 이 칩 이상이면 차례에 쿠만 가능 (원작 강제 룰)
export const RF_FORCED_COUP_COINS = 10;
// 진영 전환 비용 — 국고로 들어간다
export const RF_CONVERT_COST = 1;
export const RF_CONVERT_OTHER_COST = 2;

// ---------- 진영 메타 (표시 전용) ----------

export interface RFFactionMeta {
  name: string;
  // 색만으로 구분되지 않게 항상 함께 그리는 아이콘
  icon: string;
  short: string;
}

export const RF_FACTIONS: Record<RFFaction, RFFactionMeta> = {
  loyalist: { name: '충성파', icon: '⚜️', short: '충' },
  reformist: { name: '개혁파', icon: '⚒️', short: '개' },
};

// 서버가 모르는 값을 보내도 화면이 깨지지 않게 한 겹 감싼다
export function rfFactionMeta(faction?: string): RFFactionMeta | null {
  if (faction === 'loyalist' || faction === 'reformist') {
    return RF_FACTIONS[faction];
  }
  return null;
}

export function rfFactionLabel(faction?: string): string {
  const meta = rfFactionMeta(faction);
  return meta ? `${meta.icon} ${meta.name}` : '진영 미정';
}

// ---------- 역할 메타 (표시 전용) ----------

export interface RFRoleMeta {
  name: string;
  en: string;
  // 카드에 새길 한 줄 능력 요약
  ability: string;
}

export const RF_ROLES: Record<RFRole, RFRoleMeta> = {
  duke: { name: '공작', en: 'Duke', ability: '세금 +3칩 · 해외원조 차단' },
  assassin: {
    name: '암살자',
    en: 'Assassin',
    ability: '3칩 지불로 카드 1장 암살',
  },
  captain: {
    name: '사령관',
    en: 'Captain',
    ability: '최대 2칩 강탈 · 강탈 차단',
  },
  ambassador: {
    name: '대사',
    en: 'Ambassador',
    ability: '덱과 카드 교환 · 강탈 차단',
  },
  contessa: { name: '백작부인', en: 'Contessa', ability: '암살 차단' },
};

export function rfRoleName(role?: string): string {
  return role && role in RF_ROLES ? RF_ROLES[role as RFRole].name : '?';
}

// ---------- 액션 메타 (표시 전용) ----------

export interface RFActionMeta {
  label: string;
  icon: string;
  // 지불 비용 (0 = 무료)
  cost: number;
  needsTarget: boolean;
  // 주장하는 역할 (null = 역할 주장 없음)
  claim: RFRole | null;
  // 역할 주장이 아닌 특수 주장 문구 (횡령: "나는 공작이 아니다")
  claimText?: string;
  // 같은 진영에게는 쓸 수 없는 공격 액션인가
  attack: boolean;
  // 확장 액션은 rf_action 이 아니라 전용 메시지로 나간다
  extra: boolean;
  effect: string;
  // 상대가 어떻게 막을 수 있는지 한 줄
  counter: string;
}

export const RF_ACTIONS: Record<RFMenuKind, RFActionMeta> = {
  income: {
    label: '수입',
    icon: '🪙',
    cost: 0,
    needsTarget: false,
    claim: null,
    attack: false,
    extra: false,
    effect: '+1칩',
    counter: '항상 성공',
  },
  aid: {
    label: '해외원조',
    icon: '💰',
    cost: 0,
    needsTarget: false,
    claim: null,
    attack: false,
    extra: false,
    effect: '+2칩',
    counter: '공작이 차단 가능 (진영 무관)',
  },
  coup: {
    label: '쿠',
    icon: '💥',
    cost: RF_COUP_COST,
    needsTarget: true,
    claim: null,
    attack: true,
    extra: false,
    effect: '카드 1장 제거',
    counter: '차단 불가 · 다른 진영만',
  },
  tax: {
    label: '세금',
    icon: '🏛️',
    cost: 0,
    needsTarget: false,
    claim: 'duke',
    attack: false,
    extra: false,
    effect: '+3칩',
    counter: '도전만 가능',
  },
  assassinate: {
    label: '암살',
    icon: '🗡️',
    cost: RF_ASSASSINATE_COST,
    needsTarget: true,
    claim: 'assassin',
    attack: true,
    extra: false,
    effect: '카드 1장 제거',
    counter: '백작부인이 차단 · 다른 진영만',
  },
  steal: {
    label: '강탈',
    icon: '🪝',
    cost: 0,
    needsTarget: true,
    claim: 'captain',
    attack: true,
    extra: false,
    effect: '최대 2칩 뺏기',
    counter: '사령관·대사가 차단 · 다른 진영만',
  },
  exchange: {
    label: '교환',
    icon: '🔄',
    cost: 0,
    needsTarget: false,
    claim: 'ambassador',
    attack: false,
    extra: false,
    effect: '덱에서 2장 교환',
    counter: '도전만 가능',
  },
  convert: {
    label: '진영 바꾸기',
    icon: '🔀',
    cost: RF_CONVERT_COST,
    needsTarget: false,
    claim: null,
    attack: false,
    extra: true,
    effect: '내 진영 전환 · 1칩 국고로',
    counter: '도전·차단 불가 (즉시 발동)',
  },
  convert_other: {
    label: '남의 진영 바꾸기',
    icon: '↔️',
    cost: RF_CONVERT_OTHER_COST,
    needsTarget: true,
    claim: null,
    attack: false,
    extra: true,
    effect: '대상 진영 전환 · 2칩 국고로',
    counter: '도전·차단 불가 · 같은 진영도 가능',
  },
  embezzle: {
    label: '횡령',
    icon: '🏦',
    cost: 0,
    needsTarget: false,
    claim: null,
    claimText: '나는 공작이 아니다',
    attack: false,
    extra: true,
    effect: '국고 전액 획득',
    counter: '도전 시 카드 2장 공개로 증명',
  },
};

// 액션 그리드 표시 순서 (기본 7종 → 리포메이션 확장 3종)
export const RF_ACTION_ORDER: RFMenuKind[] = [
  'income',
  'aid',
  'tax',
  'steal',
  'assassinate',
  'exchange',
  'coup',
  'convert',
  'convert_other',
  'embezzle',
];

// 같은 진영 공격 금지 — 리포메이션의 핵심 제약. 버튼 비활성 사유로 그대로 쓴다.
export const RF_SAME_FACTION_REASON = '같은 진영은 공격할 수 없습니다';

// 강탈·암살·쿠만 진영 제약을 받는다 (해외원조 차단은 진영 무관)
export function rfIsAttack(kind?: string): boolean {
  return kind === 'steal' || kind === 'assassinate' || kind === 'coup';
}

// 차단 창에서 내가 선언할 수 있는 차단 역할 목록.
// 해외원조는 누구나 공작 주장으로, 암살·강탈은 대상만 차단할 수 있다.
export function rfBlockRolesFor(
  kind: string | undefined,
  isTarget: boolean,
): RFBlockRole[] {
  switch (kind) {
    case 'aid':
      return ['duke'];
    case 'assassinate':
      return isTarget ? ['contessa'] : [];
    case 'steal':
      return isTarget ? ['captain', 'ambassador'] : [];
    default:
      return [];
  }
}

// 국고 강조 단계 — 쌓일수록 시각적으로 뜨거워진다 (횡령의 유혹)
export type RFTreasuryLevel = 'empty' | 'low' | 'rich' | 'hoard';

export function rfTreasuryLevel(treasury: number): RFTreasuryLevel {
  if (treasury <= 0) return 'empty';
  if (treasury < 3) return 'low';
  if (treasury < 6) return 'rich';
  return 'hoard';
}
