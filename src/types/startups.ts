// 스타트업스 메시지·상태 타입 — 와이어 계약(spec-startups.md)과 1:1 대응.
// 메시지 타입명·payload 필드명은 백엔드와 공유하므로 변경 금지.
//
// 용어 원칙(고정 표기): 회사 / 주식 카드 / 안티 / 대주주 / 돈 / 독점 표시.
//   Company → 회사        Stock card → 주식 카드
//   Antes   → 안티        Majority holder → 대주주
//   Coins   → 돈          Monopoly marker → 독점 표시
//
// ───────────────────────────────────────────────────────────────
// 카드가 어디로 흐르는가 (앞면/뒷면을 헷갈리면 이 게임은 안 보인다)
//
//        ┌──────────────┐  ① 뽑기(대주주면 못 가져옴 → 안티 1원 얹고 다시)
//        │  덱 + 안티💰  │ ─────────────────────────────┐
//        └──────────────┘                              ▼
//                                              ┌─────────────────┐
//        ┌──────────────────────────┐          │  내 손패 (비공개) │
//        │  시장 [카드+안티][카드+안티] │          └─────────────────┘
//        └──────────────────────────┘                   │
//              │  ① 시장에서 가져오기                      │ ② 1장 내려놓기
//              │  (그 위의 안티 전부 받음)                  │ (앞면으로 시장에)
//              ▼                                        ▼
//     ┌────────────────────────┐               (시장으로 되돌아간다.
//     │ 내 앞면 보유 (전원 공개)  │                내 앞에 쌓이지 않는다!)
//     │  = 대주주 판정의 근거     │
//     └────────────────────────┘
//
//   • 덱에서 뽑은 카드 → 손패(비공개)
//   • 시장에서 가져온 카드 → 내 앞에 앞면(공개) + 그 위 안티 전부 획득
//   • 손패에서 낸 카드 → 시장에 앞면으로 놓인다 (내 앞면 보유가 아니다)
//   • 대주주 = 어떤 회사의 앞면 카드를 가장 많이 가진 사람. 동수면 없음.
// ───────────────────────────────────────────────────────────────

// 회사 id 는 서버가 정하는 와이어 값이라 문자열로 열어 둔다.
// 화면 표기(이름·가치)는 스냅샷의 companies 를 우선 쓰고,
// 이모지·색은 아래 표에서 찾는다 (모르는 id 도 안전하게 떨어진다).
export type SUCompanyId = string;

export type SUPhase = 'waiting' | 'take' | 'play' | 'game_over';

export type SUMessageType =
  // 클라 → 서버
  | 'su_join_game'
  | 'su_fill_bots'
  | 'su_start'
  | 'su_rejoin'
  | 'su_take'
  | 'su_play'
  | 'su_react'
  // 서버 → 클라
  | 'su_player_joined'
  | 'su_spectate_joined'
  | 'su_game_state'
  | 'su_event'
  | 'su_game_over'
  | 'su_player_disconnected'
  | 'su_player_reconnected'
  | 'su_session_expired'
  | 'su_error';

export interface SUMessage {
  type: SUMessageType;
  payload?: unknown;
}

// 시장에 앞면으로 놓인 주식 카드 1장 + 그 위에 쌓인 안티.
// 이 카드를 가져가면 ante 를 전부 함께 받는다.
export interface SUMarketCard {
  company: SUCompanyId;
  // 이 카드 위에 쌓인 안티(원). 없으면 0.
  ante?: number;
}

// 회사 1종. size = 덱에 들어 있는 총 장수 = 정산 때의 회사 가치(원).
export interface SUCompanyView {
  id: SUCompanyId;
  name: string;
  size: number;
  // 대주주 좌석. 없으면(동수 포함) 음수 — 서버가 -1 로 보낸다.
  majoritySeat: number;
}

// 좌석 뷰 — 공개 정보만. 손패 내용은 handCount(장수)로만 보인다.
export interface SUPlayerView {
  seat: number;
  name: string;
  connected: boolean;
  bot: boolean;
  // 보유한 돈(원)
  money: number;
  // 손패 장수 (내용은 비공개)
  handCount: number;
  // 앞면 보유 = 시장에서 가져와 공개된 카드. 회사별 개수. 전원 공개.
  faceUp?: Record<SUCompanyId, number>;
}

// 직전 행동 요약 — 상단 띠에 한 줄로 보여준다
export interface SULastAction {
  seat: number;
  name: string;
  message: string;
}

// 정산 한 줄 — detail 은 "대주주 오션 ×2 = +10원" 같은 서버 문장
export interface SUResultRow {
  seat: number;
  money: number;
  detail?: string;
}

export interface SUResult {
  rows?: SUResultRow[];
  winnerSeats?: number[];
  winnerNames?: string[];
  message?: string;
}

// 서버가 상태 변경마다 보내는 개인화 전체 스냅샷.
// yourHand 는 본인 스냅샷에만 온다 — 타인·관전자에게는 키 자체가 없다.
export interface SUGameState {
  gameId: string;
  // 사설 방 코드 (공용 로비는 '' 또는 생략)
  roomCode?: string;
  phase: SUPhase;
  hostSeat: number;
  yourSeat: number;
  // 관전자 수 (생략 가능)
  spectators?: number;
  // 단계 마감 시각 (unixMillis, 없으면 0)
  endsAt: number;
  currentSeat: number;
  // 덱에 남은 주식 카드 장수 — 0 이 되면 그 라운드를 마치고 정산
  deckLeft?: number;
  // 덱 위에 쌓인 안티(원). 대주주라 못 뽑은 사람들이 1원씩 얹은 판돈.
  deckAnte?: number;
  market?: SUMarketCard[];
  companies?: SUCompanyView[];
  // 본인 손패 (비공개) — 관전자·타인 스냅샷에는 키가 없다
  yourHand?: SUCompanyId[];
  players?: SUPlayerView[];
  lastAction?: SULastAction | null;
  result?: SUResult | null;
}

// 이벤트 kind 는 서버가 추가할 수 있어 열린 문자열로 둔다.
export interface SUEvent {
  kind: string;
  seat?: number;
  name?: string;
  message?: string;
}

// su_game_over 페이로드 — 종료 화면은 마지막 스냅샷으로 그리고
// 이 페이로드는 신호+정산 보조로만 쓴다.
export interface SUGameOverPayload {
  rows?: SUResultRow[];
  winnerSeats?: number[];
  winnerNames?: string[];
  message?: string;
}

// sessionStorage 키 — 값을 바꾸면 기존 재접속 세션이 끊기므로 불변
export const SU_SESSION_KEY = 'su_session_id';

export const SU_MIN_PLAYERS = 3;
export const SU_MAX_PLAYERS = 7;
// su_fill_bots 는 4인까지 채우고 즉시 시작한다
export const SU_BOT_FILL_TARGET = 4;

// 시작 자원
export const SU_START_MONEY = 10;
export const SU_START_HAND = 1;
// 덱을 섞고 3장을 빼서 게임에서 제외한다 (아무도 못 본다)
export const SU_REMOVED_CARDS = 3;
// 회사 6종 총합 3+4+5+6+7+8
export const SU_DECK_SIZE = 33;
// 대주주라 덱에서 못 가져올 때 덱 위에 얹는 돈
export const SU_ANTE_PER_SKIP = 1;

// ---------- 회사 6종 ----------
// 색만으로 구분되지 않게 이모지 + 한글 이름 + 가치를 늘 함께 적는다.
//
// | 회사     | 총 장수 = 가치 | 이모지 | 색       |
// |----------|---------------|--------|----------|
// | 긱스     | 3원 (가장 귀함) | 🤓     | 보라     |
// | 바우와우 | 4원            | 🐶     | 금       |
// | 오션     | 5원            | 🌊     | 파랑     |
// | 슈퍼퓨전 | 6원            | ⚡     | 청록     |
// | 가가     | 7원            | 🎤     | 빨강     |
// | 더브     | 8원 (가장 흔함) | 🕊️     | 초록     |
//
// 장수가 적은 회사일수록 귀하지만, 대주주가 됐을 때 받는 돈은 적다.
export interface SUCompanyMeta {
  id: SUCompanyId;
  name: string;
  // 총 장수 = 정산 가치(원)
  size: number;
  emoji: string;
  // 0~5 — CSS 의 .su-tone-N 과 짝을 이룬다
  tone: number;
}

export const SU_COMPANIES: readonly SUCompanyMeta[] = [
  { id: 'geeks', name: '긱스', size: 3, emoji: '🤓', tone: 0 },
  { id: 'bowwow', name: '바우와우', size: 4, emoji: '🐶', tone: 1 },
  { id: 'ocean', name: '오션', size: 5, emoji: '🌊', tone: 2 },
  { id: 'superfusion', name: '슈퍼퓨전', size: 6, emoji: '⚡', tone: 3 },
  { id: 'gaga', name: '가가', size: 7, emoji: '🎤', tone: 4 },
  { id: 'dove', name: '더브', size: 8, emoji: '🕊️', tone: 5 },
];

export const SU_TONE_COUNT = 6;

// 서버가 다른 id 를 쓰더라도 이름이 같으면 같은 회사로 본다.
const META_BY_KEY: Record<string, SUCompanyMeta> = (() => {
  const map: Record<string, SUCompanyMeta> = {};
  for (const meta of SU_COMPANIES) {
    map[meta.id.toLowerCase()] = meta;
    map[meta.name] = meta;
  }
  return map;
})();

// 모르는 id 도 늘 같은 색·이모지를 받도록 하는 안정 해시
function stableHash(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) % 100000;
  }
  return hash;
}

const FALLBACK_EMOJI = ['🏢', '🏭', '🏬', '🏦', '🚀', '📦'];

// 화면에 쓸 회사 표기 한 벌. 이름·가치는 스냅샷(companies)을 우선한다.
export interface SUCompanyDisplay {
  id: SUCompanyId;
  name: string;
  // 총 장수 = 가치(원). 알 수 없으면 0.
  size: number;
  emoji: string;
  tone: number;
}

export function suCompanyDisplay(
  id: SUCompanyId,
  companies?: SUCompanyView[],
): SUCompanyDisplay {
  const server = (companies ?? []).find((c) => c.id === id);
  const meta =
    META_BY_KEY[String(id).toLowerCase()] ??
    (server ? META_BY_KEY[server.name] : undefined);
  const hash = stableHash(String(id));
  return {
    id,
    name: server?.name || meta?.name || String(id),
    size: server?.size ?? meta?.size ?? 0,
    emoji: meta?.emoji ?? FALLBACK_EMOJI[hash % FALLBACK_EMOJI.length],
    tone: meta?.tone ?? hash % SU_TONE_COUNT,
  };
}

// 현황판에 늘어놓을 회사 순서 — 스냅샷이 있으면 가치(총 장수) 오름차순,
// 없으면 기본 6종. 귀한 회사(장수 적음)가 왼쪽/위에 온다.
export function suCompanyList(companies?: SUCompanyView[]): SUCompanyDisplay[] {
  const list = companies ?? [];
  if (list.length === 0) {
    return SU_COMPANIES.map((m) => ({ ...m }));
  }
  return [...list]
    .sort((a, b) => a.size - b.size || a.id.localeCompare(b.id))
    .map((c) => suCompanyDisplay(c.id, list));
}

// ---------- 판정 헬퍼 ----------

export function suFaceUp(
  player: SUPlayerView | undefined,
  company: SUCompanyId,
): number {
  return player?.faceUp?.[company] ?? 0;
}

// 어떤 회사의 앞면 보유 최댓값 (대주주 판단 보조)
export function suTopFaceUp(
  players: SUPlayerView[],
  company: SUCompanyId,
): number {
  return players.reduce((max, p) => Math.max(max, suFaceUp(p, company)), 0);
}

// 시장에 앞면으로 놓여 있는 그 회사 카드 수
export function suMarketCount(
  market: SUMarketCard[],
  company: SUCompanyId,
): number {
  return market.filter((c) => c.company === company).length;
}

// 이 회사 카드 중 지금 앞면으로 드러난 총 장수 (각자 앞 + 시장)
export function suRevealedCount(
  players: SUPlayerView[],
  market: SUMarketCard[],
  company: SUCompanyId,
): number {
  const held = players.reduce((sum, p) => sum + suFaceUp(p, company), 0);
  return held + suMarketCount(market, company);
}

// 내가 대주주인 회사들 — 덱에서 뽑아도 가져올 수 없는 회사다
export function suMyMajorities(
  companies: SUCompanyView[],
  seat: number,
): SUCompanyView[] {
  if (seat < 0) return [];
  return companies.filter((c) => c.majoritySeat === seat);
}

// 판에 깔린 안티 총합 (덱 + 시장 전부)
export function suTotalAnte(
  deckAnte: number,
  market: SUMarketCard[],
): number {
  return market.reduce((sum, c) => sum + (c.ante ?? 0), deckAnte);
}

// 안티 강조 단계 — 쌓일수록 눈에 띄게. CSS 의 .ante-lv-N 과 짝.
export function suAnteLevel(ante: number): number {
  if (ante <= 0) return 0;
  if (ante <= 2) return 1;
  if (ante <= 4) return 2;
  return 3;
}

// su_take payload 의 from 값 — 'deck' 또는 'market:N'
export function suMarketFrom(index: number): string {
  return `market:${index}`;
}

// 돈 표기 — "10원"
export function suMoney(amount: number): string {
  return `${amount}원`;
}

// 대주주 한 줄 — 이름 또는 "대주주 없음"
export function suMajorityText(
  company: SUCompanyView | undefined,
  players: SUPlayerView[],
): string {
  const seat = company?.majoritySeat ?? -1;
  if (seat < 0) return '대주주 없음';
  const name = players.find((p) => p.seat === seat)?.name;
  return name ? `대주주 ${name}` : '대주주 있음';
}
