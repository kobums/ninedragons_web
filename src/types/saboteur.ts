// 사보타지 메시지·상태 타입 — 와이어 계약(spec-saboteur.md)과 1:1 대응.
// 메시지 타입명·payload 필드명은 백엔드와 공유하므로 변경 금지.
//
// ─────────────────────────────────────────────────────────────────────────
// 길 타일 덱 구성 (총 40장) — 서버가 진실이고 아래 표는 화면 안내용 참고치.
//
//   모양        통로(up/right/down/left)              장수
//   ─────────── ───────────────────────────────────── ────
//   십자        ○ ○ ○ ○                                5
//   직선(가로)  × ○ × ○                                5
//   직선(세로)  ○ × ○ ×                                4
//   굽이 4종    (↑→ / →↓ / ↓← / ←↑) 각 3장             12
//   T자 4종     (십자에서 한 방향 뺀 모양) 각 2장        8
//   막다른 4종  한 방향만 뚫린 채 중앙이 끊김 각 1장      4
//   막다른 굽이 두 방향이 뚫렸으나 중앙이 끊김           2
//   ─────────── ───────────────────────────────────── ────
//   합계                                               40
// ─────────────────────────────────────────────────────────────────────────

// 진영 — 광부(금까지 길을 잇는다) vs 파괴꾼(막는다)
export type SBRole = '' | 'miner' | 'saboteur';

export type SBPhase = 'waiting' | 'playing' | 'game_over';

// 장비 3종 — 하나라도 망가지면 길 타일을 놓을 수 없다
export type SBTool = 'pick' | 'cart' | 'lamp';

// 판 위 타일 종류 — 시작 / 놓인 길 / 목표(뒷면)
export type SBTileKind = 'start' | 'path' | 'goal';

// 손패 카드 종류 — 길 2종 + 행동 4종
export type SBCardKind =
  | 'path'
  | 'deadend'
  | 'map'
  | 'rockfall'
  | 'break'
  | 'repair';

export type SBDir = 'up' | 'right' | 'down' | 'left';

// 네 방향 통로 여부 — 길 타일 모양의 전부
export interface SBEdges {
  up: boolean;
  right: boolean;
  down: boolean;
  left: boolean;
}

// 판 위에 놓인 타일. goal 은 revealed 전까지 gold 키 자체가 없다.
export interface SBBoardTile extends SBEdges {
  col: number;
  row: number;
  kind: SBTileKind;
  // 목표 타일이 공개됐는지 (path/start 는 항상 공개 취급)
  revealed?: boolean;
  // 공개된 목표 타일만 — 금이면 true
  gold?: boolean;
  // 막다른 타일이면 true (통로가 중앙에서 끊겨 뒤로 이어지지 않는다).
  // 서버가 안 보내면 프론트는 이어진 타일로 낙관 취급한다 — 최종 판정은 서버.
  dead?: boolean;
}

// 손패 카드. 길 카드만 up/right/down/left·flipable, 행동 카드만 tool.
export interface SBHandCard extends Partial<SBEdges> {
  kind: SBCardKind;
  // break/repair 카드가 고정 대상 장비를 지정할 때 (없으면 사용자가 고른다)
  tool?: SBTool;
  // 180° 회전이 의미 있는 모양인지 (대칭 타일은 false)
  flipable?: boolean;
}

// 장비 상태 — false = 망가짐
export interface SBTools {
  pick: boolean;
  cart: boolean;
  lamp: boolean;
}

// 좌석 뷰 — role 은 게임 종료 시에만 채워진다 (그 전에는 전원 '').
export interface SBPlayerView {
  seat: number;
  name: string;
  connected: boolean;
  bot: boolean;
  handCount: number;
  tools?: SBTools;
  role?: SBRole;
}

// 직전 행동 한 줄 — 서버가 조립한 문구를 그대로 보여준다
export interface SBLastAction {
  seat: number;
  name: string;
  message: string;
}

export type SBWinner = 'miner' | 'saboteur';

export interface SBResult {
  winner: SBWinner;
  // 금덩이가 있던 목표 타일 인덱스 (0~2 — SB_GOALS 순서)
  goldIndex: number;
  message?: string;
}

// 서버가 상태 변경마다 보내는 개인화 전체 스냅샷 (은닉형 —
// yourRole·yourHand 는 본인 스냅샷에만 오고 타인·관전자에게는 키 자체가 없다)
export interface SBGameState {
  gameId: string;
  // 사설 방 코드 (공용 로비는 '' 또는 생략)
  roomCode?: string;
  phase: SBPhase;
  hostSeat: number;
  yourSeat: number;
  spectators?: number;
  // 차례 마감 시각 (unixMillis, 없으면 0)
  endsAt: number;
  currentSeat: number;
  // 덱에 남은 장수 (0이면 뽑지 못한다)
  deckLeft: number;
  board?: SBBoardTile[];
  // 본인 역할 (관전자는 부재)
  yourRole?: SBRole;
  // 본인 손패 (관전자는 부재)
  yourHand?: SBHandCard[];
  players?: SBPlayerView[];
  lastAction?: SBLastAction | null;
  result?: SBResult | null;
}

// 이벤트 kind 는 서버가 추가할 수 있어 열린 문자열로 둔다.
export interface SBEvent {
  kind: string;
  seat?: number;
  name?: string;
  message?: string;
}

// 개인 이벤트 sb_map — 지도 카드를 쓴 사람에게만 온다
export interface SBMapReveal {
  // 목표 타일 인덱스 (0~2 — SB_GOALS 순서)
  index: number;
  gold: boolean;
}

// sb_game_over 페이로드 — 종료 화면 자체는 마지막 스냅샷으로 그리고
// 이 페이로드는 신호+승자 보조로만 쓴다.
export interface SBGameOverPayload {
  winner?: SBWinner;
  goldIndex?: number;
  message?: string;
}

export type SBMessageType =
  // 클라 → 서버
  | 'sb_join_game'
  | 'sb_fill_bots'
  | 'sb_start'
  | 'sb_rejoin'
  | 'sb_place'
  | 'sb_action'
  | 'sb_discard'
  | 'sb_react'
  // 서버 → 클라
  | 'sb_player_joined'
  | 'sb_spectate_joined'
  | 'sb_game_state'
  | 'sb_event'
  | 'sb_map'
  | 'sb_game_over'
  | 'sb_player_disconnected'
  | 'sb_player_reconnected'
  | 'sb_session_expired'
  | 'sb_error';

export interface SBMessage {
  type: SBMessageType;
  payload?: unknown;
}

// sessionStorage 키 — 값을 바꾸면 기존 재접속 세션이 끊기므로 불변
export const SB_SESSION_KEY = 'sb_session_id';

export const SB_MIN_PLAYERS = 3;
export const SB_MAX_PLAYERS = 10;
// sb_fill_bots 는 5인까지 채우고 즉시 시작한다
export const SB_BOT_FILL_TARGET = 5;

// 판 크기 — 가로 9칸 × 세로 5칸
export const SB_COLS = 9;
export const SB_ROWS = 5;

// 시작 타일 (사방이 뚫려 있고 처음부터 놓여 있다)
export const SB_START_COL = 0;
export const SB_START_ROW = 2;

// 목표 타일 3장 — 이 순서가 곧 goldIndex / sb_map 의 index
export const SB_GOALS: ReadonlyArray<{ col: number; row: number }> = [
  { col: 8, row: 0 },
  { col: 8, row: 2 },
  { col: 8, row: 4 },
];

export const SB_GOAL_LABEL = ['위쪽 목적지', '가운데 목적지', '아래쪽 목적지'];

// 인원별 파괴꾼 수 — 역할 풀에서 인원수만큼만 뽑으므로 실제 구성은 확정되지 않는다
export const SB_SABOTEUR_COUNT: Record<number, number> = {
  3: 1,
  4: 1,
  5: 2,
  6: 2,
  7: 3,
  8: 3,
  9: 3,
  10: 3,
};

export const SB_ROLE_LABEL: Record<Exclude<SBRole, ''>, string> = {
  miner: '광부',
  saboteur: '방해꾼',
};

export const SB_ROLE_ICON: Record<Exclude<SBRole, ''>, string> = {
  miner: '⛏',
  saboteur: '💣',
};

export const SB_TOOL_LABEL: Record<SBTool, string> = {
  pick: '곡괭이',
  cart: '수레',
  lamp: '등불',
};

export const SB_TOOL_ICON: Record<SBTool, string> = {
  pick: '⛏',
  cart: '🛒',
  lamp: '🏮',
};

export const SB_TOOLS: ReadonlyArray<SBTool> = ['pick', 'cart', 'lamp'];

export const SB_CARD_LABEL: Record<SBCardKind, string> = {
  path: '굴 카드',
  deadend: '막다른 길',
  map: '지도',
  rockfall: '낙석',
  break: '부서진 도구',
  repair: '수리',
};

export const SB_CARD_ICON: Record<SBCardKind, string> = {
  path: '🛤',
  deadend: '⛔',
  map: '🗺',
  rockfall: '🪨',
  break: '🔨',
  repair: '🔧',
};

export const SB_CARD_DESC: Record<SBCardKind, string> = {
  path: '이어진 길 끝에 놓습니다 — 모든 인접 변이 맞아야 합니다',
  deadend: '중앙이 끊긴 굴 카드 — 놓을 수는 있지만 길이 이어지지 않습니다',
  map: '목적지 카드 1장을 나만 몰래 확인합니다',
  rockfall: '이미 놓인 굴 카드 1장을 걷어냅니다 (시작·목적지는 불가)',
  break: '상대의 도구 하나를 망가뜨립니다',
  repair: '부서진 도구 하나를 고칩니다 (자신도 가능)',
};

// 길 카드인지 (판에 놓는 카드)
export const sbIsPathCard = (card: SBHandCard): boolean =>
  card.kind === 'path' || card.kind === 'deadend';

// ==================== 경로 연결 판정 (서버 미러 — 후보 칸 표시용) ====================
// 최종 판정은 언제나 서버(sbCanPlace)다. 프론트는 조작을 쉽게 하려고
// 같은 규칙을 복제해 "놓을 수 있어 보이는 칸"만 좁혀 준다.

export const sbKey = (col: number, row: number): string => `${col},${row}`;

const OPPOSITE: Record<SBDir, SBDir> = {
  up: 'down',
  right: 'left',
  down: 'up',
  left: 'right',
};

const DELTA: Record<SBDir, { col: number; row: number }> = {
  up: { col: 0, row: -1 },
  right: { col: 1, row: 0 },
  down: { col: 0, row: 1 },
  left: { col: -1, row: 0 },
};

export const SB_DIRS: ReadonlyArray<SBDir> = ['up', 'right', 'down', 'left'];

// 180° 회전 — 상하·좌우가 맞바뀐다
export const sbFlipEdges = (edges: SBEdges, flip: boolean): SBEdges =>
  flip
    ? {
        up: edges.down,
        right: edges.left,
        down: edges.up,
        left: edges.right,
      }
    : { ...edges };

// 손패 카드 → 모양 (누락 필드는 벽으로 본다)
export const sbCardEdges = (card: SBHandCard, flip = false): SBEdges =>
  sbFlipEdges(
    {
      up: card.up === true,
      right: card.right === true,
      down: card.down === true,
      left: card.left === true,
    },
    flip,
  );

export const sbBoardMap = (
  board: SBBoardTile[],
): Map<string, SBBoardTile> => {
  const map = new Map<string, SBBoardTile>();
  for (const tile of board) map.set(sbKey(tile.col, tile.row), tile);
  return map;
};

export const sbInBounds = (col: number, row: number): boolean =>
  col >= 0 && col < SB_COLS && row >= 0 && row < SB_ROWS;

// 뒷면 목표 타일은 "느슨하게" 다룬다 — 원작대로 길이 닿으면 공개하면서
// 모양을 맞춰 주므로, 인접 변 일치를 따지지 않고 연결도 전파하지 않는다.
const isFaceDownGoal = (tile: SBBoardTile): boolean =>
  tile.kind === 'goal' && tile.revealed !== true;

// 시작 타일에서 실제 통로로 이어진 칸 집합 (BFS).
// 막다른 타일과 공개된 목표 타일은 "들어갈 수는 있어도 나올 수는 없는" 끝점이다.
export const sbConnectedSet = (board: SBBoardTile[]): Set<string> => {
  const map = sbBoardMap(board);
  const start =
    map.get(sbKey(SB_START_COL, SB_START_ROW)) ??
    board.find((t) => t.kind === 'start');
  if (!start) return new Set<string>();

  const seen = new Set<string>([sbKey(start.col, start.row)]);
  const queue: SBBoardTile[] = [start];
  while (queue.length > 0) {
    const cur = queue.shift() as SBBoardTile;
    // 끝점에서는 더 뻗지 않는다
    if (cur !== start && (cur.dead === true || cur.kind === 'goal')) continue;
    for (const dir of SB_DIRS) {
      if (!cur[dir]) continue;
      const d = DELTA[dir];
      const nc = cur.col + d.col;
      const nr = cur.row + d.row;
      if (!sbInBounds(nc, nr)) continue;
      const key = sbKey(nc, nr);
      if (seen.has(key)) continue;
      const next = map.get(key);
      if (!next) continue;
      // 뒷면 목표는 모양이 맞춰지므로 통로가 닿기만 하면 도달로 본다
      if (!isFaceDownGoal(next) && !next[OPPOSITE[dir]]) continue;
      seen.add(key);
      queue.push(next);
    }
  }
  return seen;
};

// 이 칸에 이 모양을 놓을 수 있는가 (서버 sbCanPlace 미러).
// 1) 판 안 + 빈 칸  2) 인접 변 일치  3) 이어진 길과 통로로 맞닿기
export const sbCanPlace = (
  board: SBBoardTile[],
  edges: SBEdges,
  col: number,
  row: number,
  connected?: Set<string>,
): boolean => {
  if (!sbInBounds(col, row)) return false;
  const map = sbBoardMap(board);
  if (map.has(sbKey(col, row))) return false;

  const reach = connected ?? sbConnectedSet(board);
  let touches = false;

  for (const dir of SB_DIRS) {
    const d = DELTA[dir];
    const nc = col + d.col;
    const nr = row + d.row;
    if (!sbInBounds(nc, nr)) continue;
    const neighbor = map.get(sbKey(nc, nr));
    if (!neighbor) continue;

    // 뒷면 목표 타일은 이웃 규칙에서 제외 (공개 시 모양 보정)
    if (isFaceDownGoal(neighbor)) {
      if (edges[dir]) touches = true;
      continue;
    }
    // 통로↔통로 / 벽↔벽 으로 일치해야 한다
    if (edges[dir] !== neighbor[OPPOSITE[dir]]) return false;
    // 이어진 길과 통로로 맞닿아야 한다
    if (edges[dir] && reach.has(sbKey(nc, nr))) touches = true;
  }

  return touches;
};

// 지금 이 모양으로 놓을 수 있는 모든 칸의 키 집합
export const sbPlaceableCells = (
  board: SBBoardTile[],
  edges: SBEdges,
): Set<string> => {
  const connected = sbConnectedSet(board);
  const cells = new Set<string>();
  for (let row = 0; row < SB_ROWS; row++) {
    for (let col = 0; col < SB_COLS; col++) {
      if (sbCanPlace(board, edges, col, row, connected)) {
        cells.add(sbKey(col, row));
      }
    }
  }
  return cells;
};

// 장비가 하나라도 망가지면 길 타일을 놓을 수 없다
export const sbToolsOk = (tools?: SBTools): boolean =>
  tools ? tools.pick && tools.cart && tools.lamp : true;

export const sbBrokenTools = (tools?: SBTools): SBTool[] =>
  tools ? SB_TOOLS.filter((t) => !tools[t]) : [];
