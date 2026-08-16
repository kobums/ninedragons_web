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

// 특수 카드 — 실물 카드풍 전면 디자인 (개별 색·코너 인덱스·이름 배너)
const SPECIAL_VIEWS: Record<
  string,
  { glyph: string; label: string; corner: string }
> = {
  MAH: { glyph: '🐦', label: '참새', corner: '1' },
  DOG: { glyph: '🐕', label: '개', corner: '🐕' },
  PHX: { glyph: '🔥', label: '봉황', corner: '🔥' },
  DRG: { glyph: '🐉', label: '용', corner: '🐉' },
};

interface TichuCardViewProps {
  card: TichuCard;
  size?: 'sm' | 'md';
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

// 카드 한 장 — 실물 트럼프 결: 좌상단 인덱스 + 우하단 180° 미러 + 중앙 문양.
export function TichuCardView({
  card,
  size = 'md',
  selected = false,
  disabled = false,
  onClick,
}: TichuCardViewProps) {
  const suit = cardSuit(card);
  const special = suit ? null : SPECIAL_VIEWS[card];
  const classes = [
    'tc-card',
    `tc-card-${size}`,
    suit ? `tc-suit-${suit}` : `tc-card-special tc-sp-${card.toLowerCase()}`,
    selected ? 'selected' : '',
    onClick ? 'clickable' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const index = (pos: 'tl' | 'br') =>
    suit ? (
      <span className={`tc-card-index ${pos}`}>
        <span className="tc-card-index-rank">{rankLabel(cardRank(card))}</span>
        <span className="tc-card-index-suit">{SUIT_GLYPHS[suit]}</span>
      </span>
    ) : (
      <span className={`tc-card-index ${pos}`}>
        <span className="tc-card-index-rank">{special?.corner ?? '?'}</span>
      </span>
    );

  const rank = suit ? cardRank(card) : 0;

  const body = (
    <>
      {index('tl')}
      {suit ? (
        <span className={`tc-card-pip${rank === 14 ? ' ace' : ''}`}>
          {SUIT_GLYPHS[suit]}
        </span>
      ) : (
        <span className="tc-card-art">
          <span className="tc-card-glyph">{special?.glyph ?? '?'}</span>
          <span className="tc-card-name">{special?.label ?? card}</span>
        </span>
      )}
      {index('br')}
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
