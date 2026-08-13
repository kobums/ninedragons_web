import { useEffect, useState } from 'react';
import type { OTCell, OTEvent, OTGameState, OTSide } from '../../types/onitama';
import { OT_CARDS } from '../../types/onitama';
import './OTBoard.css';

const SIZE = 5;

// 내 진영이 항상 아래로 오도록 북쪽 시점은 180도 회전해 그린다
const flip = (side: OTSide, n: number) => (side === 'north' ? SIZE - 1 - n : n);

const cellKey = (row: number, col: number) => `${row},${col}`;

// ==================== 카드 미니 그리드 ====================

interface OTCardProps {
  name: string;
  // 소유자 시점 그대로 그린다. 상대 카드는 CSS 로 180도 회전.
  rotated?: boolean;
  selected?: boolean;
  waiting?: boolean;
  onClick?: () => void;
}

function OTCardView({ name, rotated, selected, waiting, onClick }: OTCardProps) {
  const def = OT_CARDS[name];
  if (!def) return null;

  // 중앙 (2,2) 기준: forward 는 위, right 는 오른쪽
  const marks = new Set(def.moves.map((m) => cellKey(2 - m.forward, 2 + m.right)));

  return (
    <button
      type="button"
      className={[
        'ot-card',
        rotated ? 'rotated' : '',
        selected ? 'selected' : '',
        waiting ? 'waiting' : '',
        onClick ? 'clickable' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={onClick}
      disabled={!onClick}
    >
      <span className="ot-card-label">{def.label}</span>
      <span className="ot-card-grid">
        {Array.from({ length: SIZE }).map((_, r) =>
          Array.from({ length: SIZE }).map((_, c) => {
            const key = cellKey(r, c);
            const cls =
              r === 2 && c === 2 ? 'center' : marks.has(key) ? 'mark' : '';
            return <span key={key} className={`ot-card-cell ${cls}`} />;
          }),
        )}
      </span>
    </button>
  );
}

// ==================== 보드 ====================

interface OTBoardProps {
  game: OTGameState;
  lastEvent: OTEvent | null;
  onMove: (card: string, from: OTCell, to: OTCell) => void;
  onPass: (card: string) => void;
}

export function OTBoard({ game, lastEvent, onMove, onPass }: OTBoardProps) {
  const me = game.yourSide;
  const myTurn = game.phase === 'play' && game.currentSide === me;
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [selectedFrom, setSelectedFrom] = useState<OTCell | null>(null);

  useEffect(() => {
    setSelectedCard(null);
    setSelectedFrom(null);
  }, [game.currentSide]);

  const myHand = me === 'south' ? game.southHand : game.northHand;
  const oppHand = me === 'south' ? game.northHand : game.southHand;
  const opponentName = me === 'south' ? game.northName : game.southName;
  const mustPass = myTurn && game.legalMoves.length === 0;

  const pieceByCell: Record<string, (typeof game.pieces)[number]> = {};
  for (const p of game.pieces) {
    pieceByCell[cellKey(p.row, p.col)] = p;
  }

  // 선택한 카드로 움직일 수 있는 출발 칸 / 선택한 출발 칸의 도착 칸
  const fromCells = new Set<string>();
  const toCells = new Set<string>();
  if (myTurn && selectedCard) {
    for (const m of game.legalMoves) {
      if (m.card !== selectedCard) continue;
      fromCells.add(cellKey(m.from.row, m.from.col));
      if (selectedFrom && m.from.row === selectedFrom.row && m.from.col === selectedFrom.col) {
        toCells.add(cellKey(m.to.row, m.to.col));
      }
    }
  }

  const temples: Record<string, boolean> = {
    [cellKey(0, 2)]: true,
    [cellKey(SIZE - 1, 2)]: true,
  };
  const eventCell =
    lastEvent?.kind === 'move' || lastEvent?.kind === 'capture' ? lastEvent.to : undefined;

  const handleCellClick = (row: number, col: number) => {
    if (!myTurn || !selectedCard) return;
    const key = cellKey(row, col);
    const piece = pieceByCell[key];

    if (piece && piece.side === me && fromCells.has(key)) {
      setSelectedFrom({ row, col });
      return;
    }
    if (selectedFrom && toCells.has(key)) {
      onMove(selectedCard, selectedFrom, { row, col });
      setSelectedCard(null);
      setSelectedFrom(null);
    }
  };

  const statusText = (() => {
    if (!myTurn) return `${opponentName}님의 차례...`;
    if (mustPass) return '둘 수 있는 수가 없습니다 — 교환할 카드를 고르세요';
    if (!selectedCard) return '내 차례 — 쓸 카드를 고르세요';
    if (!selectedFrom) return '움직일 기물을 고르세요';
    return '도착 칸을 고르세요';
  })();

  return (
    <div className="ot-board-page">
      <div className="ot-hand opp">
        {oppHand.map((card) => (
          <OTCardView key={card} name={card} rotated />
        ))}
      </div>

      <div className="ot-mid">
        <div className="ot-grid">
          {Array.from({ length: SIZE }).map((_, displayRow) =>
            Array.from({ length: SIZE }).map((_, displayCol) => {
              const row = flip(me, displayRow);
              const col = flip(me, displayCol);
              const key = cellKey(row, col);
              const piece = pieceByCell[key];
              const classes = [
                'ot-cell',
                temples[key] ? 'temple' : '',
                selectedFrom && selectedFrom.row === row && selectedFrom.col === col
                  ? 'selected'
                  : '',
                fromCells.has(key) && !selectedFrom ? 'from' : '',
                toCells.has(key) ? 'target' : '',
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
                  {piece && (
                    <span className={`ot-piece ${piece.side}${piece.master ? ' master' : ''}`}>
                      {piece.master ? '★' : ''}
                    </span>
                  )}
                </button>
              );
            }),
          )}
        </div>

        <div className="ot-waiting-slot">
          <span className="ot-waiting-label">대기</span>
          <OTCardView name={game.waitingCard} />
        </div>
      </div>

      <div className="ot-hand mine">
        {myHand.map((card) => (
          <OTCardView
            key={card}
            name={card}
            selected={selectedCard === card}
            onClick={
              myTurn
                ? () => {
                    setSelectedCard(card);
                    setSelectedFrom(null);
                  }
                : undefined
            }
          />
        ))}
      </div>

      <div className="ot-status">{statusText}</div>

      {mustPass && (
        <button
          type="button"
          className="ot-action-button"
          disabled={!selectedCard}
          onClick={() => selectedCard && onPass(selectedCard)}
        >
          카드 교환하고 패스
        </button>
      )}
    </div>
  );
}
