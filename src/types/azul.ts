// 아줄 메시지·상태 타입 — 와이어 계약(spec-azul.md)과 1:1 대응.
// 메시지 타입명·payload 필드명은 백엔드와 공유하므로 변경 금지.
//
// 용어는 한국어 정식 표기를 고정한다:
//   factory → 진열대 / center → 중앙 / pattern line → 패턴 라인 /
//   wall → 벽 / floor line → 바닥 라인 / first player marker → 선 플레이어 마커
// 와이어의 색 값은 영문 고정(blue yellow red black cyan)이고
// 화면 표기만 한국어(파랑·노랑·빨강·검정·하늘색)다.
//
// 이 게임은 은닉이 전혀 없다 — 관전자도 좌석 보유자와 같은 스냅샷을 받고
// yourSeat 만 -1 이다.

// 타일 5색. 배열 순서가 곧 벽의 기준 색 순서라 바꾸면 벽 배치가 틀어진다.
export type AZColor = 'blue' | 'yellow' | 'red' | 'black' | 'cyan';

// 바닥 라인에는 타일 5색 외에 선 플레이어 마커('first')가 섞여 들어온다
export type AZFloorTile = AZColor | 'first';

export type AZPhase = 'waiting' | 'drafting' | 'tiling' | 'game_over';

export type AZMessageType =
  // 클라 → 서버
  | 'az_join_game'
  | 'az_fill_bots'
  | 'az_start'
  | 'az_rejoin'
  | 'az_take'
  | 'az_react'
  // 서버 → 클라
  | 'az_player_joined'
  | 'az_spectate_joined'
  | 'az_game_state'
  | 'az_event'
  | 'az_game_over'
  | 'az_player_disconnected'
  | 'az_player_reconnected'
  | 'az_session_expired'
  | 'az_error';

export interface AZMessage {
  type: AZMessageType;
  payload?: unknown;
}

// az_take 의 from — 진열대는 "factory:N", 중앙은 "center"
export type AZSource = string;

export const azFactorySource = (index: number): AZSource => `factory:${index}`;
export const AZ_CENTER_SOURCE: AZSource = 'center';

// 패턴 라인 한 줄. color '' 는 빈 줄이다(와이어가 빈 문자열을 보낸다).
export interface AZPatternLine {
  color: AZColor | '';
  count: number;
}

// 좌석 뷰 — 아줄은 은닉이 없어 전원 동일한 값을 본다
export interface AZPlayerView {
  seat: number;
  name: string;
  connected: boolean;
  bot: boolean;
  score: number;
  // 패턴 라인 5줄 (위에서부터 1칸 → 5칸)
  lines?: AZPatternLine[];
  // 벽 5×5 채움 여부. 색은 좌표로 정해진다(azWallColor 참조)
  wall?: boolean[][];
  // 바닥 라인에 깔린 타일 (선 플레이어 마커는 'first')
  floor?: AZFloorTile[];
}

// 직전 수 — 상단에 한 줄로 흘려준다
export interface AZLastAction {
  seat: number;
  name: string;
  message: string;
}

// 라운드 정산 한 줄 — 벽에 붙여 얻은 점수 / 바닥 라인 감점 / 정산 후 총점
export interface AZRoundResultRow {
  seat: number;
  gained: number;
  penalty: number;
  total: number;
}

export interface AZRoundResult {
  rows?: AZRoundResultRow[];
  message?: string;
}

export interface AZResult {
  winnerSeats: number[];
  winnerNames: string[];
  message?: string;
}

// 서버가 상태 변경마다 보내는 전체 스냅샷
export interface AZGameState {
  gameId: string;
  // 사설 방 코드 (공용 로비는 '' 또는 생략)
  roomCode?: string;
  phase: AZPhase;
  hostSeat: number;
  yourSeat: number;
  spectators?: number;
  // 차례·단계 마감 시각 (unixMillis, 없으면 0)
  endsAt: number;
  round: number;
  currentSeat: number;
  // 선 플레이어 마커를 가져가 다음 라운드 선이 될 좌석 (없으면 -1)
  firstNextSeat: number;
  // 진열대별 남은 타일. 비면 []
  factories?: AZColor[][];
  // 중앙에 밀려난 타일. 비면 []
  center?: AZColor[];
  // 선 플레이어 마커가 아직 중앙에 남아 있는지
  centerHasFirst?: boolean;
  bagLeft: number;
  discardLeft: number;
  players?: AZPlayerView[];
  lastAction?: AZLastAction | null;
  roundResult?: AZRoundResult | null;
  result?: AZResult | null;
}

// 이벤트 kind 는 서버가 추가할 수 있어 열린 문자열로 둔다
export interface AZEvent {
  kind: string;
  seat?: number;
  name?: string;
  message?: string;
}

// az_game_over 페이로드 — 종료 화면 자체는 마지막 스냅샷으로 그리고
// 이 페이로드는 신호 + 승자 보조로만 쓴다
export interface AZGameOverPayload {
  winnerSeats?: number[];
  winnerNames?: string[];
  message?: string;
}

// sessionStorage 키 — 값을 바꾸면 기존 재접속 세션이 끊기므로 불변
export const AZ_SESSION_KEY = 'az_session_id';

export const AZ_MIN_PLAYERS = 2;
export const AZ_MAX_PLAYERS = 4;
// az_fill_bots 는 3인까지 채우고 즉시 시작한다
export const AZ_BOT_FILL_TARGET = 3;

// 인원별 진열대 수 (2인 5 / 3인 7 / 4인 9)
export const azFactoryCount = (players: number): number =>
  players >= 4 ? 9 : players === 3 ? 7 : 5;

// 진열대 하나에 채워지는 타일 수
export const AZ_FACTORY_SIZE = 4;

// 패턴 라인 5줄의 칸 수 (위에서부터)
export const AZ_LINE_SIZES: readonly number[] = [1, 2, 3, 4, 5];
export const AZ_LINE_COUNT = 5;
export const AZ_WALL_SIZE = 5;

// 전부 바닥 라인으로 버리는 선택 (az_take 의 line 값)
export const AZ_LINE_FLOOR = -1;

// 색 순서 = 벽 0행의 색 순서. 순서를 바꾸면 azWallColor 가 틀어진다.
export const AZ_COLORS: readonly AZColor[] = [
  'blue',
  'yellow',
  'red',
  'black',
  'cyan',
] as const;

// 화면 표기 (한국어 규칙서 기준 고정)
export const AZ_COLOR_LABEL: Record<AZColor, string> = {
  blue: '파랑',
  yellow: '노랑',
  red: '빨강',
  black: '검정',
  cyan: '하늘색',
};

// 색약 대비 — 색마다 다른 무늬 기호를 타일 위에 겹쳐 그린다.
// 색을 못 가려도 기호만으로 5종이 구분된다.
export const AZ_COLOR_GLYPH: Record<AZColor, string> = {
  blue: '◆',
  yellow: '●',
  red: '▲',
  black: '■',
  cyan: '✦',
};

// 선 플레이어 마커의 표기
export const AZ_FIRST_LABEL = '선 플레이어 마커';
export const AZ_FIRST_GLYPH = '1';

// 바닥 라인 감점표 — 8칸째부터는 -3 취급
export const AZ_FLOOR_PENALTIES: readonly number[] = [
  -1, -1, -2, -2, -2, -3, -3,
];
export const AZ_FLOOR_SLOTS = AZ_FLOOR_PENALTIES.length;

// 바닥 라인에 n장이 놓였을 때의 총 감점 (음수). 8장 이상은 넘친 만큼 -3.
export const azFloorPenalty = (count: number): number => {
  if (count <= 0) return 0;
  let sum = 0;
  for (let i = 0; i < count; i += 1) {
    sum += AZ_FLOOR_PENALTIES[i] ?? -3;
  }
  return sum;
};

// 한 칸의 감점값 (바닥 라인 슬롯 라벨용)
export const azFloorSlotPenalty = (index: number): number =>
  AZ_FLOOR_PENALTIES[index] ?? -3;

// 벽 배치는 고정 패턴이다 — 각 행이 색 순서를 한 칸씩 오른쪽으로 민다.
// 0행: 파랑 노랑 빨강 검정 하늘색 / 1행: 하늘색 파랑 노랑 빨강 검정 …
export const azWallColor = (row: number, col: number): AZColor =>
  AZ_COLORS[(((col - row) % 5) + 5) % 5];

// 그 행에서 해당 색이 들어갈 열
export const azWallCol = (row: number, color: AZColor): number =>
  (AZ_COLORS.indexOf(color) + row) % 5;

// 스냅샷이 부실해도 화면이 깨지지 않게 5줄/5×5/빈 배열로 정규화한다
export const azLines = (player?: AZPlayerView | null): AZPatternLine[] =>
  Array.from({ length: AZ_LINE_COUNT }, (_, i) => {
    const line = player?.lines?.[i];
    return {
      color: (line?.color ?? '') as AZColor | '',
      count: line?.count ?? 0,
    };
  });

export const azWall = (player?: AZPlayerView | null): boolean[][] =>
  Array.from({ length: AZ_WALL_SIZE }, (_, r) =>
    Array.from({ length: AZ_WALL_SIZE }, (_, c) => player?.wall?.[r]?.[c] === true),
  );

export const azFloor = (player?: AZPlayerView | null): AZFloorTile[] =>
  player?.floor ?? [];

// 한 출처에서 특정 색이 몇 장인지
export const azCountColor = (tiles: readonly AZColor[], color: AZColor): number =>
  tiles.filter((t) => t === color).length;

// 출처에 남은 색 목록 (색 순서 고정, 중복 제거)
export const azDistinctColors = (tiles: readonly AZColor[]): AZColor[] =>
  AZ_COLORS.filter((c) => tiles.includes(c));

// ---------------------------------------------------------------------------
// 배치 미리보기 — 이 게임의 판단은 "몇 장이 바닥 라인으로 가는가"가 전부다.
// 화면은 이 계산 결과만 보고 하이라이트·넘침 배지를 그린다.
// ---------------------------------------------------------------------------

export interface AZPlacement {
  // 패턴 라인 0~4, 또는 -1(전부 바닥 라인)
  line: number;
  // 이 줄에 놓을 수 있는지
  allowed: boolean;
  // 놓을 수 없는 이유 (한글, allowed 면 '')
  reason: string;
  // 패턴 라인에 실제로 놓이는 장수
  placed: number;
  // 바닥 라인으로 넘치는 장수 (선 플레이어 마커는 제외한 타일 수)
  overflow: number;
  // 이 수를 두고 난 뒤 바닥 라인의 총 장수 (선 마커 포함)
  floorAfter: number;
  // 이 수를 두고 난 뒤 바닥 라인이 물게 되는 총 감점 (음수)
  penaltyAfter: number;
  // 이번 수로 늘어나는 감점만 (음수)
  penaltyDelta: number;
  // 이 수로 줄이 꽉 차는지 (이번 라운드에 벽으로 올라간다)
  completes: boolean;
}

interface AZPlacementInput {
  lines: AZPatternLine[];
  wall: boolean[][];
  floor: AZFloorTile[];
  color: AZColor;
  // 가져오는 타일 장수
  count: number;
  // 이 수로 선 플레이어 마커까지 함께 가져가는지 (중앙 첫 취득)
  takesFirst: boolean;
}

// 패턴 라인 한 줄(또는 -1 = 전부 바닥)에 놓았을 때의 결과를 계산한다.
export const azEvaluatePlacement = (
  input: AZPlacementInput,
  line: number,
): AZPlacement => {
  const { lines, wall, floor, color, count, takesFirst } = input;
  const floorBefore = floor.length;
  const extraFirst = takesFirst ? 1 : 0;

  const build = (
    allowed: boolean,
    reason: string,
    placed: number,
    completes: boolean,
  ): AZPlacement => {
    const overflow = count - placed;
    const floorAfter = floorBefore + extraFirst + overflow;
    const penaltyAfter = azFloorPenalty(floorAfter);
    return {
      line,
      allowed,
      reason,
      placed,
      overflow,
      floorAfter,
      penaltyAfter,
      penaltyDelta: penaltyAfter - azFloorPenalty(floorBefore),
      completes,
    };
  };

  // 전부 바닥 라인으로 버리는 선택 — 언제나 가능하다
  if (line === AZ_LINE_FLOOR) {
    return build(true, '', 0, false);
  }

  if (line < 0 || line >= AZ_LINE_COUNT) {
    return build(false, '없는 줄입니다', 0, false);
  }

  const capacity = AZ_LINE_SIZES[line];
  const current = lines[line] ?? { color: '' as const, count: 0 };

  if (wall[line]?.[azWallCol(line, color)]) {
    return build(false, '벽에 이미 붙어 있는 색입니다', 0, false);
  }
  if (current.count > 0 && current.color !== color) {
    return build(false, '다른 색이 이미 놓인 줄입니다', 0, false);
  }
  if (current.count >= capacity) {
    return build(false, '이미 꽉 찬 줄입니다', 0, false);
  }

  const placed = Math.min(count, capacity - current.count);
  return build(true, '', placed, current.count + placed >= capacity);
};

// 패턴 라인 5줄 + 바닥(-1)의 미리보기를 한 번에.
// 반환 배열의 인덱스는 줄 번호와 같고, 마지막 원소가 바닥(-1)이다.
export const azEvaluateAll = (input: AZPlacementInput): AZPlacement[] => [
  ...Array.from({ length: AZ_LINE_COUNT }, (_, i) =>
    azEvaluatePlacement(input, i),
  ),
  azEvaluatePlacement(input, AZ_LINE_FLOOR),
];

// ---------------------------------------------------------------------------
// 최종 보너스 — 서버 점수에 이미 반영돼 있고, 종료 화면의 내역 표시용으로만 센다.
// ---------------------------------------------------------------------------

export const AZ_BONUS_ROW = 2;
export const AZ_BONUS_COL = 7;
export const AZ_BONUS_COLOR = 10;

export interface AZBonusBreakdown {
  rows: number;
  cols: number;
  colors: number;
  total: number;
}

export const azBonusBreakdown = (wall: boolean[][]): AZBonusBreakdown => {
  let rows = 0;
  let cols = 0;
  let colors = 0;

  for (let r = 0; r < AZ_WALL_SIZE; r += 1) {
    if (wall[r]?.every(Boolean)) rows += 1;
  }
  for (let c = 0; c < AZ_WALL_SIZE; c += 1) {
    let full = true;
    for (let r = 0; r < AZ_WALL_SIZE; r += 1) {
      if (!wall[r]?.[c]) full = false;
    }
    if (full) cols += 1;
  }
  for (const color of AZ_COLORS) {
    let full = true;
    for (let r = 0; r < AZ_WALL_SIZE; r += 1) {
      if (!wall[r]?.[azWallCol(r, color)]) full = false;
    }
    if (full) colors += 1;
  }

  return {
    rows,
    cols,
    colors,
    total:
      rows * AZ_BONUS_ROW + cols * AZ_BONUS_COL + colors * AZ_BONUS_COLOR,
  };
};

// 타일 한 장을 말로 읽은 문자열 (aria-label 용)
export const azTileLabel = (tile: AZFloorTile): string =>
  tile === 'first' ? AZ_FIRST_LABEL : AZ_COLOR_LABEL[tile];
