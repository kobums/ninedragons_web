import type { OmokCell, OmokColor, OmokEvent, OmokGameState, OmokStone } from '../../types/omok';
import { OMOK_BOARD_SIZE } from '../../types/omok';
import './OmokBoard.css';

const SIZE = OMOK_BOARD_SIZE;

const cellKey = (row: number, col: number) => `${row},${col}`;

// 15줄 바둑판의 화점 — 네 귀 (4번째 줄) + 천원
const HOSHI = new Set([
  cellKey(3, 3),
  cellKey(3, 11),
  cellKey(11, 3),
  cellKey(11, 11),
  cellKey(7, 7),
]);

// ==================== 순수 바둑판 (플레이 화면·종료 화면 공용) ====================
// 격자 선은 각 교차점 버튼의 ::before(가로)/::after(세로)로 긋는다 —
// 가장자리 교차점은 edge-* 클래스로 선을 중앙에서 끊어 반선만 남긴다.

interface OmokGridProps {
  board: OmokStone[][];
  lastMove: OmokCell | null;
  // 승리 5목 좌표 (게임 종료 화면에서만 전달)
  winLine?: OmokCell[];
  // 내 차례 — 빈 교차점 클릭 가능 + 호버 미리보기
  canPlay: boolean;
  myColor?: OmokColor;
  onPlace?: (row: number, col: number) => void;
}

export function OmokGrid({ board, lastMove, winLine, canPlay, myColor, onPlace }: OmokGridProps) {
  const winSet = new Set((winLine ?? []).map((c) => cellKey(c.row, c.col)));

  const gridClasses = ['omok-grid', canPlay && myColor ? `playable ${myColor}-turn` : '']
    .filter(Boolean)
    .join(' ');

  return (
    <div className={gridClasses}>
      {Array.from({ length: SIZE }).map((_, row) =>
        Array.from({ length: SIZE }).map((_, col) => {
          const key = cellKey(row, col);
          const stone = board[row]?.[col] ?? 0;
          const pointClasses = [
            'omok-point',
            row === 0 ? 'edge-top' : '',
            row === SIZE - 1 ? 'edge-bottom' : '',
            col === 0 ? 'edge-left' : '',
            col === SIZE - 1 ? 'edge-right' : '',
          ]
            .filter(Boolean)
            .join(' ');

          const stoneClasses =
            stone !== 0
              ? [
                  'omok-stone',
                  stone === 1 ? 'black' : 'white',
                  lastMove && lastMove.row === row && lastMove.col === col ? 'last' : '',
                  winSet.has(key) ? 'win' : '',
                ]
                  .filter(Boolean)
                  .join(' ')
              : '';

          return (
            <button
              key={key}
              type="button"
              className={pointClasses}
              disabled={!canPlay || stone !== 0}
              aria-label={`${row + 1}행 ${col + 1}열`}
              onClick={() => {
                if (canPlay && stone === 0) onPlace?.(row, col);
              }}
            >
              {HOSHI.has(key) && <span className="omok-hoshi" />}
              {stone !== 0 && <span className={stoneClasses} />}
            </button>
          );
        }),
      )}
    </div>
  );
}

// ==================== 플레이 화면 ====================

interface OmokBoardProps {
  game: OmokGameState;
  lastEvent: OmokEvent | null;
  onPlace: (row: number, col: number) => void;
}

export function OmokBoard({ game, lastEvent, onPlace }: OmokBoardProps) {
  const myTurn = game.currentColor === game.yourColor;
  const opponentName = game.yourColor === 'black' ? game.whiteName : game.blackName;

  const statusText = myTurn
    ? '내 차례 — 빈 교차점을 눌러 돌을 놓으세요'
    : `${opponentName}님의 차례...`;

  const seat = (color: OmokColor, name: string) => (
    <div className={`omok-seat${game.currentColor === color ? ' active' : ''}`}>
      <span className={`omok-seat-stone ${color}`} />
      <span className="omok-seat-name">
        {name}
        {game.yourColor === color ? ' (나)' : ''}
      </span>
    </div>
  );

  return (
    <div className="omok-board-page">
      <div className="omok-seats">
        {seat('black', game.blackName)}
        <span className="omok-move-count">{game.moveCount}수</span>
        {seat('white', game.whiteName)}
      </div>

      <OmokGrid
        board={game.board}
        lastMove={game.lastMove}
        canPlay={myTurn}
        myColor={game.yourColor}
        onPlace={onPlace}
      />

      <div className={`omok-status${myTurn ? ' my-turn' : ''}`}>
        {lastEvent ? lastEvent.message : statusText}
      </div>
    </div>
  );
}
