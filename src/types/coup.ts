// 쿠(Coup) 메시지·상태 타입 — 와이어 계약(spec-coup.md)과 1:1 대응.
// 메시지 타입명·payload 필드명은 백엔드와 공유하므로 변경 금지.

export type CPPhase =
  | 'waiting'
  | 'action'
  | 'challenge_window'
  | 'block_window'
  | 'block_challenge_window'
  | 'lose_card'
  | 'exchange_pick'
  | 'game_over';

export type CPRole =
  | 'duke'
  | 'assassin'
  | 'captain'
  | 'ambassador'
  | 'contessa';

export type CPActionKind =
  | 'income'
  | 'aid'
  | 'coup'
  | 'tax'
  | 'assassinate'
  | 'steal'
  | 'exchange';

// 차단 선언에 쓸 수 있는 역할 (암살자는 차단 역할이 아니다)
export type CPBlockRole = 'duke' | 'contessa' | 'captain' | 'ambassador';

export type CPMessageType =
  // 클라 → 서버
  | 'cp_join_game'
  | 'cp_fill_bots'
  | 'cp_start'
  | 'cp_rejoin'
  | 'cp_action'
  | 'cp_allow'
  | 'cp_challenge'
  | 'cp_block'
  | 'cp_lose'
  | 'cp_exchange_keep'
  | 'cp_react'
  // 서버 → 클라
  | 'cp_player_joined'
  | 'cp_spectate_joined'
  | 'cp_game_state'
  | 'cp_event'
  | 'cp_game_over'
  | 'cp_player_disconnected'
  | 'cp_player_reconnected'
  | 'cp_session_expired'
  | 'cp_error';

export interface CPMessage {
  type: CPMessageType;
  payload?: unknown;
}

// 좌석 뷰 — 손패는 cardCount 로만 보이고, 잃은 카드만 revealed 로 공개된다.
export interface CPPlayerView {
  seat: number;
  name: string;
  connected: boolean;
  bot: boolean;
  alive: boolean;
  chips: number;
  // 잃어서 공개로 뒤집힌 카드 role 목록 — 서버 회귀 대비 ?? [] 방어 필수
  revealed?: CPRole[];
  // 아직 비공개로 들고 있는 카드 수 (0이면 탈락)
  cardCount: number;
}

// 진행 중인 액션/차단 컨텍스트 — 창(window) 단계에서만 의미가 있다.
// 필드는 서버 조립 편의에 따라 비거나 -1 일 수 있어 전부 방어적으로 읽는다.
export interface CPPending {
  kind?: CPActionKind | '';
  actorSeat?: number;
  targetSeat?: number;
  blockerSeat?: number;
  blockRole?: CPBlockRole | '';
  // 서버 조립 안내 문구 (있으면 우선 표시)
  message?: string;
}

// 서버가 상태 변경마다 보내는 개인화 전체 스냅샷.
// 은닉: yourCards/yourExchange 는 본인에게만 온다 (관전자·타인은 부재).
export interface CPGameState {
  gameId: string;
  phase: CPPhase;
  hostSeat: number;
  yourSeat: number;
  // 차례 좌석 (없으면 -1)
  currentSeat: number;
  // 현재 단계 마감 시각 (unixMillis, 없으면 0) — 창 카운트다운·AFK 표시용
  endsAt: number;
  pending?: CPPending | null;
  // 잃을 카드를 고르는 중인 좌석 (-1 = 없음)
  loseSeat: number;
  // 내 비공개 카드 (본인만 — 관전자·타인 부재. ?? [] 방어 필수)
  yourCards?: CPRole[];
  // 교환 선택지 (교환 액션 당사자만 — ?? [] 방어 필수)
  yourExchange?: CPRole[];
  players?: CPPlayerView[];
  deckCount: number;
  // 사설 방 코드 (공용 로비는 '' 또는 생략)
  roomCode?: string;
  // 관전자 수 (생략 가능)
  spectators?: number;
}

// 이벤트 kind 는 서버가 추가할 수 있어 열린 문자열로 둔다.
export interface CPEvent {
  kind: string;
  seat?: number;
  name?: string;
  message?: string;
}

// cp_game_over 페이로드 — 종료 화면 자체는 마지막 스냅샷(phase 'game_over')으로
// 그리고, 이 페이로드는 신호+승자 보조로만 쓴다. 필드는 방어적으로 옵셔널.
export interface CPGameOverPayload {
  winnerSeats?: number[];
  winners?: string[];
  message?: string;
}

// sessionStorage 키 — 값을 바꾸면 기존 재접속 세션이 끊기므로 불변
export const CP_SESSION_KEY = 'cp_session_id';

export const CP_MIN_PLAYERS = 2;
export const CP_MAX_PLAYERS = 6;
// cp_fill_bots 는 4인까지 채우고 즉시 시작한다 (lv 결)
export const CP_BOT_FILL_TARGET = 4;

export const CP_COUP_COST = 7;
export const CP_ASSASSINATE_COST = 3;
// 이 칩 이상이면 차례에 쿠만 가능 (원작 강제 룰)
export const CP_FORCED_COUP_CHIPS = 10;

// ---------- 역할 메타 (표시 전용) ----------

export interface CPRoleMeta {
  name: string;
  en: string;
  // 카드에 새길 한 줄 능력 요약
  ability: string;
}

export const CP_ROLES: Record<CPRole, CPRoleMeta> = {
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

// ---------- 액션 메타 (표시 전용) ----------

export interface CPActionMeta {
  label: string;
  icon: string;
  // 지불 비용 (0 = 무료)
  cost: number;
  needsTarget: boolean;
  // 주장하는 역할 (null = 역할 주장 없음 → 도전 불가)
  claim: CPRole | null;
  effect: string;
  // 상대가 어떻게 막을 수 있는지 한 줄
  counter: string;
}

export const CP_ACTIONS: Record<CPActionKind, CPActionMeta> = {
  income: {
    label: '수입',
    icon: '🪙',
    cost: 0,
    needsTarget: false,
    claim: null,
    effect: '+1칩',
    counter: '항상 성공',
  },
  aid: {
    label: '해외원조',
    icon: '💰',
    cost: 0,
    needsTarget: false,
    claim: null,
    effect: '+2칩',
    counter: '공작이 차단 가능',
  },
  coup: {
    label: '쿠',
    icon: '💥',
    cost: CP_COUP_COST,
    needsTarget: true,
    claim: null,
    effect: '카드 1장 제거',
    counter: '차단 불가',
  },
  tax: {
    label: '세금',
    icon: '🏛️',
    cost: 0,
    needsTarget: false,
    claim: 'duke',
    effect: '+3칩',
    counter: '도전만 가능',
  },
  assassinate: {
    label: '암살',
    icon: '🗡️',
    cost: CP_ASSASSINATE_COST,
    needsTarget: true,
    claim: 'assassin',
    effect: '카드 1장 제거',
    counter: '백작부인이 차단',
  },
  steal: {
    label: '강탈',
    icon: '🪝',
    cost: 0,
    needsTarget: true,
    claim: 'captain',
    effect: '최대 2칩 뺏기',
    counter: '사령관·대사가 차단',
  },
  exchange: {
    label: '교환',
    icon: '🔄',
    cost: 0,
    needsTarget: false,
    claim: 'ambassador',
    effect: '덱에서 2장 교환',
    counter: '도전만 가능',
  },
};

// 액션 그리드 표시 순서 (기본 → 역할 액션)
export const CP_ACTION_ORDER: CPActionKind[] = [
  'income',
  'aid',
  'coup',
  'tax',
  'assassinate',
  'steal',
  'exchange',
];

// 차단 창에서 내가 선언할 수 있는 차단 역할 목록.
// 해외원조는 누구나 공작 주장으로, 암살·강탈은 대상만 차단할 수 있다.
export function cpBlockRolesFor(
  kind: CPActionKind | '' | undefined,
  isTarget: boolean,
): CPBlockRole[] {
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
