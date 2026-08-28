// 시타델 메시지·상태 타입 — 와이어 계약(spec-citadels.md)과 1:1 대응.
// 메시지 타입명·payload 필드명은 백엔드와 공유하므로 변경 금지.
//
// 용어 원칙: 와이어 값(noble·religion·trade·military·unique)은 영문 고정이고
// 화면 표기만 정식 한국어판 용어를 쓴다 —
//   직업 8종: 암살자 · 도둑 · 마술사 · 왕 · 주교 · 상인 · 건축가 · 장군
//   건물 색:  노랑(귀족) · 파랑(종교) · 초록(상업) · 빨강(군사) · 보라(특수)
//   그 외:    금화 · 왕관 · 건물 카드 · 건설 · 승점

// 건물 색 5종 — 와이어 값은 영문 고정
export type CTColor = 'noble' | 'religion' | 'trade' | 'military' | 'unique';

// 직업 번호 1~8 (호출 순서와 같다). 0 은 "미확정/선택 단계" 를 뜻한다.
export type CTRole = number;

export type CTPhase =
  | 'waiting'
  // 왕관 보유자부터 한 장씩 직업 카드를 골라 쥔다
  | 'pick_roles'
  // 건물 카드 2장을 뽑아 1장만 남기는 중
  | 'keep_card'
  // 차례 진행 (자원 → 건설)
  | 'turn'
  // 직업 능력 사용
  | 'ability'
  | 'game_over';

export type CTMessageType =
  // 클라 → 서버
  | 'ct_join_game'
  | 'ct_fill_bots'
  | 'ct_start'
  | 'ct_rejoin'
  | 'ct_pick_role'
  | 'ct_gather'
  | 'ct_keep'
  | 'ct_build'
  | 'ct_ability'
  | 'ct_end_turn'
  | 'ct_react'
  // 서버 → 클라
  | 'ct_player_joined'
  | 'ct_spectate_joined'
  | 'ct_game_state'
  | 'ct_event'
  | 'ct_game_over'
  | 'ct_player_disconnected'
  | 'ct_player_reconnected'
  | 'ct_session_expired'
  | 'ct_error';

export interface CTMessage {
  type: CTMessageType;
  payload?: unknown;
}

// 차례의 ① 자원 단계에서 고르는 두 갈래
export type CTGatherKind = 'gold' | 'cards';

// ct_ability 페이로드 — 직업마다 쓰는 필드가 다르다
export interface CTAbilityPayload {
  // 암살자·도둑 — 지목할 직업 번호
  targetRole?: number;
  // 마술사(손패 교환)·장군(파괴 대상) — 지목할 좌석
  targetSeat?: number;
  // 장군 — 파괴할 건물 카드 id
  cardId?: number;
  // 마술사(버리고 새로 뽑기) — 버릴 손패 인덱스 목록
  discard?: number[];
}

// 건물 카드 — 색 블록 + 값(cost) + 이름으로 그린다
export interface CTCard {
  id: number;
  name: string;
  color: CTColor;
  // 건설 비용 = 승점 (기본판 규칙)
  cost: number;
}

// 좌석 뷰 — 공개 정보만. 손패는 장수(handCount)로만 보인다.
export interface CTPlayerView {
  seat: number;
  name: string;
  connected: boolean;
  bot: boolean;
  gold: number;
  handCount: number;
  // 지은 건물(도시) — 전원 공개
  built?: CTCard[];
  score: number;
  // 호출로 공개된 직업 번호 (0 = 아직 비공개)
  roleRevealed: number;
  // 암살당함 / 도둑맞음
  killed: boolean;
  robbed: boolean;
}

// 직전 행동 요약 — 상단 띠에 한 줄로 보여준다
export interface CTLastAction {
  seat: number;
  name: string;
  message: string;
}

// 최종 점수 내역 한 줄
export interface CTResultRow {
  seat: number;
  score: number;
  // "건물값 22 + 먼저 완성 4 + 다섯 색 3" 같은 서버 조립 문구
  detail?: string;
}

export interface CTResult {
  winnerSeats?: number[];
  winnerNames?: string[];
  rows?: CTResultRow[];
  message?: string;
}

// 서버가 상태 변경마다 보내는 개인화 전체 스냅샷.
// yourRole·yourHand·yourDraw·pickPool 은 본인 스냅샷에만 온다 —
// 타인·관전자에게는 키 자체가 없다.
export interface CTGameState {
  gameId: string;
  // 사설 방 코드 (공용 로비는 '' 또는 생략)
  roomCode?: string;
  phase: CTPhase;
  hostSeat: number;
  yourSeat: number;
  // 관전자 수 (생략 가능)
  spectators?: number;
  // 단계 마감 시각 (unixMillis, 없으면 0)
  endsAt: number;
  round: number;
  // 누군가 7채를 완성해 마지막 라운드를 도는 중
  lastRound?: boolean;
  // 왕관(선) 보유 좌석
  crownSeat: number;
  // 지금 호출 중인 직업 번호 (0 = 직업 선택 단계)
  callingRole: number;
  currentSeat: number;
  // 앞면으로 제외된 직업 (전원 공개)
  faceUpRemoved?: number[];
  // 지금 고를 수 있는 직업 (고르는 사람만 받는다)
  pickPool?: number[];
  // 내 직업 (0 = 미확정) — 본인만
  yourRole?: number;
  // 내 손패 — 본인만
  yourHand?: CTCard[];
  // keep_card 단계에서 뽑은 2장 — 본인만
  yourDraw?: CTCard[];
  players?: CTPlayerView[];
  lastAction?: CTLastAction | null;
  result?: CTResult | null;
}

// 이벤트 kind 는 서버가 추가할 수 있어 열린 문자열로 둔다.
export interface CTEvent {
  kind: string;
  seat?: number;
  name?: string;
  message?: string;
}

// ct_game_over 페이로드 — 종료 화면은 마지막 스냅샷으로 그리고
// 이 페이로드는 신호+승자 보조로만 쓴다.
export interface CTGameOverPayload {
  winnerSeats?: number[];
  winnerNames?: string[];
  rows?: CTResultRow[];
  message?: string;
}

// sessionStorage 키 — 값을 바꾸면 기존 재접속 세션이 끊기므로 불변
export const CT_SESSION_KEY = 'ct_session_id';

// 2인 특칙은 생략하고 3~7인만 지원한다
export const CT_MIN_PLAYERS = 3;
export const CT_MAX_PLAYERS = 7;
// ct_fill_bots 는 4인까지 채우고 즉시 시작한다
export const CT_BOT_FILL_TARGET = 4;

// 이 채수를 완성하면 그 라운드를 끝까지 진행하고 종료
export const CT_CITY_GOAL = 7;
// 점수 보너스 3종
export const CT_BONUS_FIRST = 4;
export const CT_BONUS_COMPLETE = 2;
export const CT_BONUS_RAINBOW = 3;

// 차례에 지을 수 있는 건물 수 (건축가는 3채)
export const CT_BUILD_LIMIT = 1;
export const CT_ARCHITECT_BUILD_LIMIT = 3;
// 건축가가 추가로 뽑는 카드 수
export const CT_ARCHITECT_DRAW = 2;
// ① 자원에서 카드를 고르면 2장 뽑아 1장만 남긴다
export const CT_DRAW_COUNT = 2;
export const CT_GATHER_GOLD = 2;

// ---------- 직업 8종 (호출 순서 = 번호 순서) ----------

export const CT_ROLE_ASSASSIN = 1;
export const CT_ROLE_THIEF = 2;
export const CT_ROLE_MAGICIAN = 3;
export const CT_ROLE_KING = 4;
export const CT_ROLE_BISHOP = 5;
export const CT_ROLE_MERCHANT = 6;
export const CT_ROLE_ARCHITECT = 7;
export const CT_ROLE_WARLORD = 8;

export const CT_ROLES: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8];

// 정식 한국어판 표기 — 직역·음차로 바꾸지 않는다
export const CT_ROLE_NAME: Record<number, string> = {
  1: '암살자',
  2: '도둑',
  3: '마술사',
  4: '왕',
  5: '주교',
  6: '상인',
  7: '건축가',
  8: '장군',
};

// 색만으로 구분되지 않게 직업마다 아이콘을 병기한다
export const CT_ROLE_ICON: Record<number, string> = {
  1: '🗡️',
  2: '🎭',
  3: '🎩',
  4: '👑',
  5: '⛪',
  6: '💰',
  7: '🏗️',
  8: '⚔️',
};

export const CT_ROLE_ABILITY: Record<number, string> = {
  1: '직업 하나를 지목해 그 차례를 통째로 건너뛰게 합니다',
  2: '직업 하나를 지목해 그 차례가 오면 금화를 전부 뺏습니다 (암살자·자신 지목 불가)',
  3: '손패를 다른 사람과 통째로 바꾸거나, 원하는 만큼 버리고 그 수만큼 새로 뽑습니다',
  4: '다음 라운드 왕관을 가져옵니다 · 노랑(귀족) 건물당 금화 1',
  5: '파랑(종교) 건물당 금화 1 · 장군의 파괴에서 면역',
  6: '금화 1 추가 · 초록(상업) 건물당 금화 1',
  7: '건물 카드 2장 추가로 뽑기 · 이 차례에 건물 3채까지 건설',
  8: '빨강(군사) 건물당 금화 1 · 금화를 내고 남의 건물 1채 파괴 (비용 = 건물값 − 1)',
};

// 직업 능력이 대상 선택을 요구하는가 (능력 패널을 띄울지 판단)
export const CT_ROLE_NEEDS_TARGET: Record<number, boolean> = {
  1: true,
  2: true,
  3: true,
  4: false,
  5: false,
  6: false,
  7: false,
  8: true,
};

// ---------- 건물 색 5종 ----------

export const CT_COLORS: readonly CTColor[] = [
  'noble',
  'religion',
  'trade',
  'military',
  'unique',
];

// 정식 한국어판 표기
export const CT_COLOR_LABEL: Record<CTColor, string> = {
  noble: '귀족',
  religion: '종교',
  trade: '상업',
  military: '군사',
  unique: '특수',
};

// 색맹 대응 — 색 이름을 글로도 함께 적는다
export const CT_COLOR_TONE: Record<CTColor, string> = {
  noble: '노랑',
  religion: '파랑',
  trade: '초록',
  military: '빨강',
  unique: '보라',
};

// 색만으로 구분되지 않게 색마다 아이콘을 병기한다
export const CT_COLOR_ICON: Record<CTColor, string> = {
  noble: '👑',
  religion: '⛪',
  trade: '💰',
  military: '⚔️',
  unique: '✨',
};

// 색 → 그 색으로 금화를 버는 직업 (도시 화면의 안내용)
export const CT_COLOR_EARNER: Partial<Record<CTColor, number>> = {
  noble: CT_ROLE_KING,
  religion: CT_ROLE_BISHOP,
  trade: CT_ROLE_MERCHANT,
  military: CT_ROLE_WARLORD,
};

// 알 수 없는 색이 와도 화면이 깨지지 않게 방어한다
export function ctColorLabel(color: CTColor | string): string {
  return CT_COLOR_LABEL[color as CTColor] ?? '기타';
}

export function ctColorIcon(color: CTColor | string): string {
  return CT_COLOR_ICON[color as CTColor] ?? '❔';
}

export function ctColorTone(color: CTColor | string): string {
  return CT_COLOR_TONE[color as CTColor] ?? '';
}

export function ctRoleName(role: number): string {
  return CT_ROLE_NAME[role] ?? '알 수 없는 직업';
}

export function ctRoleIcon(role: number): string {
  return CT_ROLE_ICON[role] ?? '🎴';
}

// 직업 카드 한 줄 표기 — "4. 👑 왕"
export function ctRoleTitle(role: number): string {
  return `${role}. ${ctRoleIcon(role)} ${ctRoleName(role)}`;
}

// ---------- 인원별 제외 장수 ----------
// 앞면 제외 6-n장(3인 3장 … 6·7인 0장) + 뒷면 제외 1장.
export function ctFaceUpRemovedCount(playerCount: number): number {
  return Math.max(0, 6 - playerCount);
}

export const CT_FACE_DOWN_REMOVED = 1;

// ---------- 건설 판정 ----------
// 이 게임에서 가장 자주 묻는 질문은 "이 건물을 지금 지을 수 있나, 없다면 왜
// 못 짓나" 다. 손패·능력 패널·행동 바가 같은 답을 쓰도록 여기 한 곳에 모은다.

export interface CTBuildCheck {
  ok: boolean;
  // 못 짓는 이유 (또는 지을 수 있을 때의 한 줄 확인)
  reason: string;
  // 금화가 몇 개 모자란지 (0 이면 부족하지 않다)
  short: number;
  // 이미 같은 이름의 건물을 지었는가
  duplicate: boolean;
}

export function ctBuildCheck(
  card: CTCard,
  gold: number,
  built: CTCard[] | undefined,
  buildsLeft: number,
): CTBuildCheck {
  const duplicate = (built ?? []).some((b) => b.name === card.name);
  const short = Math.max(0, card.cost - gold);

  if (duplicate) {
    return { ok: false, reason: '이미 지은 건물입니다', short, duplicate };
  }
  if (buildsLeft <= 0) {
    return {
      ok: false,
      reason: '이번 차례에 더 지을 수 없습니다',
      short,
      duplicate,
    };
  }
  if (short > 0) {
    return {
      ok: false,
      reason: `금화 ${short} 부족 (건설 비용 ${card.cost} · 보유 ${gold})`,
      short,
      duplicate,
    };
  }
  return {
    ok: true,
    reason: `건설 가능 — 금화 ${card.cost} 지불`,
    short: 0,
    duplicate,
  };
}

// 차례에 지을 수 있는 건물 수 — 건축가만 3채
export function ctBuildLimit(role: number): number {
  return role === CT_ROLE_ARCHITECT ? CT_ARCHITECT_BUILD_LIMIT : CT_BUILD_LIMIT;
}

// ---------- 도시 진척 ----------

export function ctBuiltValue(built: CTCard[] | undefined): number {
  return (built ?? []).reduce((sum, c) => sum + (c.cost ?? 0), 0);
}

export function ctBuiltColors(built: CTCard[] | undefined): Set<CTColor> {
  const set = new Set<CTColor>();
  for (const c of built ?? []) set.add(c.color);
  return set;
}

export function ctMissingColors(built: CTCard[] | undefined): CTColor[] {
  const have = ctBuiltColors(built);
  return CT_COLORS.filter((c) => !have.has(c));
}

export function ctHasAllColors(built: CTCard[] | undefined): boolean {
  return ctMissingColors(built).length === 0;
}

// ---------- 장군의 파괴 ----------
// 비용 = 건물값 − 1. 주교의 도시와 완성된 도시(7채)는 건드릴 수 없다.

export const CT_DESTROY_DISCOUNT = 1;

export function ctDestroyCost(card: CTCard): number {
  return Math.max(0, (card.cost ?? 0) - CT_DESTROY_DISCOUNT);
}

export interface CTTargetCheck {
  ok: boolean;
  reason: string;
}

// 장군이 이 좌석을 파괴 대상으로 삼을 수 있는가
export function ctDestroySeatCheck(
  target: CTPlayerView,
  mySeat: number,
): CTTargetCheck {
  if (target.seat === mySeat) {
    return { ok: false, reason: '내 도시는 파괴할 수 없습니다' };
  }
  if (target.roleRevealed === CT_ROLE_BISHOP) {
    return { ok: false, reason: '주교는 파괴에서 면역입니다' };
  }
  if ((target.built ?? []).length >= CT_CITY_GOAL) {
    return {
      ok: false,
      reason: `완성된 도시(${CT_CITY_GOAL}채)는 파괴할 수 없습니다`,
    };
  }
  if ((target.built ?? []).length === 0) {
    return { ok: false, reason: '지은 건물이 없습니다' };
  }
  return { ok: true, reason: '파괴 대상으로 고를 수 있습니다' };
}

// 장군이 이 건물을 파괴할 금화가 있는가
export function ctDestroyCardCheck(card: CTCard, gold: number): CTTargetCheck {
  const cost = ctDestroyCost(card);
  if (gold < cost) {
    return {
      ok: false,
      reason: `금화 ${cost - gold} 부족 (파괴 비용 ${cost})`,
    };
  }
  return { ok: true, reason: `금화 ${cost} 지불해 파괴합니다` };
}

// ---------- 암살자·도둑의 지목 ----------

export function ctAssassinTargetCheck(role: number): CTTargetCheck {
  if (role === CT_ROLE_ASSASSIN) {
    return { ok: false, reason: '자기 자신은 지목할 수 없습니다' };
  }
  return { ok: true, reason: `${ctRoleName(role)}의 차례를 건너뛰게 합니다` };
}

export function ctThiefTargetCheck(
  role: number,
  killedRole: number,
): CTTargetCheck {
  if (role === CT_ROLE_THIEF) {
    return { ok: false, reason: '자기 자신은 지목할 수 없습니다' };
  }
  if (role === CT_ROLE_ASSASSIN) {
    return { ok: false, reason: '암살자는 지목할 수 없습니다' };
  }
  if (killedRole > 0 && role === killedRole) {
    return { ok: false, reason: '암살당한 직업에서는 뺏을 수 없습니다' };
  }
  return { ok: true, reason: `${ctRoleName(role)}의 금화를 전부 뺏습니다` };
}

// 마술사가 손패를 바꿀 수 있는 상대인가
export function ctMagicianTargetCheck(
  target: CTPlayerView,
  mySeat: number,
): CTTargetCheck {
  if (target.seat === mySeat) {
    return { ok: false, reason: '자기 자신과는 바꿀 수 없습니다' };
  }
  if (target.handCount <= 0) {
    return { ok: false, reason: '손패가 없어 바꿀 것이 없습니다' };
  }
  return { ok: true, reason: `손패 ${target.handCount}장과 통째로 바꿉니다` };
}
