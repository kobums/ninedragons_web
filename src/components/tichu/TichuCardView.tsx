import type { TichuCard, TichuSuit } from '../../types/tichu';
import { cardRank, cardSuit, rankLabel } from '../../types/tichu';
import './TichuCardView.css';

// 4문양 글리프 — 색은 CSS 토큰이 입히므로 단색 문자만 쓴다
const SUIT_GLYPHS: Record<TichuSuit, string> = {
  G: '❖', // 옥
  B: '♠', // 검
  U: '▲', // 파고다
  R: '★', // 별
};

// 특수 카드는 이모지 + 한글 이름으로 구분한다
const SPECIAL_VIEWS: Record<string, { glyph: string; label: string }> = {
  MAH: { glyph: '🐦', label: '참새 1' },
  DOG: { glyph: '🐕', label: '개' },
  PHX: { glyph: '🔥', label: '봉황' },
  DRG: { glyph: '🐉', label: '용' },
};

interface TichuCardViewProps {
  card: TichuCard;
  size?: 'sm' | 'md';
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

export function TichuCardView({
  card,
  size = 'md',
  selected = false,
  disabled = false,
  onClick,
}: TichuCardViewProps) {
  const suit = cardSuit(card);
  const classes = [
    'tc-card',
    `tc-card-${size}`,
    suit ? `tc-suit-${suit}` : 'tc-card-special',
    selected ? 'selected' : '',
    onClick ? 'clickable' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const body = suit ? (
    <>
      <span className="tc-card-rank">{rankLabel(cardRank(card))}</span>
      <span className="tc-card-suit">{SUIT_GLYPHS[suit]}</span>
    </>
  ) : (
    <>
      <span className="tc-card-glyph">{SPECIAL_VIEWS[card]?.glyph ?? '?'}</span>
      <span className="tc-card-name">{SPECIAL_VIEWS[card]?.label ?? card}</span>
    </>
  );

  if (!onClick) {
    return <div className={classes}>{body}</div>;
  }

  return (
    <button type="button" className={classes} disabled={disabled} onClick={onClick}>
      {body}
    </button>
  );
}
