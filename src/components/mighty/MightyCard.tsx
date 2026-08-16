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

// 카드 한 장 — 실물 트럼프 결: 좌상단 인덱스(랭크+문양) + 우하단 180° 미러
// + 중앙 문양. J/Q/K 는 코트 카드 프레임, A 는 큰 단일 문양, 조커는 전용.
// onClick 이 있으면 <button>, 없으면 표시 전용 <div>.
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
  const rank = joker ? 0 : rankOf(card);
  const court = rank >= 11 && rank <= 13;

  const className = [
    'mt-card',
    `mt-card-${size}`,
    joker ? 'joker' : red ? 'red' : 'black',
    selected ? 'selected' : '',
    highlighted ? 'highlighted' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const index = (pos: 'tl' | 'br') =>
    suit && (
      <span className={`mt-card-index ${pos}`}>
        <span className="mt-card-index-rank">{rankLabel(rank)}</span>
        <span className="mt-card-index-suit">{SUIT_SYMBOL[suit]}</span>
      </span>
    );

  const body = joker ? (
    <>
      <span className="mt-card-index tl jk">
        <span className="mt-card-index-rank">J</span>
        <span className="mt-card-index-rank">K</span>
      </span>
      <span className="mt-card-jester" aria-hidden="true">
        🃏
      </span>
      <span className="mt-card-index br jk">
        <span className="mt-card-index-rank">J</span>
        <span className="mt-card-index-rank">K</span>
      </span>
    </>
  ) : (
    <>
      {index('tl')}
      {court ? (
        <span className="mt-card-court">
          <span className="mt-card-court-letter">{rankLabel(rank)}</span>
          <span className="mt-card-court-suit">
            {suit ? SUIT_SYMBOL[suit] : ''}
          </span>
        </span>
      ) : (
        <span className={`mt-card-pip${rank === 14 ? ' ace' : ''}`}>
          {suit ? SUIT_SYMBOL[suit] : ''}
        </span>
      )}
      {index('br')}
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
