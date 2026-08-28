// 스플렌더 메시지·상태 타입 — 와이어 계약(spec-splendor.md)과 1:1 대응.
// 메시지 타입명·payload 필드명은 백엔드와 공유하므로 변경 금지.
//
// 용어 원칙: 와이어 값(diamond·sapphire·emerald·ruby·onyx·gold)은 영문 고정이고
// 화면 표기만 정식 한국어판 용어를 쓴다 — 명성 점수 / 개발 카드 / 귀족 타일 /
// 다이아몬드 / 사파이어 / 에메랄드 / 루비 / 줄마노(오닉스 아님) / 황금 /
// 공동 창고 / 예약.

// 보석 5색 — 개발 카드의 비용·보너스에 쓰이는 색
export type SLGem = 'diamond' | 'sapphire' | 'emerald' | 'ruby' | 'onyx';

// 공동 창고에 쌓이는 토큰 = 보석 5색 + 만능 황금
export type SLToken = SLGem | 'gold';

export type SLPhase = 'waiting' | 'turn' | 'discard' | 'game_over';

export type SLMessageType =
  // 클라 → 서버
  | 'sl_join_game'
  | 'sl_fill_bots'
  | 'sl_start'
  | 'sl_rejoin'
  | 'sl_take'
  | 'sl_reserve'
  | 'sl_buy'
  | 'sl_discard'
  | 'sl_react'
  // 서버 → 클라
  | 'sl_player_joined'
  | 'sl_spectate_joined'
  | 'sl_game_state'
  | 'sl_event'
  | 'sl_game_over'
  | 'sl_player_disconnected'
  | 'sl_player_reconnected'
  | 'sl_session_expired'
  | 'sl_error';

export interface SLMessage {
  type: SLMessageType;
  payload?: unknown;
}

// 색별 개수 묶음. 서버는 5색(또는 6종)을 모두 채워 보내지만, 0 인 색을
// 생략해도 화면이 깨지지 않게 전부 선택적으로 둔다.
export type SLGemCount = Partial<Record<SLGem, number>>;
export type SLTokenCount = Partial<Record<SLToken, number>>;

// 개발 카드 — cost 의 영문 키는 와이어 고정 (onyx = 줄마노)
export interface SLCard {
  id: number;
  // 1 · 2 · 3 단계
  tier: number;
  // 명성 점수 (0 이면 표시하지 않는다)
  points: number;
  // 구매하면 영구히 보너스 1이 되는 색
  gem: SLGem;
  cost: SLGemCount;
}

// 귀족 타일 — 요구 보너스를 모두 채우면 차례 끝에 자동 획득 (명성 점수 3점)
export interface SLNoble {
  id: number;
  points: number;
  cost: SLGemCount;
}

// 진열대 — 각 단계 4장 공개
export interface SLBoard {
  tier1?: SLCard[];
  tier2?: SLCard[];
  tier3?: SLCard[];
}

// 각 단계 덱에 남은 장수 (뒷면 더미 — 여기서도 예약할 수 있다)
export interface SLDeckLeft {
  tier1?: number;
  tier2?: number;
  tier3?: number;
}

// 좌석 뷰 — 공개 정보만. 예약 카드는 개수(reservedCount)로만 보인다.
export interface SLPlayerView {
  seat: number;
  name: string;
  connected: boolean;
  bot: boolean;
  // 명성 점수 (개발 카드 + 귀족 타일 합)
  points: number;
  // 색별 보너스 카드 수 (구매한 개발 카드)
  cards?: SLGemCount;
  // 보유 토큰 (황금 포함)
  tokens?: SLTokenCount;
  // 예약한 개발 카드 수 (내용은 남에게 공개되지 않는다)
  reservedCount: number;
  // 획득한 귀족 타일 id 목록
  nobles?: number[];
}

// 직전 행동 요약 — 상단 띠에 한 줄로 보여준다
export interface SLLastAction {
  seat: number;
  name: string;
  message: string;
}

export interface SLResult {
  winnerSeats?: number[];
  winnerNames?: string[];
  message?: string;
}

// 서버가 상태 변경마다 보내는 개인화 전체 스냅샷.
// yourReserved 는 본인 스냅샷에만 온다 — 타인·관전자에게는 키 자체가 없다.
export interface SLGameState {
  gameId: string;
  // 사설 방 코드 (공용 로비는 '' 또는 생략)
  roomCode?: string;
  phase: SLPhase;
  hostSeat: number;
  yourSeat: number;
  // 관전자 수 (생략 가능)
  spectators?: number;
  // 단계 마감 시각 (unixMillis, 없으면 0) — 차례 60초 / 버리기 20초
  endsAt: number;
  currentSeat: number;
  // 누군가 15점에 도달해 마지막 라운드를 도는 중
  lastRound?: boolean;
  // 공동 창고
  bank?: SLTokenCount;
  board?: SLBoard;
  deckLeft?: SLDeckLeft;
  nobles?: SLNoble[];
  // 본인 예약 카드 (덱에서 뽑은 비공개 카드 포함) — 관전자는 부재
  yourReserved?: SLCard[];
  players?: SLPlayerView[];
  lastAction?: SLLastAction | null;
  result?: SLResult | null;
}

// 이벤트 kind 는 서버가 추가할 수 있어 열린 문자열로 둔다.
export interface SLEvent {
  kind: string;
  seat?: number;
  name?: string;
  message?: string;
}

// sl_game_over 페이로드 — 종료 화면은 마지막 스냅샷으로 그리고
// 이 페이로드는 신호+승자 보조로만 쓴다.
export interface SLGameOverPayload {
  winnerSeats?: number[];
  winnerNames?: string[];
  message?: string;
}

// sessionStorage 키 — 값을 바꾸면 기존 재접속 세션이 끊기므로 불변
export const SL_SESSION_KEY = 'sl_session_id';

export const SL_MIN_PLAYERS = 2;
export const SL_MAX_PLAYERS = 4;
// sl_fill_bots 는 3인까지 채우고 즉시 시작한다
export const SL_BOT_FILL_TARGET = 3;

// 보유 토큰 상한 — 넘으면 차례 끝에 버려서 맞춘다
export const SL_TOKEN_LIMIT = 10;
// 종료 트리거 명성 점수
export const SL_TARGET_POINTS = 15;
// 예약 보유 상한
export const SL_MAX_RESERVED = 3;
// 같은 색 2개를 가져오려면 공동 창고에 이만큼 있어야 한다
export const SL_DOUBLE_TAKE_MIN = 4;
// 서로 다른 색을 한 번에 가져올 수 있는 최대 개수
export const SL_DISTINCT_TAKE = 3;
export const SL_TIERS = [1, 2, 3] as const;

// 색 순서 — 화면 어디서나 이 순서로 늘어놓는다 (공동 창고·비용·보너스)
export const SL_GEMS: readonly SLGem[] = [
  'diamond',
  'sapphire',
  'emerald',
  'ruby',
  'onyx',
];

export const SL_TOKENS: readonly SLToken[] = [...SL_GEMS, 'gold']; // secret-scan: ok 보석 토큰(게임 구성물)

// 정식 한국어판 표기 — onyx 는 '줄마노' 다 (오닉스로 쓰지 않는다)
export const SL_TOKEN_LABEL: Record<SLToken, string> = { // secret-scan: ok 보석 토큰 이름표
  diamond: '다이아몬드',
  sapphire: '사파이어',
  emerald: '에메랄드',
  ruby: '루비',
  onyx: '줄마노',
  gold: '황금',
};

// 색맹 대응 보조 — 보석마다 모양이 다르다는 것을 글로도 알린다
export const SL_TOKEN_SHAPE: Record<SLToken, string> = { // secret-scan: ok 보석 토큰 모양
  diamond: '마름모',
  sapphire: '원',
  emerald: '팔각',
  ruby: '육각',
  onyx: '삼각',
  gold: '별',
};

// ---------- 비용 계산 ----------
// 이 게임의 판단은 전부 "이 카드를 지금 살 수 있나, 없다면 무엇이 몇 개
// 모자라나" 로 수렴한다. 화면 세 곳(진열대·예약·귀족)이 같은 답을 쓰도록
// 계산을 여기 한 곳에 모아 둔다.

export interface SLShortage {
  gem: SLGem;
  // 이 색이 몇 개 모자란지 (보너스·보유 토큰을 모두 제한 뒤)
  count: number;
}

export interface SLPayPlan {
  // 황금까지 동원해서 살 수 있는가
  affordable: boolean;
  // 색별로 실제로 낼 토큰 수 (보너스로 깎인 뒤)
  pay: Record<SLGem, number>;
  // 보너스로 깎이지 않은 순수 필요량 (색별)
  need: Record<SLGem, number>;
  // 모자란 색 목록 — 황금으로 메우기 전 기준
  shortages: SLShortage[];
  // 메우는 데 필요한 황금 수
  goldNeeded: number;
  // 황금까지 써도 남는 부족분 (0 이면 구매 가능)
  stillShort: number;
}

const zeroGems = (): Record<SLGem, number> => ({
  diamond: 0,
  sapphire: 0,
  emerald: 0,
  ruby: 0,
  onyx: 0,
});

/**
 * 개발 카드 1장의 지불 계획을 세운다.
 * 규칙: 비용 − 같은 색 보너스 → 남은 만큼 그 색 토큰으로 내고,
 * 그래도 모자라면 황금 1개가 아무 색 1개를 대신한다.
 */
export function slPlanPurchase(
  cost: SLGemCount | undefined,
  bonuses: SLGemCount | undefined,
  tokens: SLTokenCount | undefined,
): SLPayPlan {
  const pay = zeroGems();
  const need = zeroGems();
  const shortages: SLShortage[] = [];
  let goldNeeded = 0;

  for (const gem of SL_GEMS) {
    const raw = cost?.[gem] ?? 0;
    const bonus = bonuses?.[gem] ?? 0;
    const required = Math.max(0, raw - bonus);
    need[gem] = required;
    const have = tokens?.[gem] ?? 0;
    const used = Math.min(required, have);
    pay[gem] = used;
    const short = required - used;
    if (short > 0) {
      shortages.push({ gem, count: short });
      goldNeeded += short;
    }
  }

  const gold = tokens?.gold ?? 0;
  const stillShort = Math.max(0, goldNeeded - gold);

  return {
    affordable: stillShort === 0,
    pay,
    need,
    shortages,
    goldNeeded,
    stillShort,
  };
}

// 귀족 타일 진척 — 요구 보너스를 얼마나 채웠는지 (토큰은 세지 않는다)
export interface SLNobleProgress {
  reached: boolean;
  shortages: SLShortage[];
  // 채운 보너스 수 / 요구 보너스 총합
  have: number;
  total: number;
}

export function slNobleProgress(
  noble: SLNoble,
  bonuses: SLGemCount | undefined,
): SLNobleProgress {
  const shortages: SLShortage[] = [];
  let have = 0;
  let total = 0;
  for (const gem of SL_GEMS) {
    const required = noble.cost?.[gem] ?? 0;
    if (required <= 0) continue;
    total += required;
    const owned = bonuses?.[gem] ?? 0;
    have += Math.min(required, owned);
    if (owned < required) {
      shortages.push({ gem, count: required - owned });
    }
  }
  return { reached: shortages.length === 0, shortages, have, total };
}

// 합계 헬퍼 — 보유 토큰 총량(10개 상한 판정), 보너스 카드 총량
export function slTotalTokens(tokens: SLTokenCount | undefined): number {
  return SL_TOKENS.reduce((sum, t) => sum + (tokens?.[t] ?? 0), 0);
}

export function slTotalCards(cards: SLGemCount | undefined): number {
  return SL_GEMS.reduce((sum, g) => sum + (cards?.[g] ?? 0), 0);
}

// 부족분을 한 줄 한국어로 — "사파이어 2 · 루비 1"
export function slShortageText(shortages: SLShortage[]): string {
  return shortages
    .map((s) => `${SL_TOKEN_LABEL[s.gem]} ${s.count}`)
    .join(' · ');
}
