import React from 'react';
import './Tile.css';

interface TileProps {
  number: number;
  onClick?: () => void;
  disabled?: boolean;
  isPlayed?: boolean;
  color?: 'blue' | 'red';
}

export const Tile: React.FC<TileProps> = ({
  number,
  onClick,
  disabled = false,
  isPlayed = false,
  color,
}) => {
  const isOdd = number % 2 === 1;

  return (
    <div
      className={`tile ${disabled ? 'disabled' : ''} ${isPlayed ? 'played' : ''} ${color || ''} ${isOdd ? 'odd' : 'even'}`}
      onClick={!disabled ? onClick : undefined}
    >
      {!isPlayed && <span className="tile-number">{number}</span>}
    </div>
  );
};
