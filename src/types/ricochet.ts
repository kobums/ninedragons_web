// 리코셰 로봇 메시지·상태 타입 — 와이어 계약(spec-ricochet.md)과 1:1 대응.
// 메시지 타입명·payload 필드명은 백엔드와 공유하므로 변경 금지.
//
// 이 게임은 은닉이 없다 — 판·로봇·목표·외침이 전부 공개고 관전자도 같은
// 스냅샷을 받는다(yourSeat 만 -1). 그래서 "본인 전용" 필드가 하나도 없다.

// 로봇 4색 (와이어 값 그대로)
export type RRColor = 'red' | 'blue' | 'green' | 'yellow';

// 이동 방향 4종 (와이어 값 그대로)
export type RRDir = 'up' | 'right' | 'down' | 'left';

export type RRPhase =
  | 'waiting'
  // 판이 열려 아무도 아직 외치지 않은 상태 (푸는 중)
  | 'thinking'
  // 누군가 외쳐 60초 카운트다운이 도는 상태
  | 'bidding'
  // 가장 낮게 외친 사람이 증명하는 상태
  | 'demo'
  // 목표 하나가 끝나고 다음 목표로 넘어가기 직전
  | 'goal_end'
  | 'game_over';

export type RRMessageType =
  // 클라 → 서버
  | 'rr_join_game'
  | 'rr_fill_bots'
  | 'rr_start'
  | 'rr_rejoin'
  | 'rr_bid'
  | 'rr_demo'
  | 'rr_pass'
  | 'rr_react'
  // 서버 → 클라
  | 'rr_player_joined'
  | 'rr_spectate_joined'
  | 'rr_game_state'
  | 'rr_event'
  | 'rr_game_over'
  | 'rr_player_disconnected'
  | 'rr_player_reconnected'
  | 'rr_session_expired'
  | 'rr_error';

export interface RRMessage {
  type: RRMessageType;
  payload?: unknown;
}

// 판 위의 한 칸 (0-indexed, r = 행 위에서부터, c = 열 왼쪽부터)
export interface RRCell {
  r: number;
  c: number;
}

// 로봇 배치 — 색마다 한 칸. 서버가 일부 색을 빠뜨려 보내도 화면은 버텨야 한다.
export type RRRobots = Partial<Record<RRColor, RRCell>>;

// 목표 — 그 색 로봇이 그 칸에 도착해야 한다
export interface RRGoal extends RRCell {
  color: RRColor;
}

// 외침 — 낮은 순 정렬로 온다. 전원 공개.
export interface RRBid {
  seat: number;
  moves: number;
}

export interface RRPlayerView {
  seat: number;
  name: string;
  connected: boolean;
  bot: boolean;
  // 획득한 목표 카드 수
  score: number;
}

// 직전 증명 결과 — 성공/실패를 한 줄로 보여주는 용도
export interface RRLastResult {
  seat: number;
  name: string;
  ok: boolean;
  moves: number;
  message?: string;
}

export interface RRResult {
  winnerSeats?: number[];
  winnerNames?: string[];
  message?: string;
}

// 서버가 상태 변경마다 보내는 전체 스냅샷 (전원 동일 — 은닉 없음)
export interface RRGameState {
  gameId: string;
  // 사설 방 코드 (공용 로비는 '' 또는 생략)
  roomCode?: string;
  phase: RRPhase;
  hostSeat: number;
  // 관전자는 -1
  yourSeat: number;
  spectators?: number;
  // 단계 마감 시각 (unixMillis, 없으면 0)
  endsAt: number;
  // 지금이 몇 번째 목표인지 (0-indexed) / 전체 목표 수
  goalIndex: number;
  goalTotal: number;
  // 칸마다 상하좌우 벽 비트마스크 (RR_WALL_* 참조) — [행][열]
  walls?: number[][];
  robots?: RRRobots;
  goal?: RRGoal | null;
  // 낮은 순 정렬, 전원 공개
  bids?: RRBid[];
  // 지금 증명할 좌석 (없으면 -1)
  demoSeat: number;
  players?: RRPlayerView[];
  lastResult?: RRLastResult | null;
  result?: RRResult | null;
}

// 이벤트 kind 는 서버가 추가할 수 있어 열린 문자열로 둔다.
export interface RREvent {
  kind: string;
  seat?: number;
  name?: string;
  message?: string;
}

// rr_game_over 페이로드 — 종료 화면 자체는 마지막 스냅샷으로 그리고,
// 이 페이로드는 신호 + 승자 보조로만 쓴다.
export interface RRGameOverPayload {
  winnerSeats?: number[];
  winnerNames?: string[];
  message?: string;
}

// sessionStorage 키 — 값을 바꾸면 기존 재접속 세션이 끊기므로 불변
export const RR_SESSION_KEY = 'rr_session_id';

export const RR_BOARD_SIZE = 16;
// 혼자서도 연습으로 시작할 수 있다
export const RR_MIN_PLAYERS = 1;
export const RR_MAX_PLAYERS = 8;
// rr_fill_bots 는 3인까지 채우고 즉시 시작한다
export const RR_BOT_FILL_TARGET = 3;
// 외칠 수 있는 최소 수 (0수 외침은 의미가 없다)
export const RR_MIN_BID = 1;
// 스테퍼 상한 — 서버 BFS 상한(12)에 여유를 조금 둔다
export const RR_MAX_BID = 20;

// ---------------------------------------------------------------------------
// 벽 비트마스크
//   서버 walls[r][c] 한 칸의 상하좌우 벽 여부를 비트로 담는다.
//   위 1 · 오른쪽 2 · 아래 4 · 왼쪽 8 (시계 방향).
//   백엔드가 다른 순서를 쓰면 이 상수 네 개만 바꾸면 화면 전체가 따라온다.
// ---------------------------------------------------------------------------
export const RR_WALL_UP = 1;
export const RR_WALL_RIGHT = 2;
export const RR_WALL_DOWN = 4;
export const RR_WALL_LEFT = 8;

export const RR_WALL_BIT: Record<RRDir, number> = {
  up: RR_WALL_UP,
  right: RR_WALL_RIGHT,
  down: RR_WALL_DOWN,
  left: RR_WALL_LEFT,
};

export const RR_DIRS: readonly RRDir[] = ['up', 'right', 'down', 'left'];

export const RR_COLORS: readonly RRColor[] = ['red', 'blue', 'green', 'yellow'];

export const RR_OPPOSITE: Record<RRDir, RRDir> = {
  up: 'down',
  right: 'left',
  down: 'up',
  left: 'right',
};

// 행·열 증분 (r, c)
export const RR_DELTA: Record<RRDir, [number, number]> = {
  up: [-1, 0],
  right: [0, 1],
  down: [1, 0],
  left: [0, -1],
};

export const RR_COLOR_LABEL: Record<RRColor, string> = {
  red: '빨강',
  blue: '파랑',
  green: '초록',
  yellow: '노랑',
};

// 색만으로 구분되지 않게 로봇마다 글자를 박는다 (색약 대비)
export const RR_COLOR_GLYPH: Record<RRColor, string> = {
  red: '빨',
  blue: '파',
  green: '초',
  yellow: '노',
};

// 글자와 별개로 무늬도 하나씩 다르게 (아주 작은 칸에서 글자가 뭉갤 때 대비)
export const RR_COLOR_MARK: Record<RRColor, string> = {
  red: '▲',
  blue: '●',
  green: '■',
  yellow: '◆',
};

export const RR_DIR_LABEL: Record<RRDir, string> = {
  up: '위',
  right: '오른쪽',
  down: '아래',
  left: '왼쪽',
};

export const RR_DIR_ARROW: Record<RRDir, string> = {
  up: '↑',
  right: '→',
  down: '↓',
  left: '←',
};

export const RR_PHASE_LABEL: Record<RRPhase, string> = {
  waiting: '대기 중',
  thinking: '푸는 중',
  bidding: '외침 접수 중',
  demo: '증명 중',
  goal_end: '목표 정리 중',
  game_over: '게임 종료',
};

// 증명 이동 한 수 — rr_demo payload 의 원소
export interface RRMove {
  robot: RRColor;
  dir: RRDir;
}

// ---------------------------------------------------------------------------
// 정규화 — 서버가 필드를 빠뜨리거나 크기가 어긋나도 화면이 깨지지 않게 한다.
// ---------------------------------------------------------------------------

// 항상 16×16 숫자 격자를 돌려준다 (부족한 칸은 벽 없음 0)
export const rrWalls = (game: RRGameState | null): number[][] => {
  const raw = game?.walls;
  return Array.from({ length: RR_BOARD_SIZE }, (_, r) =>
    Array.from({ length: RR_BOARD_SIZE }, (_, c) => {
      const v = raw?.[r]?.[c];
      return typeof v === 'number' && Number.isFinite(v) ? v : 0;
    }),
  );
};

const inBoard = (cell: unknown): cell is RRCell => {
  if (!cell || typeof cell !== 'object') return false;
  const { r, c } = cell as RRCell;
  return (
    Number.isInteger(r) &&
    Number.isInteger(c) &&
    r >= 0 &&
    r < RR_BOARD_SIZE &&
    c >= 0 &&
    c < RR_BOARD_SIZE
  );
};

// 판 밖이거나 형태가 이상한 좌표는 통째로 버린다 (없는 로봇 취급)
export const rrRobots = (game: RRGameState | null): RRRobots => {
  const raw = game?.robots ?? {};
  const out: RRRobots = {};
  for (const color of RR_COLORS) {
    const cell = raw[color];
    if (inBoard(cell)) out[color] = { r: cell.r, c: cell.c };
  }
  return out;
};

export const rrGoal = (game: RRGameState | null): RRGoal | null => {
  const goal = game?.goal;
  if (!goal || !inBoard(goal)) return null;
  if (!RR_COLORS.includes(goal.color)) return null;
  return { color: goal.color, r: goal.r, c: goal.c };
};

// 낮은 순 정렬 (서버가 정렬해 보내지만 방어적으로 한 번 더)
export const rrBids = (game: RRGameState | null): RRBid[] =>
  [...(game?.bids ?? [])]
    .filter((b) => b && Number.isFinite(b.moves))
    .sort((a, b) => a.moves - b.moves || a.seat - b.seat);

export const rrCellKey = (r: number, c: number): string => `${r},${c}`;

// 중앙 2×2 는 진입 불가 (16×16 기준 행·열 7~8).
// 서버가 벽으로도 막아 두겠지만, 규칙 자체가 이러니 화면도 스스로 안다.
export const rrIsBlocked = (r: number, c: number): boolean =>
  r >= RR_BOARD_SIZE / 2 - 1 &&
  r <= RR_BOARD_SIZE / 2 &&
  c >= RR_BOARD_SIZE / 2 - 1 &&
  c <= RR_BOARD_SIZE / 2;

export const rrHasWall = (
  walls: number[][],
  r: number,
  c: number,
  dir: RRDir,
): boolean => ((walls[r]?.[c] ?? 0) & RR_WALL_BIT[dir]) !== 0;

// ---------------------------------------------------------------------------
// 미끄러짐 — 이 게임의 전부.
// 벽·다른 로봇·판 가장자리·중앙 막힌 구역에 걸릴 때까지 한 방향으로 미끄러진다.
// 서버 rrSlide 와 같은 규칙이어야 한다 (고스트 미리보기·증명 미리보기가 이 함수다).
// ---------------------------------------------------------------------------
export const rrSlide = (
  walls: number[][],
  robots: RRRobots,
  color: RRColor,
  dir: RRDir,
): RRCell | null => {
  const start = robots[color];
  if (!start) return null;

  const occupied = new Set<string>();
  for (const other of RR_COLORS) {
    if (other === color) continue;
    const cell = robots[other];
    if (cell) occupied.add(rrCellKey(cell.r, cell.c));
  }

  const [dr, dc] = RR_DELTA[dir];
  let { r, c } = start;
  // 최악의 경우에도 판 한 변을 넘길 수 없다 (무한 루프 방지)
  for (let step = 0; step < RR_BOARD_SIZE; step += 1) {
    if (rrHasWall(walls, r, c, dir)) break;
    const nr = r + dr;
    const nc = c + dc;
    if (nr < 0 || nr >= RR_BOARD_SIZE || nc < 0 || nc >= RR_BOARD_SIZE) break;
    if (rrIsBlocked(nr, nc)) break;
    if (occupied.has(rrCellKey(nr, nc))) break;
    // 서버가 벽을 한쪽 칸에만 새겨 보내도 막히도록 반대편도 본다
    if (rrHasWall(walls, nr, nc, RR_OPPOSITE[dir])) break;
    r = nr;
    c = nc;
  }
  return { r, c };
};

// 미끄러지며 지나가는 칸들 (출발 칸 제외, 도착 칸 포함) — 경로 표시용
export const rrPath = (
  from: RRCell,
  to: RRCell,
  dir: RRDir,
): RRCell[] => {
  const [dr, dc] = RR_DELTA[dir];
  const cells: RRCell[] = [];
  let { r, c } = from;
  for (let step = 0; step < RR_BOARD_SIZE; step += 1) {
    if (r === to.r && c === to.c) break;
    r += dr;
    c += dc;
    cells.push({ r, c });
  }
  return cells;
};

// 이동 목록을 차례대로 적용한 뒤의 로봇 배치
export const rrApplyMoves = (
  walls: number[][],
  base: RRRobots,
  moves: RRMove[],
): RRRobots => {
  let robots: RRRobots = { ...base };
  for (const move of moves) {
    const to = rrSlide(walls, robots, move.robot, move.dir);
    if (!to) continue;
    robots = { ...robots, [move.robot]: to };
  }
  return robots;
};

// 목표 달성 여부 — 그 색 로봇이 그 칸 위에 있는가
export const rrReached = (robots: RRRobots, goal: RRGoal | null): boolean => {
  if (!goal) return false;
  const cell = robots[goal.color];
  return !!cell && cell.r === goal.r && cell.c === goal.c;
};

// 좌표를 사람이 읽는 표기로 (열 A~P · 행 1~16)
export const rrCellLabel = (cell: RRCell): string =>
  `${String.fromCharCode(65 + cell.c)}${cell.r + 1}`;
