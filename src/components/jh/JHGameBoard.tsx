import { useEffect, useState } from 'react';
import type {
  JHCard,
  JHEvent,
  JHGameState,
  JHSuit,
  JHTrick,
} from '../../types/jekyllhyde';
import { JH_TRACK_LENGTH } from '../../types/jekyllhyde';
import './JHGameBoard.css';

interface JHGameBoardProps {
  game: JHGameState;
  lastEvent: JHEvent | null;
  onExchange: (indices: number[]) => void;
  onPlayCard: (handIndex: number) => void;
  onDeclareSuit: (suit: JHSuit) => void;
  onStealTrick: (trickIndex: number) => void;
  onGreedCards: (indices: number[]) => void;
}

const SUIT_LABELS: Record<JHSuit, string> = {
  pride: '오만',
  wrath: '분노',
  greed: '탐욕',
  potion: '물약',
};

const EVIL_SUITS: JHSuit[] = ['pride', 'wrath', 'greed'];

function cardText(card: JHCard): string {
  return card.suit === 'potion' ? `${card.value}+` : String(card.value);
}

function JHCardView({
  card,
  small,
  faded,
}: {
  card: JHCard;
  small?: boolean;
  faded?: boolean;
}) {
  return (
    <div
      className={[
        'jh-card',
        `jh-suit-${card.suit}`,
        small ? 'jh-card-small' : '',
        faded ? 'jh-card-faded' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span className="jh-card-value">{cardText(card)}</span>
      <span className="jh-card-suit">{SUIT_LABELS[card.suit]}</span>
    </div>
  );
}

function TrickPair({ trick }: { trick: JHTrick }) {
  return (
    <div className="jh-trick-pair">
      <JHCardView card={trick.lead} small />
      <JHCardView card={trick.follow} small />
    </div>
  );
}

export function JHGameBoard({
  game,
  lastEvent,
  onExchange,
  onPlayCard,
  onDeclareSuit,
  onStealTrick,
  onGreedCards,
}: JHGameBoardProps) {
  const [selected, setSelected] = useState<number[]>([]);

  const isJekyll = game.yourRole === 'jekyll';
  const yourName = isJekyll ? game.jekyllName : game.hydeName;
  const oppName = isJekyll ? game.hydeName : game.jekyllName;
  const yourRoleLabel = isJekyll ? '지킬' : '하이드';
  const oppRoleLabel = isJekyll ? '하이드' : '지킬';
  const legal = game.legalIndices ?? [];

  const isPlayPhase = game.phase === 'lead' || game.phase === 'follow';
  const isPickPhase =
    (game.phase === 'exchange' || game.phase === 'greed_exchange') &&
    !game.youSubmitted;
  const pickCount =
    game.phase === 'exchange' ? game.exchangeCount : game.greedPickCount;

  // 단계·손패가 바뀌면 선택을 초기화한다
  useEffect(() => {
    setSelected([]);
  }, [game.phase, game.yourHand.length, game.youSubmitted]);

  const isSelectable = (i: number): boolean => {
    if (isPlayPhase) return game.yourTurn && legal.includes(i);
    if (isPickPhase) return true;
    return false;
  };

  const toggleCard = (i: number) => {
    if (!isSelectable(i)) return;
    if (isPlayPhase) {
      // 카드 내기는 한 장 선택 → 확인 버튼의 2단계
      setSelected((prev) => (prev[0] === i ? [] : [i]));
      return;
    }
    setSelected((prev) => {
      if (prev.includes(i)) return prev.filter((x) => x !== i);
      if (prev.length >= pickCount) return prev;
      return [...prev, i];
    });
  };

  const handleConfirm = () => {
    if (isPlayPhase && selected.length === 1) {
      onPlayCard(selected[0]);
      setSelected([]);
      return;
    }
    if (game.phase === 'exchange' && selected.length === game.exchangeCount) {
      onExchange(selected);
      setSelected([]);
      return;
    }
    if (
      game.phase === 'greed_exchange' &&
      selected.length === game.greedPickCount
    ) {
      onGreedCards(selected);
      setSelected([]);
    }
  };

  const confirmReady =
    (isPlayPhase && game.yourTurn && selected.length === 1) ||
    (isPickPhase && selected.length === pickCount);

  const confirmLabel = (() => {
    if (isPlayPhase) return '카드 내기';
    if (game.phase === 'exchange') return `${game.exchangeCount}장 교환하기`;
    return `${game.greedPickCount}장 넘기기`;
  })();

  const statusText = (() => {
    switch (game.phase) {
      case 'exchange':
        if (game.youSubmitted) return '상대의 교환 제출을 기다리는 중...';
        return game.mustIncludePotion
          ? `교환할 카드 ${game.exchangeCount}장을 고르세요 — 물약이 2장 이상이라 물약을 최소 1장 포함해야 합니다`
          : `교환할 카드 ${game.exchangeCount}장을 고르세요`;
      case 'lead':
        return game.yourTurn
          ? '선입니다. 낼 카드를 고르세요'
          : `${oppName}님이 리드하는 중...`;
      case 'declare':
        return game.yourTurn
          ? '물약을 냈습니다. 상대에게 강요할 색을 선언하세요'
          : `${oppName}님이 색을 선언하는 중...`;
      case 'follow':
        return game.yourTurn
          ? '따라 낼 카드를 고르세요 (밝은 카드만 낼 수 있습니다)'
          : `${oppName}님이 따라 내는 중...`;
      case 'pride_steal':
        return game.yourTurn
          ? '오만의 힘! 상대의 트릭 하나를 골라 빼앗으세요'
          : `${oppName}님이 빼앗을 트릭을 고르는 중...`;
      case 'greed_exchange':
        return game.youSubmitted
          ? '상대의 카드 선택을 기다리는 중...'
          : `탐욕의 거래! 상대에게 넘길 카드 ${game.greedPickCount}장을 고르세요`;
      default:
        return '';
    }
  })();

  // 테이블 표시: 트릭 진행 중엔 서버 상태, 방금 끝난 트릭은 이벤트로 잠시 유지
  const showLead =
    game.tableLead ??
    (lastEvent?.kind === 'trick_resolved' ? lastEvent.leadCard : undefined);
  const showFollow =
    game.tableFollow ??
    (lastEvent?.kind === 'trick_resolved' ? lastEvent.followCard : undefined);

  const eventBanner = (() => {
    if (!lastEvent) return null;
    switch (lastEvent.kind) {
      case 'trick_resolved': {
        const winnerLabel = lastEvent.winner === 'jekyll' ? '지킬' : '하이드';
        const effect =
          lastEvent.effect && lastEvent.effect !== 'potion'
            ? ` — ${SUIT_LABELS[lastEvent.effect]} 물약 발동!`
            : '';
        return `${winnerLabel} 트릭 승리${effect}`;
      }
      case 'rank_reset':
        return '분노의 물약 — 색 서열이 초기화되었습니다!';
      case 'trick_stolen':
        return `${lastEvent.role === 'jekyll' ? '지킬' : '하이드'}이(가) 트릭을 빼앗았습니다!`;
      case 'greed_exchanged':
        return '탐욕의 거래 — 카드를 맞바꿨습니다';
      case 'round_result':
        return `라운드 ${lastEvent.round} 종료: 지킬 ${lastEvent.jekyllTricks} - ${lastEvent.hydeTricks} 하이드 → 마커 ${lastEvent.moved}칸 이동`;
      default:
        return null;
    }
  })();

  const stealMode = game.phase === 'pride_steal' && game.yourTurn;

  return (
    <div className="jh-board">
      {/* 상대 정보 */}
      <div className="jh-player-bar">
        <div className="jh-player-info">
          <span className={`jh-turn-dot${!game.yourTurn ? ' active' : ''}`} />
          <span className={`jh-role-chip jh-role-${isJekyll ? 'hyde' : 'jekyll'}`}>
            {oppRoleLabel}
          </span>
          <span className="jh-player-name">{oppName}</span>
        </div>
        <span className="jh-player-meta">
          손패 {game.oppHandCount}장 · 트릭 {game.oppTricks.length}개
        </span>
      </div>

      {/* 정체성 트랙 */}
      <div className="jh-track-section">
        <div className="jh-track-header">
          <span className="jh-round-label">라운드 {game.round}/3</span>
          <span className="jh-track-caption">
            마커가 끝에 닿으면 하이드 승리
          </span>
        </div>
        <div className="jh-track">
          {Array.from({ length: JH_TRACK_LENGTH + 1 }, (_, i) => (
            <div
              key={i}
              className={[
                'jh-track-cell',
                i === 0 ? 'jekyll-home' : i <= 5 ? 'jekyll-zone' : 'hyde-zone',
                i === JH_TRACK_LENGTH ? 'hyde-home' : '',
                game.marker === i ? 'has-marker' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {game.marker === i ? <span className="jh-marker" /> : null}
            </div>
          ))}
        </div>
        <div className="jh-track-ends">
          <span>지킬</span>
          <span>하이드</span>
        </div>
      </div>

      {/* 색 서열 */}
      <div className="jh-rank-row">
        <span className="jh-rank-title">색 서열</span>
        {game.rankOrder.length === 0 ? (
          <span className="jh-rank-empty">아직 없음 — 먼저 나온 색이 약합니다</span>
        ) : (
          <div className="jh-rank-chips">
            {game.rankOrder.map((suit, i) => (
              <span key={suit} className="jh-rank-item">
                {i > 0 && <span className="jh-rank-lt">&lt;</span>}
                <span className={`jh-rank-chip jh-chip-${suit}`}>
                  {SUIT_LABELS[suit]}
                </span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 트릭 테이블 */}
      <div className="jh-table">
        <div className="jh-table-slot">
          <span className="jh-slot-label">
            선{game.leader === game.yourRole ? ' (나)' : ` (${oppName})`}
          </span>
          {showLead ? (
            <JHCardView card={showLead} />
          ) : (
            <div className="jh-card-placeholder" />
          )}
          {game.declaredSuit && (
            <span className={`jh-declared-badge jh-chip-${game.declaredSuit}`}>
              {SUIT_LABELS[game.declaredSuit]} 선언
            </span>
          )}
        </div>
        <div className="jh-table-slot">
          <span className="jh-slot-label">응수</span>
          {showFollow ? (
            <JHCardView card={showFollow} />
          ) : (
            <div className="jh-card-placeholder" />
          )}
        </div>
      </div>

      {/* 이벤트 배너 / 상태 안내 */}
      {eventBanner && <div className="jh-event-banner">{eventBanner}</div>}
      <div className="jh-status-row">
        <span className="jh-status-text">{statusText}</span>
        {(isPlayPhase || isPickPhase) && (
          <button
            type="button"
            className="jh-confirm-button"
            onClick={handleConfirm}
            disabled={!confirmReady}
          >
            {confirmLabel}
          </button>
        )}
      </div>

      {/* 색 선언 버튼 */}
      {game.phase === 'declare' && game.yourTurn && (
        <div className="jh-declare-row">
          {EVIL_SUITS.map((suit) => (
            <button
              key={suit}
              type="button"
              className={`jh-declare-button jh-chip-${suit}`}
              onClick={() => onDeclareSuit(suit)}
            >
              {SUIT_LABELS[suit]}
            </button>
          ))}
        </div>
      )}

      {/* 트릭 더미 */}
      <div className="jh-tricks-section">
        <div className={`jh-tricks-row${stealMode ? ' steal-mode' : ''}`}>
          <span className="jh-tricks-label">
            상대 트릭 {game.oppTricks.length}
          </span>
          <div className="jh-tricks-list">
            {game.oppTricks.map((trick, i) =>
              stealMode ? (
                <button
                  key={i}
                  type="button"
                  className="jh-trick-steal-button"
                  onClick={() => onStealTrick(i)}
                >
                  <TrickPair trick={trick} />
                </button>
              ) : (
                <TrickPair key={i} trick={trick} />
              ),
            )}
          </div>
        </div>
        <div className="jh-tricks-row">
          <span className="jh-tricks-label">내 트릭 {game.yourTricks.length}</span>
          <div className="jh-tricks-list">
            {game.yourTricks.map((trick, i) => (
              <TrickPair key={i} trick={trick} />
            ))}
          </div>
        </div>
      </div>

      {/* 내 정보 + 손패 */}
      <div className="jh-player-bar">
        <div className="jh-player-info">
          <span className={`jh-turn-dot${game.yourTurn ? ' active' : ''}`} />
          <span className={`jh-role-chip jh-role-${game.yourRole}`}>
            {yourRoleLabel}
          </span>
          <span className="jh-player-name">{yourName} (나)</span>
        </div>
        <span className="jh-player-meta">
          {isJekyll ? '목표: 트릭 수 균형 유지' : '목표: 트릭 수 격차 만들기'}
        </span>
      </div>

      <div className="jh-hand">
        {game.yourHand.map((card, i) => {
          const selectable = isSelectable(i);
          return (
            <button
              key={card.id}
              type="button"
              className={`jh-hand-slot${selected.includes(i) ? ' selected' : ''}`}
              onClick={() => toggleCard(i)}
              disabled={!selectable}
            >
              <JHCardView card={card} faded={!selectable} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
