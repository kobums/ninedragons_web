// 루미큐브 메시지·상태 타입 + 순수 판정 함수.
// 와이어 계약(spec-rummikub.md)과 1:1 대응 — 메시지 타입명·payload 필드명은
// 백엔드와 공유하므로 변경 금지.
//
// 용어 원칙(고정 표기 — 한국 공식 유통사 표기):
//   Tile → 타일        Set → 세트 (그룹과 연속을 아우르는 말)
//   Group → 그룹       색이 다른 같은 숫자 3~4개
//   Run → 연속         색이 같고 숫자가 이어지는 3개 이상 ("런" 아님)
//   Initial meld → 등록  첫 내려놓기 30점 이상
//   Manipulation → 숫자조합  테이블 위 세트를 재배치하는 것 ("조작" 아님)
//   Joker → 조커       Pool → 타일더미       Rack → 받침대
//
// ───────────────────────────────────────────────────────────────
// 타일이 어디로 흐르는가
//
//   ┌───────────────┐   못 내겠으면 1개 가져가고 차례 끝 (ru_draw)
//   │  타일더미 🁢    │ ───────────────────────────┐
//   └───────────────┘                             ▼
//                                        ┌────────────────────┐
//   ┌──────────────────────────────┐     │  내 받침대 (나만 봄)  │
//   │  테이블 [세트][세트][세트] ...  │ ◀── └────────────────────┘
//   └──────────────────────────────┘   차례 중 자유롭게 얹었다 물렸다 하고
//        ▲          숫자조합(테이블 재배치)도 로컬에서 마음껏 —
//        └───────── 확정(ru_commit)할 때 테이블 전체를 통째로 보낸다.
//                   서버가 하나라도 어긋났다고 보면 통째로 거부하고
//                   차례 시작 상태로 되돌린다 (부분 적용 없음).
// ───────────────────────────────────────────────────────────────

// 색 와이어 값 고정 — 화면 표기만 한국어.
export type RUColor = 'red' | 'blue' | 'black' | 'orange';

export const RU_COLORS: readonly RUColor[] = ['red', 'blue', 'black', 'orange'];

export const RU_COLOR_LABEL: Record<string, string> = {
  red: '빨강',
  blue: '파랑',
  black: '검정',
  orange: '주황',
};

// 색만으로 구분되지 않게 — 숫자 글꼴 색이 타일 색이고, 여기에 기호를 병기한다.
// (검정·주황은 명도로도 갈리지만 색각 이상 대비로 기호를 하나 더 얹는다)
export const RU_COLOR_MARK: Record<string, string> = {
  red: '◆',
  blue: '●',
  black: '■',
  orange: '▲',
};

export function ruColorLabel(color: string): string {
  return RU_COLOR_LABEL[color] ?? color;
}

export function ruColorMark(color: string): string {
  return RU_COLOR_MARK[color] ?? '·';
}

// 타일 id 의 와이어 타입은 스펙에 명시가 없다(문자열/정수 미정).
// 어느 쪽이 와도 그대로 되돌려 보낼 수 있게 열어 두고, 내부 인덱싱만
// 문자열 키(ruTileKey)로 한다 — 커밋 payload 에는 항상 원본 값을 싣는다.
export type RUTileId = string | number;

export interface RUTile {
  id: RUTileId;
  // 조커는 색이 비어 올 수 있다
  color: string;
  // 조커는 0
  num: number;
  joker?: boolean;
  // 테이블에 놓인 조커가 대신하는 숫자 — 서버가 채워 준다(받침대 조커는 없음)
  standsFor?: number;
}

export type RUPhase = 'waiting' | 'turn' | 'game_over';

export type RUMessageType =
  // 클라 → 서버
  | 'ru_join_game'
  | 'ru_fill_bots'
  | 'ru_start'
  | 'ru_rejoin'
  | 'ru_commit'
  | 'ru_draw'
  | 'ru_react'
  // 서버 → 클라
  | 'ru_player_joined'
  | 'ru_spectate_joined'
  | 'ru_game_state'
  | 'ru_event'
  | 'ru_game_over'
  | 'ru_player_disconnected'
  | 'ru_player_reconnected'
  | 'ru_session_expired'
  | 'ru_error';

export interface RUMessage {
  type: RUMessageType;
  payload?: unknown;
}

// 좌석 뷰 — 공개 정보만. 받침대 내용은 rackCount(개수)로만 보인다.
export interface RUPlayerView {
  seat: number;
  name: string;
  connected: boolean;
  bot: boolean;
  // 받침대에 남은 타일 수 (내용은 비공개)
  rackCount: number;
  // 등록(첫 내려놓기 30점)을 마쳤는지
  melded: boolean;
  // 누적 점수
  score: number;
}

export interface RULastAction {
  seat: number;
  name: string;
  message: string;
}

export interface RUResultRow {
  seat: number;
  score: number;
  detail?: string;
}

export interface RUResult {
  winnerSeats?: number[];
  winnerNames?: string[];
  rows?: RUResultRow[];
  message?: string;
}

// 서버가 상태 변경마다 보내는 개인화 전체 스냅샷.
// yourRack·yourMelded 는 본인 스냅샷에만 온다 — 타인·관전자에겐 키가 없다.
export interface RUGameState {
  gameId: string;
  // 사설 방 코드 (공용 로비는 '' 또는 생략)
  roomCode?: string;
  phase: RUPhase;
  hostSeat: number;
  yourSeat: number;
  spectators?: number;
  // 차례 마감 시각 (unixMillis, 없으면 0)
  endsAt: number;
  currentSeat: number;
  // 타일더미에 남은 타일 수
  poolLeft?: number;
  // 테이블 — 전원 공개
  sets?: RUTile[][];
  // 본인 받침대 — 관전자·타인 스냅샷에는 키가 없다
  yourRack?: RUTile[];
  // 본인 등록 여부 — 관전자·타인 스냅샷에는 키가 없다
  yourMelded?: boolean;
  players?: RUPlayerView[];
  lastAction?: RULastAction | null;
  result?: RUResult | null;
}

// 이벤트 kind 는 서버가 추가할 수 있어 열린 문자열로 둔다.
export interface RUEvent {
  kind: string;
  seat?: number;
  name?: string;
  message?: string;
}

export interface RUGameOverPayload {
  winnerSeats?: number[];
  winnerNames?: string[];
  rows?: RUResultRow[];
  message?: string;
}

// sessionStorage 키 — 값을 바꾸면 기존 재접속 세션이 끊기므로 불변
export const RU_SESSION_KEY = 'ru_session_id';

export const RU_MIN_PLAYERS = 2;
export const RU_MAX_PLAYERS = 4;
// ru_fill_bots 는 3인까지 채우고 즉시 시작한다
export const RU_BOT_FILL_TARGET = 3;

// 타일 106개 = 4색 × 1~13 × 2벌(104) + 조커 2개
export const RU_TILE_COUNT = 106;
export const RU_JOKER_COUNT = 2;
export const RU_START_TILES = 14;
export const RU_MAX_NUM = 13;
// 등록(첫 내려놓기) 최소 점수
export const RU_MELD_MIN = 30;
// 세트 최소 크기 / 그룹 최대 크기
export const RU_MIN_SET = 3;
export const RU_MAX_GROUP = 4;
// 정산 — 남은 조커는 50점, 등록도 못 한 사람은 벌점 100점
export const RU_JOKER_PENALTY = 50;
export const RU_NO_MELD_PENALTY = 100;
// 차례 제한 시간 (재배치가 오래 걸린다)
export const RU_TURN_SECONDS = 90;

// ---------- 타일 헬퍼 ----------

// 내부 인덱싱용 문자열 키. 와이어로 나갈 때는 원본 id 를 쓴다.
export function ruTileKey(tile: RUTile): string {
  return String(tile.id);
}

export function ruIsJoker(tile: RUTile): boolean {
  return tile.joker === true;
}

// 타일 한 장의 표기 — "빨강 7" / "조커(7 대신)" / "조커"
export function ruTileLabel(tile: RUTile): string {
  if (ruIsJoker(tile)) {
    const stands = tile.standsFor ?? 0;
    return stands > 0 ? `조커 (${stands} 대신)` : '조커';
  }
  return `${ruColorLabel(tile.color)} ${tile.num}`;
}

// ---------- 세트 판정 (순수 함수) ----------

export type RUSetKind = 'group' | 'run' | 'none';

export interface RUSetCheck {
  // 판정된 종류. 유효하지 않으면 'none'
  kind: RUSetKind;
  ok: boolean;
  // 붉게 표시할 때 함께 보여줄 한글 사유 (유효하면 종류 설명)
  reason: string;
  // 이 세트의 점수 (유효하지 않으면 0)
  score: number;
}

// 조커를 뺀 실제 타일들
function realTiles(tiles: RUTile[]): RUTile[] {
  return tiles.filter((t) => !ruIsJoker(t));
}

function jokerCount(tiles: RUTile[]): number {
  return tiles.filter(ruIsJoker).length;
}

// 그룹 — 색이 다른 같은 숫자 3~4개. 조커는 빠진 색을 메운다.
function checkGroup(tiles: RUTile[]): RUSetCheck {
  const fail = (reason: string): RUSetCheck => ({
    kind: 'none',
    ok: false,
    reason,
    score: 0,
  });
  const reals = realTiles(tiles);
  const jokers = jokerCount(tiles);

  if (tiles.length > RU_MAX_GROUP) {
    return fail(`그룹은 최대 ${RU_MAX_GROUP}개까지입니다 (색이 4종이라서)`);
  }
  if (reals.length === 0) {
    // 조커만 있는 세트 — 실제 덱(조커 2개)에서는 나올 수 없지만 방어
    return { kind: 'group', ok: true, reason: '조커 그룹', score: 0 };
  }

  const num = reals[0].num;
  if (reals.some((t) => t.num !== num)) {
    return fail('그룹은 숫자가 모두 같아야 합니다');
  }
  const colors = new Set(reals.map((t) => t.color));
  if (colors.size !== reals.length) {
    return fail('그룹은 색이 서로 달라야 합니다 (같은 색 중복 불가)');
  }
  if (colors.size + jokers > RU_MAX_GROUP) {
    return fail('그룹에 넣을 수 있는 색이 모자랍니다');
  }

  return {
    kind: 'group',
    ok: true,
    reason: `그룹 — ${num} ${tiles.length}개`,
    score: num * tiles.length,
  };
}

// 연속 — 같은 색, 이어지는 숫자 3개 이상. 조커는 빈자리를 메우거나
// 양 끝을 잇는다. 13 다음은 없고 1 앞도 없다.
function checkRun(tiles: RUTile[]): RUSetCheck {
  const fail = (reason: string): RUSetCheck => ({
    kind: 'none',
    ok: false,
    reason,
    score: 0,
  });
  const reals = realTiles(tiles);
  const jokers = jokerCount(tiles);

  if (reals.length === 0) {
    return { kind: 'run', ok: true, reason: '조커 연속', score: 0 };
  }

  const color = reals[0].color;
  if (reals.some((t) => t.color !== color)) {
    return fail('연속은 색이 모두 같아야 합니다');
  }
  const nums = reals.map((t) => t.num).sort((a, b) => a - b);
  if (nums.some((n) => n < 1 || n > RU_MAX_NUM)) {
    return fail(`연속의 숫자는 1~${RU_MAX_NUM} 범위여야 합니다`);
  }

  let gaps = 0;
  for (let i = 1; i < nums.length; i += 1) {
    const step = nums[i] - nums[i - 1];
    if (step === 0) return fail('연속에 같은 숫자가 두 번 들어갔습니다');
    gaps += step - 1;
  }
  if (gaps > jokers) {
    return fail('숫자가 이어지지 않습니다 (조커로도 빈자리를 못 메웁니다)');
  }

  const low = nums[0];
  const high = nums[nums.length - 1];
  // 빈자리를 메우고 남은 조커는 양 끝으로 뻗는다
  const spare = jokers - gaps;
  const roomBelow = low - 1;
  const roomAbove = RU_MAX_NUM - high;
  if (spare > roomBelow + roomAbove) {
    return fail(`연속이 1~${RU_MAX_NUM} 범위를 벗어납니다`);
  }

  // 조커가 어느 자리를 대신하는지는 놓는 사람이 정한다(스펙에 명시 없음).
  // 그래서 점수는 "가장 높게 잡히는 배치"로 센다 — 서버가 받아 줄 수 있는
  // 배치를 프론트가 미리 막아 버리는 쪽이 더 나쁘기 때문이다.
  // (반대로 후하게 셌다가 서버가 거부하면 통째로 되돌아가고, 화면은 그
  //  되돌아감을 이미 안내한다)
  const above = Math.min(spare, roomAbove);
  const start = low - (spare - above);
  const end = high + above;
  let score = 0;
  for (let n = start; n <= end; n += 1) score += n;

  return {
    kind: 'run',
    ok: true,
    reason: `연속 — ${ruColorLabel(color)} ${start}~${end}`,
    score,
  };
}

// 세트 하나를 판정한다. 그룹·연속 중 하나라도 성립하면 유효.
// 둘 다 성립하는 모호한 경우(예: 13 + 조커 2개)는 점수가 높은 해석을 쓴다 —
// 놓는 사람이 유리한 쪽으로 선언할 수 있다고 보는 것이다.
export function ruValidateSet(tiles: RUTile[]): RUSetCheck {
  const list = tiles ?? [];
  if (list.length === 0) {
    return { kind: 'none', ok: false, reason: '빈 세트', score: 0 };
  }
  if (list.length < RU_MIN_SET) {
    return {
      kind: 'none',
      ok: false,
      reason: `세트는 타일 ${RU_MIN_SET}개 이상이어야 합니다 (지금 ${list.length}개)`,
      score: 0,
    };
  }

  const group = checkGroup(list);
  const run = checkRun(list);
  if (group.ok && run.ok) return run.score > group.score ? run : group;
  if (group.ok) return group;
  if (run.ok) return run;

  // 사유는 더 그럴듯한 쪽을 보여 준다 — 같은 숫자가 섞여 있으면 그룹 사유로.
  const reals = realTiles(list);
  const sameNum =
    reals.length > 0 && reals.every((t) => t.num === reals[0].num);
  const sameColor =
    reals.length > 0 && reals.every((t) => t.color === reals[0].color);
  if (sameNum && !sameColor) return group;
  if (sameColor) return run;
  return {
    kind: 'none',
    ok: false,
    reason: '같은 숫자(그룹)도 아니고 이어지는 같은 색(연속)도 아닙니다',
    score: 0,
  };
}

// 세트 점수 — 조커는 그 자리 숫자로 친다.
// 서버가 standsFor 를 채워 준 조커는 그 값을 그대로 쓴다.
export function ruSetScore(tiles: RUTile[]): number {
  const list = tiles ?? [];
  const jokers = list.filter(ruIsJoker);
  if (jokers.length > 0 && jokers.every((t) => (t.standsFor ?? 0) > 0)) {
    return list.reduce(
      (sum, t) => sum + (ruIsJoker(t) ? (t.standsFor ?? 0) : t.num),
      0,
    );
  }
  return ruValidateSet(list).score;
}

// 테이블 전체가 유효한지 — 빈 세트는 무시한다(확정 시 어차피 빠진다).
export function ruBoardValid(sets: RUTile[][]): boolean {
  return (sets ?? [])
    .filter((s) => (s ?? []).length > 0)
    .every((s) => ruValidateSet(s).ok);
}

// 세트를 보기 좋은(그리고 서버가 읽기 쉬운) 순서로 정렬한다.
// 연속이면 숫자 오름차순 + 조커를 빈자리에 끼워 넣고, 그룹이면 색 순서.
// 와이어에 정렬 요구가 명시돼 있지 않아 서버가 순서 무관하게 읽는다고
// 가정하되, 사람이 읽을 수 있는 순서로 보내 준다.
export function ruCanonicalOrder(tiles: RUTile[]): RUTile[] {
  const list = [...(tiles ?? [])];
  const check = ruValidateSet(list);
  if (!check.ok) return list;

  const jokers = list.filter(ruIsJoker);
  const reals = realTiles(list);

  if (check.kind === 'group') {
    const order = (t: RUTile) => {
      const i = RU_COLORS.indexOf(t.color as RUColor);
      return i < 0 ? RU_COLORS.length : i;
    };
    return [...reals.sort((a, b) => order(a) - order(b)), ...jokers];
  }

  // 연속 — 숫자 순으로 놓고 빈자리에 조커를 채운다
  const sorted = [...reals].sort((a, b) => a.num - b.num);
  const pool = [...jokers];
  const out: RUTile[] = [];
  for (let i = 0; i < sorted.length; i += 1) {
    if (i > 0) {
      const gap = sorted[i].num - sorted[i - 1].num - 1;
      for (let g = 0; g < gap && pool.length > 0; g += 1) {
        out.push(pool.shift() as RUTile);
      }
    }
    out.push(sorted[i]);
  }
  // 남은 조커는 뒤(높은 쪽)에 붙인다 — 범위 검사는 이미 통과했다
  return [...out, ...pool];
}

// 타일 정렬 키 — 받침대 표시용 (색 → 숫자, 조커는 맨 뒤)
export function ruRackSortKey(tile: RUTile): number {
  if (ruIsJoker(tile)) return 9999;
  const colorIndex = RU_COLORS.indexOf(tile.color as RUColor);
  return (colorIndex < 0 ? RU_COLORS.length : colorIndex) * 100 + tile.num;
}

// 받침대에 남은 타일의 벌점 합 — 조커는 50점 (종료 화면 보조 표기용)
export function ruRackPenalty(tiles: RUTile[]): number {
  return (tiles ?? []).reduce(
    (sum, t) => sum + (ruIsJoker(t) ? RU_JOKER_PENALTY : t.num),
    0,
  );
}
