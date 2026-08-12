import { useEffect, useState } from 'react';
import type {
  QDCell,
  QDEvent,
  QDGameState,
  QDOrientation,
  QDSide,
  QDWall,
} from '../../types/quoridor';
import './QDBoard.css';

const SIZE = 9;

// 내 진영이 항상 아래로 오도록 북쪽 시점은 180도 회전해 그린다
const flipCell = (side: QDSide, n: number) => (side === 'north' ? SIZE - 1 - n : n);
// 벽 앵커(0~7)의 회전 대응 (자기역원)
const flipAnchor = (side: QDSide, n: number) => (side === 'north' ? SIZE - 2 - n : n);

const cellKey = (row: number, col: number) => `${row},${col}`;

// ==================== 벽 규칙 (서버 미러 — 놓을 수 있는 슬롯 표시용) ====================

const overlapsWall = (walls: QDWall[], w: QDWall) =>
  walls.some((x) => {
    if (x.orientation === w.orientation) {
      if (w.orientation === 'h') return x.row === w.row && Math.abs(x.col - w.col) <= 1;
      return x.col === w.col && Math.abs(x.row - w.row) <= 1;
    }
    // 같은 교차점의 가로·세로는 교차
    return x.row === w.row && x.col === w.col;
  });

// 인접 두 칸 사이가 벽으로 막혔는지
const blockedBetween = (walls: QDWall[], a: QDCell, b: QDCell) => {
  if (a.row !== b.row) {
    const upper = Math.min(a.row, b.row);
    return walls.some(
      (w) => w.orientation === 'h' && w.row === upper && (w.col === a.col || w.col === a.col - 1),
    );
  }
  const left = Math.min(a.col, b.col);
  return walls.some(
    (w) => w.orientation === 'v' && w.col === left && (w.row === a.row || w.row === a.row - 1),
  );
};

const DIRS: QDCell[] = [
  { row: -1, col: 0 },
  { row: 1, col: 0 },
  { row: 0, col: -1 },
  { row: 0, col: 1 },
];

const hasPath = (walls: QDWall[], start: QDCell, goalRow: number) => {
  const visited = new Set<string>([cellKey(start.row, start.col)]);
  const queue: QDCell[] = [start];
  while (queue.length > 0) {
    const cur = queue.shift() as QDCell;
    if (cur.row === goalRow) return true;
    for (const d of DIRS) {
      const next = { row: cur.row + d.row, col: cur.col + d.col };
      const key = cellKey(next.row, next.col);
      if (next.row < 0 || next.row >= SIZE || next.col < 0 || next.col >= SIZE) continue;
      if (visited.has(key) || blockedBetween(walls, cur, next)) continue;
      visited.add(key);
      queue.push(next);
    }
  }
  return false;
};

// 겹침·교차가 없고 양쪽 경로를 완전히 막지 않아야 놓을 수 있다
const canPlaceWall = (game: QDGameState, w: QDWall) => {
  if (overlapsWall(game.walls, w)) return false;
  const candidate = [...game.walls, w];
  return hasPath(candidate, game.southPawn, 0) && hasPath(candidate, game.northPawn, SIZE - 1);
};

// ==================== 그리드 배치 (17×17: 칸 9 + 홈 8) ====================

const cellStyle = (dr: number, dc: number) => ({
  gridRow: `${dr * 2 + 1}`,
  gridColumn: `${dc * 2 + 1}`,
});

const wallStyle = (orientation: QDOrientation, dr: number, dc: number) =>
  orientation === 'h'
    ? { gridRow: `${dr * 2 + 2}`, gridColumn: `${dc * 2 + 1} / ${dc * 2 + 4}` }
    : { gridColumn: `${dc * 2 + 2}`, gridRow: `${dr * 2 + 1} / ${dr * 2 + 4}` };

const wallEq = (a: QDWall, b: QDWall) =>
  a.row === b.row && a.col === b.col && a.orientation === b.orientation;

interface QDBoardProps {
  game: QDGameState;
  lastEvent: QDEvent | null;
  onMove: (to: QDCell) => void;
  onPlaceWall: (wall: QDWall) => void;
}

export function QDBoard({ game, lastEvent, onMove, onPlaceWall }: QDBoardProps) {
  const me = game.yourSide;
  const myTurn = game.phase === 'play' && game.currentSide === me;
  // 'move' 폰 이동 | 'h'/'v' 벽 설치 모드
  const [mode, setMode] = useState<'move' | QDOrientation>('move');

  useEffect(() => {
    setMode('move');
  }, [game.currentSide]);

  const myWallsLeft = me === 'south' ? game.southWalls : game.northWalls;
  const oppWallsLeft = me === 'south' ? game.northWalls : game.southWalls;
  const opponentName = me === 'south' ? game.northName : game.southName;

  const legalTargets = new Set(
    myTurn && mode === 'move' ? game.legalMoves.map((m) => cellKey(m.row, m.col)) : [],
  );

  // 벽 모드: 지금 놓을 수 있는 앵커만 슬롯으로 보여준다
  const slots: QDWall[] = [];
  if (myTurn && mode !== 'move' && myWallsLeft > 0) {
    for (let r = 0; r < SIZE - 1; r++) {
      for (let c = 0; c < SIZE - 1; c++) {
        const w: QDWall = { row: r, col: c, orientation: mode };
        if (canPlaceWall(game, w)) slots.push(w);
      }
    }
  }

  const eventCell = lastEvent?.kind === 'move' ? lastEvent.to : undefined;

  const statusText = myTurn
    ? mode === 'move'
      ? '내 차례 — 이동할 칸을 고르거나 벽 모드를 켜세요'
      : '벽을 놓을 자리를 고르세요'
    : `${opponentName}님의 차례...`;

  return (
    <div className="qd-board-page">
      <div className="qd-tray">
        <span className="qd-tray-label">상대 벽 {oppWallsLeft}</span>
        <div className="qd-tray-walls">
          {Array.from({ length: oppWallsLeft }).map((_, i) => (
            <span key={i} className="qd-mini-wall" />
          ))}
        </div>
      </div>

      <div className="qd-grid">
        {Array.from({ length: SIZE }).map((_, dr) =>
          Array.from({ length: SIZE }).map((_, dc) => {
            const row = flipCell(me, dr);
            const col = flipCell(me, dc);
            const key = cellKey(row, col);
            const hasSouth = game.southPawn.row === row && game.southPawn.col === col;
            const hasNorth = game.northPawn.row === row && game.northPawn.col === col;
            const classes = [
              'qd-cell',
              dr === 0 ? 'goal' : '',
              legalTargets.has(key) ? 'legal' : '',
              eventCell && eventCell.row === row && eventCell.col === col ? 'flash' : '',
            ]
              .filter(Boolean)
              .join(' ');

            return (
              <button
                key={key}
                type="button"
                className={classes}
                style={cellStyle(dr, dc)}
                onClick={() => {
                  if (legalTargets.has(key)) onMove({ row, col });
                }}
              >
                {hasSouth && <span className="qd-pawn south" />}
                {hasNorth && <span className="qd-pawn north" />}
              </button>
            );
          }),
        )}

        {game.walls.map((w, i) => {
          const isFlash = lastEvent?.kind === 'wall' && lastEvent.wall && wallEq(lastEvent.wall, w);
          return (
            <div
              key={`wall-${i}`}
              className={`qd-wall${isFlash ? ' flash' : ''}`}
              style={wallStyle(w.orientation, flipAnchor(me, w.row), flipAnchor(me, w.col))}
            />
          );
        })}

        {slots.map((w) => (
          <button
            key={`slot-${w.orientation}-${w.row}-${w.col}`}
            type="button"
            className={`qd-slot ${w.orientation}`}
            style={wallStyle(w.orientation, flipAnchor(me, w.row), flipAnchor(me, w.col))}
            onClick={() => onPlaceWall(w)}
          />
        ))}
      </div>

      <div className="qd-tray">
        <span className="qd-tray-label">내 벽 {myWallsLeft}</span>
        <div className="qd-tray-walls">
          {Array.from({ length: myWallsLeft }).map((_, i) => (
            <span key={i} className="qd-mini-wall" />
          ))}
        </div>
      </div>

      <div className="qd-status">{statusText}</div>

      {myTurn && (
        <div className="qd-mode-row">
          <button
            type="button"
            className={`qd-mode-button${mode === 'move' ? ' active' : ''}`}
            onClick={() => setMode('move')}
          >
            폰 이동
          </button>
          <button
            type="button"
            className={`qd-mode-button${mode === 'h' ? ' active' : ''}`}
            disabled={myWallsLeft === 0}
            onClick={() => setMode('h')}
          >
            가로 벽
          </button>
          <button
            type="button"
            className={`qd-mode-button${mode === 'v' ? ' active' : ''}`}
            disabled={myWallsLeft === 0}
            onClick={() => setMode('v')}
          >
            세로 벽
          </button>
        </div>
      )}
    </div>
  );
}
