import { useEffect, useState } from 'react';
import type { GSCell, GSEvent, GSGameState, GSGhostView, GSSide } from '../../types/geister';
import './GSBoard.css';

const SIZE = 6;

interface GSBoardProps {
  game: GSGameState;
  lastEvent: GSEvent | null;
  onSubmitSetup: (goodCells: GSCell[]) => void;
  onMove: (from: GSCell, to: GSCell) => void;
  onEscape: (from: GSCell) => void;
}

const cellKey = (row: number, col: number) => `${row},${col}`;

// 내 진영이 항상 아래로 오도록 북쪽 시점은 180도 회전해 그린다
const flip = (side: GSSide, n: number) => (side === 'north' ? SIZE - 1 - n : n);

// 내 탈출구: 상대편 뒷줄 양 모서리
const myExits = (side: GSSide): GSCell[] => {
  const row = side === 'south' ? 0 : SIZE - 1;
  return [
    { row, col: 0 },
    { row, col: SIZE - 1 },
  ];
};

export function GSBoard({ game, lastEvent, onSubmitSetup, onMove, onEscape }: GSBoardProps) {
  const me = game.yourSide;
  const myTurn = game.phase === 'play' && game.currentSide === me;
  const inSetup = game.phase === 'setup' && !game.yourReady;

  // 배치 단계: 좋은 유령으로 고른 칸들
  const [goodPicks, setGoodPicks] = useState<Record<string, GSCell>>({});
  // 이동 단계: 선택한 내 유령
  const [selected, setSelected] = useState<GSCell | null>(null);

  useEffect(() => {
    setSelected(null);
  }, [game.phase, game.currentSide]);

  const ghostByCell: Record<string, GSGhostView> = {};
  for (const ghost of game.ghosts) {
    ghostByCell[cellKey(ghost.row, ghost.col)] = ghost;
  }

  const selectedGhost = selected ? ghostByCell[cellKey(selected.row, selected.col)] : null;
  const legalTargets = new Set<string>();
  if (myTurn && selected && selectedGhost) {
    for (const [dr, dc] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ]) {
      const row = selected.row + dr;
      const col = selected.col + dc;
      if (row < 0 || row >= SIZE || col < 0 || col >= SIZE) continue;
      const occupant = ghostByCell[cellKey(row, col)];
      if (occupant && occupant.side === me) continue;
      legalTargets.add(cellKey(row, col));
    }
  }
  const canEscape =
    myTurn &&
    selected &&
    selectedGhost?.good === true &&
    myExits(me).some((e) => e.row === selected.row && e.col === selected.col);

  const exitSet = new Set(myExits(me).map((e) => cellKey(e.row, e.col)));
  const eventCell =
    lastEvent?.kind === 'move' || lastEvent?.kind === 'capture'
      ? lastEvent.to
      : lastEvent?.kind === 'escape'
        ? lastEvent.from
        : undefined;

  const handleCellClick = (row: number, col: number) => {
    const ghost = ghostByCell[cellKey(row, col)];

    if (inSetup) {
      // 내 유령 칸을 탭해 좋은 유령(파랑) 지정을 토글
      if (!ghost || ghost.side !== me) return;
      setGoodPicks((prev) => {
        const key = cellKey(row, col);
        const next = { ...prev };
        if (next[key]) {
          delete next[key];
        } else if (Object.keys(next).length < 4) {
          next[key] = { row, col };
        }
        return next;
      });
      return;
    }

    if (!myTurn) return;

    if (ghost && ghost.side === me) {
      setSelected({ row, col });
      return;
    }
    if (selected && legalTargets.has(cellKey(row, col))) {
      onMove(selected, { row, col });
      setSelected(null);
    }
  };

  const opponentName = me === 'south' ? game.northName : game.southName;
  const myCaptured = me === 'south' ? game.capturedBySouth : game.capturedByNorth;
  const lostGhosts = me === 'south' ? game.capturedByNorth : game.capturedBySouth;

  const statusText = (() => {
    if (game.phase === 'setup') {
      if (!game.yourReady)
        return `좋은 유령(파랑)을 놓을 칸 4개를 골라주세요 (${Object.keys(goodPicks).length}/4)`;
      if (!game.opponentReady) return '상대가 배치하는 중...';
      return '배치 완료';
    }
    return myTurn ? '내 차례 — 유령을 골라 움직이세요' : `${opponentName}님의 차례...`;
  })();

  return (
    <div className="gs-board-page">
      <div className="gs-tray">
        <span className="gs-tray-label">잡힌 내 유령</span>
        <div className="gs-tray-ghosts">
          {lostGhosts.map((g, i) => (
            <span key={i} className={`gs-mini-ghost ${g.good ? 'good' : 'evil'}`} />
          ))}
        </div>
      </div>

      <div className="gs-grid">
        {Array.from({ length: SIZE }).map((_, displayRow) =>
          Array.from({ length: SIZE }).map((_, displayCol) => {
            const row = flip(me, displayRow);
            const col = flip(me, displayCol);
            const key = cellKey(row, col);
            const ghost = ghostByCell[key];
            const isMine = ghost?.side === me;
            const isGoodPick = inSetup && Boolean(goodPicks[key]);
            const classes = [
              'gs-cell',
              exitSet.has(key) ? 'exit' : '',
              selected && selected.row === row && selected.col === col ? 'selected' : '',
              legalTargets.has(key) ? 'target' : '',
              eventCell && eventCell.row === row && eventCell.col === col ? 'flash' : '',
            ]
              .filter(Boolean)
              .join(' ');

            return (
              <button
                key={key}
                type="button"
                className={classes}
                onClick={() => handleCellClick(row, col)}
              >
                {ghost && (
                  <span
                    className={[
                      'gs-ghost',
                      isMine ? 'mine' : 'theirs',
                      isMine && (isGoodPick || ghost.good) ? 'good' : '',
                      isMine && !isGoodPick && ghost.good === false && game.phase !== 'setup'
                        ? 'evil'
                        : '',
                      inSetup && isMine && !isGoodPick ? 'unset' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    👻
                  </span>
                )}
              </button>
            );
          }),
        )}
      </div>

      <div className="gs-tray">
        <span className="gs-tray-label">내가 잡은 유령</span>
        <div className="gs-tray-ghosts">
          {myCaptured.map((g, i) => (
            <span key={i} className={`gs-mini-ghost ${g.good ? 'good' : 'evil'}`} />
          ))}
        </div>
      </div>

      <div className="gs-status">{statusText}</div>

      {inSetup && (
        <button
          type="button"
          className="gs-action-button"
          disabled={Object.keys(goodPicks).length !== 4}
          onClick={() => onSubmitSetup(Object.values(goodPicks))}
        >
          배치 확정
        </button>
      )}
      {canEscape && selected && (
        <button type="button" className="gs-action-button" onClick={() => onEscape(selected)}>
          👻 탈출!
        </button>
      )}
    </div>
  );
}
