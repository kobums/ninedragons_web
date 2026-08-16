import { useEffect, useState } from 'react';
import type { LCCard, LCColor, LCEvent, LCGameState } from '../../types/lostcities';
import { LC_COLORS, LC_COLOR_LABEL, LC_WAGER } from '../../types/lostcities';
import './LCBoard.css';

// 오름차순·투자 규칙 미러 (놓기 가능 표시용 — 최종 판정은 서버)
const canPlay = (pile: LCCard[], card: LCCard) => {
  if (card.value === LC_WAGER) return pile.every((c) => c.value === LC_WAGER);
  return pile.every((c) => c.value === LC_WAGER || c.value < card.value);
};

const cardLabel = (card: LCCard) => (card.value === LC_WAGER ? '×' : String(card.value));

// 탐험대 하나의 점수 (서버 lcExpeditionScore 미러 — 표시용)
const expeditionScore = (pile: LCCard[]) => {
  if (pile.length === 0) return 0;
  let sum = 0;
  let wagers = 0;
  for (const c of pile) {
    if (c.value === LC_WAGER) wagers++;
    else sum += c.value;
  }
  let score = (sum - 20) * (1 + wagers);
  if (pile.length >= 8) score += 20;
  return score;
};

interface LCBoardProps {
  game: LCGameState;
  lastEvent: LCEvent | null;
  onMove: (cardId: number, action: 'play' | 'discard', draw: string) => void;
}

export function LCBoard({ game, lastEvent, onMove }: LCBoardProps) {
  const me = game.yourSide;
  const myTurn = game.phase === 'play' && game.currentSide === me;

  const [selectedId, setSelectedId] = useState<number | null>(null);
  // 놓기/버리기를 정한 뒤 뽑기를 기다리는 상태
  const [pending, setPending] = useState<{ cardId: number; action: 'play' | 'discard' } | null>(
    null,
  );

  useEffect(() => {
    setSelectedId(null);
    setPending(null);
  }, [game.currentSide]);

  const myExpeditions = me === 'south' ? game.southExpeditions : game.northExpeditions;
  const oppExpeditions = me === 'south' ? game.northExpeditions : game.southExpeditions;
  const myScore = me === 'south' ? game.southScore : game.northScore;
  const oppScore = me === 'south' ? game.northScore : game.southScore;
  const opponentName = me === 'south' ? game.northName : game.southName;

  const selectedCard = game.yourHand.find((c) => c.id === selectedId) ?? null;
  const pendingCard = game.yourHand.find((c) => c.id === pending?.cardId) ?? null;

  const sortedHand = [...game.yourHand].sort((a, b) =>
    a.color === b.color ? a.value - b.value : LC_COLORS.indexOf(a.color) - LC_COLORS.indexOf(b.color),
  );

  const handleHandClick = (card: LCCard) => {
    if (!myTurn || pending) return;
    setSelectedId(selectedId === card.id ? null : card.id);
  };

  const handleExpeditionClick = (color: LCColor) => {
    if (!myTurn || pending || !selectedCard || selectedCard.color !== color) return;
    if (!canPlay(myExpeditions[color] ?? [], selectedCard)) return;
    setPending({ cardId: selectedCard.id, action: 'play' });
  };

  const handleDiscardTargetClick = (color: LCColor) => {
    // 1단계: 선택한 카드를 그 색 더미에 버리기
    if (myTurn && !pending && selectedCard && selectedCard.color === color) {
      setPending({ cardId: selectedCard.id, action: 'discard' });
      return;
    }
    // 2단계: 버림 더미에서 뽑기
    if (myTurn && pending && canDrawPile(color)) {
      onMove(pending.cardId, pending.action, color);
      setSelectedId(null);
      setPending(null);
    }
  };

  const canDrawPile = (color: LCColor) => {
    if (!pending) return false;
    // 방금 버린 카드를 바로 가져올 수 없다
    if (pending.action === 'discard' && pendingCard?.color === color) return false;
    return (game.discards[color] ?? []).length > 0;
  };

  const handleDeckClick = () => {
    if (!myTurn || !pending) return;
    onMove(pending.cardId, pending.action, 'deck');
    setSelectedId(null);
    setPending(null);
  };

  const statusText = (() => {
    if (!myTurn) return `${opponentName}님의 차례...`;
    if (pending) return '덱이나 버림 더미에서 한 장 뽑으세요';
    if (selectedCard) return '내 탐험대에 놓거나, 같은 색 버림 더미에 버리세요';
    return '내 차례 — 손에서 카드를 고르세요';
  })();

  const eventText = (() => {
    if (!lastEvent || lastEvent.side === me) return null;
    const who = opponentName;
    if (lastEvent.kind === 'play' && lastEvent.card)
      return `${who}: ${LC_COLOR_LABEL[lastEvent.card.color]} ${cardLabel(lastEvent.card)} 놓음`;
    if (lastEvent.kind === 'discard' && lastEvent.card)
      return `${who}: ${LC_COLOR_LABEL[lastEvent.card.color]} ${cardLabel(lastEvent.card)} 버림`;
    if (lastEvent.kind === 'draw')
      return lastEvent.card
        ? `${who}: 버림 더미에서 ${LC_COLOR_LABEL[lastEvent.card.color]} ${cardLabel(lastEvent.card)} 가져감`
        : `${who}: 덱에서 뽑음`;
    return null;
  })();

  const renderExpedition = (
    pile: LCCard[],
    color: LCColor,
    mine: boolean,
    previewCard: LCCard | null,
  ) => {
    const cards = previewCard ? [...pile, previewCard] : pile;
    const score = expeditionScore(cards);
    const playable =
      mine && myTurn && !pending && selectedCard?.color === color && canPlay(pile, selectedCard);
    return (
      <button
        key={`${mine ? 'my' : 'opp'}-${color}`}
        type="button"
        className={`lc-exped lc-${color}${playable ? ' playable' : ''}`}
        onClick={mine ? () => handleExpeditionClick(color) : undefined}
        disabled={!mine}
      >
        <span className="lc-exped-score">{cards.length > 0 ? score : ''}</span>
        <span className="lc-exped-cards">
          {cards.map((c) => (
            <span
              key={c.id}
              className={`lc-chip lc-${c.color}${previewCard && c.id === previewCard.id ? ' preview' : ''}`}
            >
              {cardLabel(c)}
            </span>
          ))}
        </span>
      </button>
    );
  };

  return (
    <div className="lc-board-page">
      <div className="lc-player-bar">
        <span className="lc-player-name">{opponentName}</span>
        <span className="lc-hand-count">🂠 {game.opponentHandCount}</span>
        <span className="lc-score">{oppScore}점</span>
      </div>

      <div className="lc-exped-row opp">
        {LC_COLORS.map((color) => renderExpedition(oppExpeditions[color] ?? [], color, false, null))}
      </div>

      <div className="lc-middle">
        <button
          type="button"
          className={`lc-deck${myTurn && pending ? ' drawable' : ''}`}
          onClick={handleDeckClick}
        >
          <span className="lc-deck-count">{game.deckCount}</span>
          <span className="lc-deck-label">덱</span>
        </button>
        {LC_COLORS.map((color) => {
          const pile = game.discards[color] ?? [];
          const previewHere =
            pending?.action === 'discard' && pendingCard?.color === color ? pendingCard : null;
          const top = previewHere ?? (pile.length > 0 ? pile[pile.length - 1] : null);
          const discardable = myTurn && !pending && selectedCard?.color === color;
          const drawable = myTurn && Boolean(pending) && canDrawPile(color);
          return (
            <button
              key={color}
              type="button"
              className={[
                'lc-discard',
                `lc-${color}`,
                discardable ? 'discardable' : '',
                drawable ? 'drawable' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => handleDiscardTargetClick(color)}
            >
              {top ? (
                <span className={`lc-chip lc-${top.color}${previewHere ? ' preview' : ''}`}>
                  {cardLabel(top)}
                </span>
              ) : (
                <span className="lc-discard-empty">{LC_COLOR_LABEL[color]}</span>
              )}
              {pile.length + (previewHere ? 1 : 0) > 1 && (
                <span className="lc-discard-count">{pile.length + (previewHere ? 1 : 0)}</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="lc-exped-row mine">
        {LC_COLORS.map((color) =>
          renderExpedition(
            myExpeditions[color] ?? [],
            color,
            true,
            pending?.action === 'play' && pendingCard?.color === color ? pendingCard : null,
          ),
        )}
      </div>

      <div className="lc-hand">
        {sortedHand.map((card) => (
          <button
            key={card.id}
            type="button"
            className={[
              'lc-hand-card',
              `lc-${card.color}`,
              selectedId === card.id && !pending ? 'selected' : '',
              pending?.cardId === card.id ? 'pending' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => handleHandClick(card)}
          >
            <span className="lc-card-corner tl">{cardLabel(card)}</span>
            <span className="lc-card-num">{cardLabel(card)}</span>
            <span className="lc-card-corner br">{cardLabel(card)}</span>
          </button>
        ))}
      </div>

      <div className="lc-player-bar mine">
        <span className="lc-player-name">나</span>
        <span className="lc-score">{myScore}점</span>
        {pending && (
          <button
            type="button"
            className="lc-cancel-button"
            onClick={() => {
              setPending(null);
              setSelectedId(null);
            }}
          >
            취소
          </button>
        )}
      </div>

      <div className="lc-status">{statusText}</div>
      {eventText && <div className="lc-event">{eventText}</div>}
    </div>
  );
}
