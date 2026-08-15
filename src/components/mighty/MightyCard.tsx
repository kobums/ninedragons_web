import type { MTCard } from '../../types/mighty';
import {
  SUIT_SYMBOL,
  isJoker,
  isRedSuit,
  rankLabel,
  rankOf,
  suitOf,
} from './mightyRules';
import './MightyCard.css';

interface MightyCardProps {
  card: MTCard;
  size?: 'sm' | 'md';
  // 버튼으로 렌더 — 손패·선택 UI 용
  onClick?: () => void;
  disabled?: boolean;
  selected?: boolean;
  // 키티 하이라이트 등
  highlighted?: boolean;
}

// 카드 한 장. onClick 이 있으면 <button>, 없으면 표시 전용 <div>.
export function MightyCard({
  card,
  size = 'md',
  onClick,
  disabled,
  selected,
  highlighted,
}: MightyCardProps) {
  const joker = isJoker(card);
  const suit = suitOf(card);
  const red = suit !== null && isRedSuit(suit);

  const className = [
    'mt-card',
    `mt-card-${size}`,
    joker ? 'joker' : red ? 'red' : 'black',
    selected ? 'selected' : '',
    highlighted ? 'highlighted' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const body = joker ? (
    <>
      <span className="mt-card-rank">JK</span>
      <span className="mt-card-suit">🃏</span>
    </>
  ) : (
    <>
      <span className="mt-card-rank">{rankLabel(rankOf(card))}</span>
      <span className="mt-card-suit">{suit ? SUIT_SYMBOL[suit] : ''}</span>
    </>
  );

  if (onClick) {
    return (
      <button type="button" className={className} onClick={onClick} disabled={disabled}>
        {body}
      </button>
    );
  }
  return <div className={className}>{body}</div>;
}
