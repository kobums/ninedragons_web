import type { DVPlayerView, DVTileView } from '../../types/davinci';
import './DVTileRow.css';

interface DVTileRowProps {
  player: DVPlayerView;
  isYou: boolean;
  isCurrent: boolean;
  // 추리 대상 선택 모드: 비공개 타일만 탭 가능
  selectable?: boolean;
  selectedIndex?: number | null;
  onSelectTile?: (index: number) => void;
  // 조커 삽입 모드: 타일 사이사이에 + 슬롯 표시
  insertMode?: boolean;
  onInsertAt?: (position: number) => void;
}

// 타일 앞면 표기: 값이 보이면 숫자 또는 조커(-), 안 보이면 빈 뒷면
function tileFace(tile: DVTileView): string {
  if (tile.value === undefined) return '';
  return tile.joker ? '★' : String(tile.value);
}

export function DVTile({
  tile,
  clickable,
  selected,
  onClick,
}: {
  tile: DVTileView;
  clickable?: boolean;
  selected?: boolean;
  onClick?: () => void;
}) {
  const classes = [
    'dv-tile',
    tile.color ?? 'unknown', // 셋업 중 상대 타일은 색도 감춘 중립 뒷면
    tile.revealed ? 'revealed' : 'hidden',
    clickable ? 'clickable' : '',
    selected ? 'selected' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button type="button" className={classes} onClick={onClick} disabled={!clickable}>
      {tileFace(tile)}
    </button>
  );
}

export function DVTileRow({
  player,
  isYou,
  isCurrent,
  selectable,
  selectedIndex,
  onSelectTile,
  insertMode,
  onInsertAt,
}: DVTileRowProps) {
  const rowClasses = [
    'dv-tile-row',
    isCurrent ? 'current' : '',
    player.eliminated ? 'eliminated' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={rowClasses}>
      <div className="dv-tile-row-header">
        <span className="dv-player-name">
          {player.name}
          {isYou && ' (나)'}
        </span>
        {isCurrent && <span className="dv-turn-badge">차례</span>}
        {player.eliminated && <span className="dv-out-badge">탈락</span>}
        {!player.connected && !player.eliminated && (
          <span className="dv-offline-badge">연결 끊김</span>
        )}
      </div>
      <div className="dv-tiles">
        {insertMode && (
          <button type="button" className="dv-insert-slot" onClick={() => onInsertAt?.(0)}>
            +
          </button>
        )}
        {player.tiles.map((tile, index) => (
          <span key={tile.id} className="dv-tile-wrap">
            <DVTile
              tile={tile}
              clickable={Boolean(selectable && !tile.revealed && onSelectTile)}
              selected={selectedIndex === index}
              onClick={() => onSelectTile?.(index)}
            />
            {insertMode && (
              <button
                type="button"
                className="dv-insert-slot"
                onClick={() => onInsertAt?.(index + 1)}
              >
                +
              </button>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
