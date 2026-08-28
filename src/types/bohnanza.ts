// 보난자 메시지·상태 타입 — 와이어 계약(spec-bohnanza.md)과 1:1 대응.
// 메시지 타입명·payload 필드명은 백엔드와 공유하므로 변경 금지.
//
// 용어 원칙(고정 표기):
//   Bean field → 콩밭      3rd field → 세 번째 콩밭
//   Harvest    → 수확      Beanometer → 콩미터
//   Trade      → 거래      Donate     → 기부
//   Gold coin  → 금화      Draw deck  → 덱
//
// ───────────────────────────────────────────────────────────────
// 이 게임의 전부: 손패 순서는 절대 바뀌지 않는다
//
//   덱 ─── 뽑기(3장) ──▶ [손패 뒤]  …  [손패 앞] ──▶ 반드시 심는다
//                          ▲                              │
//                          └── 맨 뒤로만 붙는다             ▼
//                                                    ┌──────────┐
//   덱 ─── 2장 뒤집기 ──▶ 공개 카드 ──거래/기부──▶ 받은 콩 │  내 콩밭  │
//                                    (손에 못 든다)  └──────────┘
//                                    즉시 전부 심는다      │ 수확
//                                                         ▼
//                                                    콩미터 → 금화
//
//   • 손패는 맨 앞에서만 빠지고 맨 뒤로만 붙는다.
//   • 그래서 정렬·재배열 API 가 없고, 프론트도 그런 UI 를 절대 만들지 않는다.
//   • 맨 앞 카드 = 이번 차례에 반드시 심어야 하는 카드다. 화면에서 크게 강조한다.
// ───────────────────────────────────────────────────────────────

// 콩 와이어 값은 서버가 정하는 문자열이라 열어 둔다.
// 알려진 8종은 BZ_BEANS 에서 찾고, 모르는 값도 안전하게 떨어진다.
export type BZBean = string;

// 차례 4단계 — 순서를 절대 바꾸지 않는다.
//   plant(심기) → trade(뒤집기·거래) → plant_received(받은 콩 심기) → draw(뽑기)
export type BZPhase =
  | 'waiting'
  | 'plant'
  | 'trade'
  | 'plant_received'
  | 'draw'
  | 'game_over';

export type BZMessageType =
  // 클라 → 서버
  | 'bz_join_game'
  | 'bz_fill_bots'
  | 'bz_start'
  | 'bz_rejoin'
  | 'bz_plant'
  | 'bz_harvest'
  | 'bz_buy_field'
  | 'bz_offer'
  | 'bz_respond'
  | 'bz_plant_received'
  | 'bz_end_phase'
  | 'bz_react'
  // 서버 → 클라
  | 'bz_player_joined'
  | 'bz_spectate_joined'
  | 'bz_game_state'
  | 'bz_event'
  | 'bz_game_over'
  | 'bz_player_disconnected'
  | 'bz_player_reconnected'
  | 'bz_session_expired'
  | 'bz_error';

export interface BZMessage {
  type: BZMessageType;
  payload?: unknown;
}

// 콩밭 1칸. 같은 종류만 쌓인다. 빈 밭은 count 0 (bean 은 생략될 수 있다).
export interface BZField {
  bean?: BZBean;
  count: number;
}

// 좌석 뷰 — 밭·금화는 전원 공개, 손패는 장수만 보인다.
export interface BZPlayerView {
  seat: number;
  name: string;
  connected: boolean;
  bot: boolean;
  coins: number;
  // 손패 장수 (내용은 비공개)
  handCount: number;
  // 보유한 콩밭 수 (2 또는 3)
  fieldCount: number;
  // 밭 내용 — 전원 공개
  fields?: BZField[];
}

// 진행 중인 거래 제안.
// wantHand 상세는 당사자(제안자·대상자)에게만 온다 — 남의 손패 정보 누출 방지.
export interface BZOffer {
  id: string;
  fromSeat: number;
  toSeat: number;
  // 제안자가 내주는 자기 손패 카드
  giveHand?: BZBean[];
  // 제안자가 내주는 공개 카드
  giveFlipped?: BZBean[];
  // 제안자가 받고 싶은 상대 손패 카드 (당사자만 상세를 본다)
  wantHand?: BZBean[];
}

// 직전 행동 요약 — 상단 띠에 한 줄로 보여준다
export interface BZLastAction {
  seat: number;
  name: string;
  message: string;
}

// 정산 한 줄 — 동점이면 손에 든 카드가 많은 사람이 이긴다
export interface BZResultRow {
  seat: number;
  coins: number;
  handCount: number;
}

export interface BZResult {
  rows?: BZResultRow[];
  winnerSeats?: number[];
  winnerNames?: string[];
  message?: string;
}

// 서버가 상태 변경마다 보내는 개인화 전체 스냅샷.
// yourHand·yourPending 는 본인 스냅샷에만 온다 — 타인·관전자에게는 키 자체가 없다.
export interface BZGameState {
  gameId: string;
  // 사설 방 코드 (공용 로비는 '' 또는 생략)
  roomCode?: string;
  phase: BZPhase;
  hostSeat: number;
  yourSeat: number;
  spectators?: number;
  // 단계 마감 시각 (unixMillis, 없으면 0)
  endsAt: number;
  currentSeat: number;
  // 덱에 남은 장수
  deckLeft?: number;
  // 덱을 몇 번 소진했는지 (0~3). 마지막 소진에서 게임이 끝난다.
  deckCycle?: number;
  // 2단계 공개 카드 — 전원 공개
  flipped?: BZBean[];
  offers?: BZOffer[];
  // 본인 손패 — 순서가 곧 진실이다. 절대 정렬하지 않는다.
  yourHand?: BZBean[];
  // 본인이 거래·기부로 받아 즉시 심어야 하는 카드
  yourPending?: BZBean[];
  players?: BZPlayerView[];
  lastAction?: BZLastAction | null;
  result?: BZResult | null;
}

// 이벤트 kind 는 서버가 추가할 수 있어 열린 문자열로 둔다.
export interface BZEvent {
  kind: string;
  seat?: number;
  name?: string;
  message?: string;
}

// bz_game_over 페이로드 — 종료 화면은 마지막 스냅샷으로 그리고
// 이 페이로드는 신호+정산 보조로만 쓴다.
export interface BZGameOverPayload {
  rows?: BZResultRow[];
  winnerSeats?: number[];
  winnerNames?: string[];
  message?: string;
}

// sessionStorage 키 — 값을 바꾸면 기존 재접속 세션이 끊기므로 불변
export const BZ_SESSION_KEY = 'bz_session_id';

export const BZ_MIN_PLAYERS = 3;
export const BZ_MAX_PLAYERS = 5;
// bz_fill_bots 는 3인까지 채우고 즉시 시작한다
export const BZ_BOT_FILL_TARGET = 3;

// 시작 자원
export const BZ_START_HAND = 5;
export const BZ_START_FIELDS = 2;
export const BZ_MAX_FIELDS = 3;
// 세 번째 콩밭 값 (금화). 외상 불가 — 금화가 모자라면 못 산다.
export const BZ_THIRD_FIELD_COST = 3;
// 2단계에서 뒤집는 장수 / 4단계에서 뽑는 장수
export const BZ_FLIP_COUNT = 2;
export const BZ_DRAW_COUNT = 3;
// 콩 8종 총합 20+18+16+14+12+10+8+6
export const BZ_DECK_SIZE = 104;

// 덱이 몇 번째로 소진되면 끝나는가 — 3인 판은 2번, 4~5인은 3번.
export function bzEndCycle(playerCount: number): number {
  return playerCount <= 3 ? 2 : 3;
}

// ---------- 콩 8종 (현행 신판) ----------
// 콩미터 = "몇 장을 수확하면 금화 몇 개"인지의 문턱값.
// meter[i] 는 금화 (i+1)개를 받는 최소 장수다. null 이면 그 칸이 없다.
//
// | 콩         | 와이어    | 장수 | 금화1 | 금화2 | 금화3 | 금화4 |
// |------------|-----------|------|-------|-------|-------|-------|
// | 푸르대콩   | blue      | 20   | 4     | 6     | 8     | 10    |
// | 칠리콩     | chili     | 18   | 3     | 6     | 8     | 9     |
// | 메주콩     | stink     | 16   | 3     | 5     | 7     | 8     |
// | 완두콩     | green     | 14   | 3     | 5     | 6     | 7     |
// | 대두       | soy       | 12   | 2     | 4     | 6     | 7     |
// | 동부       | blackeyed | 10   | 2     | 4     | 5     | 6     |
// | 팥         | red       | 8    | 2     | 3     | 4     | 5     |
// | 강낭콩     | garden    | 6    | —     | 2     | 3     | —     |
//
// 강낭콩만 예외다: 2장이면 금화 2개, 3장이면 금화 3개이고 금화 1개·4개 칸이 없다.
export interface BZBeanMeta {
  bean: BZBean;
  name: string;
  // 덱에 들어 있는 총 장수 — 흔할수록 모으기 쉽지만 문턱이 높다
  total: number;
  emoji: string;
  // 0~7 — CSS 의 .bz-tone-N 과 짝을 이룬다
  tone: number;
  // 금화 1/2/3/4개를 받는 최소 장수 (null = 그 칸 없음)
  meter: readonly (number | null)[];
}

// 같은 표가 서버의 server/bz_types.go (bzBeanDefs) 에도 있다.
// 서버는 실제 금화 지급의 근거이고 여기는 "지금 수확하면 몇 금화"를 미리
// 보여주는 근거라, 한쪽만 고치면 화면 숫자와 실제 지급이 조용히 어긋난다.
// 고칠 일이 생기면 반드시 양쪽을 함께 고쳐라.
export const BZ_BEANS: readonly BZBeanMeta[] = [
  { bean: 'blue', name: '푸르대콩', total: 20, emoji: '🫐', tone: 0, meter: [4, 6, 8, 10] },
  { bean: 'chili', name: '칠리콩', total: 18, emoji: '🌶️', tone: 1, meter: [3, 6, 8, 9] },
  { bean: 'stink', name: '메주콩', total: 16, emoji: '🧆', tone: 2, meter: [3, 5, 7, 8] },
  { bean: 'green', name: '완두콩', total: 14, emoji: '🫛', tone: 3, meter: [3, 5, 6, 7] },
  { bean: 'soy', name: '대두', total: 12, emoji: '🫘', tone: 4, meter: [2, 4, 6, 7] },
  { bean: 'blackeyed', name: '동부', total: 10, emoji: '🌰', tone: 5, meter: [2, 4, 5, 6] },
  { bean: 'red', name: '팥', total: 8, emoji: '🥮', tone: 6, meter: [2, 3, 4, 5] },
  // 강낭콩만 금화 1개·4개 칸이 없다
  { bean: 'garden', name: '강낭콩', total: 6, emoji: '🥜', tone: 7, meter: [null, 2, 3, null] },
];

export const BZ_TONE_COUNT = 8;
// 콩미터 칸 수 (금화 1~4개)
export const BZ_METER_STEPS = 4;

const META_BY_KEY: Record<string, BZBeanMeta> = (() => {
  const map: Record<string, BZBeanMeta> = {};
  for (const meta of BZ_BEANS) {
    map[String(meta.bean).toLowerCase()] = meta;
    map[meta.name] = meta;
  }
  return map;
})();

// 모르는 콩도 늘 같은 색·이모지를 받도록 하는 안정 해시
function stableHash(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) % 100000;
  }
  return hash;
}

const FALLBACK_EMOJI = ['🌱', '🌿', '🍀', '🌾', '🪴', '🥬', '🧄', '🧅'];

// 서버가 모르는 콩을 보내도 화면이 무너지지 않게 항상 표기 한 벌을 만들어 준다.
export function bzBean(bean: BZBean): BZBeanMeta {
  const known = META_BY_KEY[String(bean).toLowerCase()];
  if (known) return known;
  const hash = stableHash(String(bean));
  return {
    bean,
    name: String(bean),
    total: 0,
    emoji: FALLBACK_EMOJI[hash % FALLBACK_EMOJI.length],
    tone: hash % BZ_TONE_COUNT,
    meter: [null, null, null, null],
  };
}

// ---------- 콩미터 계산 ----------
// 이 판단의 근거가 전부 여기 있다: 지금 수확하면 금화 몇 개인가.
// 문턱에 못 미치면 0개다 (카드는 그냥 버려진다).
export function bzCoins(bean: BZBean, count: number): number {
  if (count <= 0) return 0;
  const { meter } = bzBean(bean);
  for (let coins = BZ_METER_STEPS; coins >= 1; coins -= 1) {
    const need = meter[coins - 1];
    if (need !== null && need !== undefined && count >= need) return coins;
  }
  return 0;
}

// 다음 문턱까지 몇 장이 더 필요한가 — "2장 더 모으면 금화 3개" 안내용.
// 더 오를 칸이 없으면 null.
export function bzNextStep(
  bean: BZBean,
  count: number,
): { need: number; more: number; coins: number } | null {
  const { meter } = bzBean(bean);
  for (let coins = 1; coins <= BZ_METER_STEPS; coins += 1) {
    const need = meter[coins - 1];
    if (need === null || need === undefined) continue;
    if (count < need) return { need, more: need - count, coins };
  }
  return null;
}

// 콩미터를 표로 그릴 때 쓰는 행 — 없는 칸은 걸러 낸다.
export interface BZMeterCell {
  coins: number;
  need: number;
}

export function bzMeterCells(bean: BZBean): BZMeterCell[] {
  const { meter } = bzBean(bean);
  const cells: BZMeterCell[] = [];
  for (let coins = 1; coins <= BZ_METER_STEPS; coins += 1) {
    const need = meter[coins - 1];
    if (need === null || need === undefined) continue;
    cells.push({ coins, need });
  }
  return cells;
}

// ---------- 콩밭 헬퍼 ----------

// 보유한 밭 수만큼 슬롯을 채워 돌려준다 (서버가 빈 밭을 생략해도 자리를 그린다).
export function bzFieldSlots(player?: BZPlayerView | null): BZField[] {
  const raw = player?.fields ?? [];
  const owned = Math.max(
    player?.fieldCount ?? BZ_START_FIELDS,
    raw.length,
    BZ_START_FIELDS,
  );
  const slots: BZField[] = [];
  for (let i = 0; i < owned; i += 1) {
    const f = raw[i];
    slots.push({ bean: f?.bean, count: f?.count ?? 0 });
  }
  return slots;
}

export function bzFieldEmpty(field: BZField | undefined): boolean {
  return !field || !field.bean || field.count <= 0;
}

// 카드가 2장 이상인 밭이 있으면 1장짜리 밭은 수확할 수 없다.
// (모든 밭이 1장이면 아무거나 수확할 수 있다.)
export function bzCanHarvest(fields: BZField[], index: number): boolean {
  const field = fields[index];
  if (bzFieldEmpty(field)) return false;
  if (field.count >= 2) return true;
  return !fields.some((f, i) => i !== index && f.count >= 2);
}

// 수확이 막힌 이유 — 버튼 옆에 그대로 적어 준다.
export function bzHarvestBlockReason(
  fields: BZField[],
  index: number,
): string | null {
  const field = fields[index];
  if (bzFieldEmpty(field)) return '빈 밭입니다';
  if (bzCanHarvest(fields, index)) return null;
  return '2장 이상인 밭이 있어 1장짜리 밭은 수확할 수 없습니다';
}

// 이 콩을 지금 심을 수 있는 밭 — 같은 콩이 있는 밭이 우선, 없으면 빈 밭.
export function bzPlantableFields(fields: BZField[], bean: BZBean): number[] {
  const match: number[] = [];
  const empty: number[] = [];
  fields.forEach((f, i) => {
    if (bzFieldEmpty(f)) empty.push(i);
    else if (f.bean === bean) match.push(i);
  });
  return [...match, ...empty];
}

// 심을 자리가 아예 없으면 밭 하나를 먼저 수확해야 한다.
export function bzNeedsHarvestBeforePlant(
  fields: BZField[],
  bean: BZBean,
): boolean {
  return bzPlantableFields(fields, bean).length === 0;
}

// 밭을 지금 수확하면 받는 금화
export function bzFieldCoins(field: BZField | undefined): number {
  if (!field || !field.bean) return 0;
  return bzCoins(field.bean, field.count);
}

// 내 밭을 전부 수확했을 때의 금화 합 (종료 정산 감각용)
export function bzTotalFieldCoins(fields: BZField[]): number {
  return fields.reduce((sum, f) => sum + bzFieldCoins(f), 0);
}

// ---------- 표기 헬퍼 ----------

export function bzCoinText(coins: number): string {
  return `금화 ${coins}개`;
}

// 단계 한글 이름 — 4단계 안내 띠와 상태 배지가 같은 문구를 쓴다.
export const BZ_PHASE_STEPS: readonly {
  phase: BZPhase;
  step: number;
  name: string;
  hint: string;
}[] = [
  {
    phase: 'plant',
    step: 1,
    name: '콩 심기',
    hint: '손패 맨 앞 카드를 반드시 심습니다 (두 번째까지 선택)',
  },
  {
    phase: 'trade',
    step: 2,
    name: '뒤집기·거래',
    hint: '덱 위 2장을 공개하고 거래·기부합니다 — 차례인 사람이 반드시 낍니다',
  },
  {
    phase: 'plant_received',
    step: 3,
    name: '받은 콩 심기',
    hint: '거래·기부로 받은 카드는 손에 못 들고 즉시 전부 심습니다',
  },
  {
    phase: 'draw',
    step: 4,
    name: '카드 뽑기',
    hint: '3장을 뽑아 손패 맨 뒤에 붙입니다',
  },
];

export function bzStepOf(phase: BZPhase): number {
  return BZ_PHASE_STEPS.find((s) => s.phase === phase)?.step ?? 0;
}

export function bzPhaseName(phase: BZPhase): string {
  const step = BZ_PHASE_STEPS.find((s) => s.phase === phase);
  if (step) return step.name;
  if (phase === 'waiting') return '대기 중';
  if (phase === 'game_over') return '게임 종료';
  return '진행 중';
}

// 남은 덱 소진 횟수 안내 — "덱 소진 1/3"
export function bzCycleText(deckCycle: number, playerCount: number): string {
  return `덱 소진 ${deckCycle}/${bzEndCycle(playerCount)}`;
}

// 마지막 소진 사이클인지 (상단 경고 강조용)
export function bzIsFinalCycle(
  deckCycle: number,
  playerCount: number,
): boolean {
  return deckCycle >= bzEndCycle(playerCount) - 1;
}
