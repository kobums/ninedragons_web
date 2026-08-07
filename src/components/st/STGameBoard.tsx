import { useEffect, useState } from 'react';
import type { STCard, STEvent, STGameState } from '../../types/schottentotten';
import { ST_TACTIC_LABELS, ST_TACTIC_NAMES } from '../../types/schottentotten';
import './STGameBoard.css';

interface STGameBoardProps {
  game: STGameState;
  lastEvent: STEvent | null;
  onPlayCard: (handIndex: number, stoneIndex: number) => void;
  onPlayRuse: (payload: {
    handIndex: number;
    fromStone: number;
    fromIndex: number;
    toStone: number;
  }) => void;
  onClaimStone: (stoneIndex: number) => void;
  onEndTurn: () => void;
  onDraw: (deck: 'clan' | 'tactic') => void;
  onPass: () => void;
  onRecruiterDraw: (deck: 'clan' | 'tactic') => void;
  onRecruiterReturn: (handIndex: number) => void;
}

// 계략 카드 타겟팅 진행 상태
type Targeting =
  | { kind: 'banshee'; handIndex: number }
  | { kind: 'strategist-src'; handIndex: number }
  | { kind: 'strategist-dst'; handIndex: number; fromStone: number; fromIndex: number }
  | { kind: 'traitor-src'; handIndex: number }
  | { kind: 'traitor-dst'; handIndex: number; fromStone: number; fromIndex: number }
  | null;

function ClanCard({ card, small }: { card: STCard; small?: boolean }) {
  if (card.tactic) {
    return (
      <div
        className={`st-card st-card-tactic${small ? ' st-card-small' : ''}`}
        title={ST_TACTIC_NAMES[card.tactic]}
      >
        {ST_TACTIC_LABELS[card.tactic]}
      </div>
    );
  }
  return (
    <div className={`st-card st-clan-${card.color}${small ? ' st-card-small' : ''}`}>
      {card.rank}
    </div>
  );
}

export function STGameBoard({
  game,
  lastEvent,
  onPlayCard,
  onPlayRuse,
  onClaimStone,
  onEndTurn,
  onDraw,
  onPass,
  onRecruiterDraw,
  onRecruiterReturn,
}: STGameBoardProps) {
  const [selectedHandIndex, setSelectedHandIndex] = useState<number | null>(null);
  const [targeting, setTargeting] = useState<Targeting>(null);
  const [showDiscard, setShowDiscard] = useState(false);

  const isMyTurn = game.currentSide === game.yourSide;
  const opponentName =
    game.yourSide === 'south' ? game.northName : game.southName;
  const yourName = game.yourSide === 'south' ? game.southName : game.northName;
  const discard = game.discard ?? [];

  // 턴·단계가 바뀌면 선택 상태를 초기화한다
  useEffect(() => {
    setSelectedHandIndex(null);
    setTargeting(null);
  }, [game.yourHand.length, game.currentSide, game.phase]);

  const canPlayOn = (stoneIndex: number): boolean => {
    const stone = game.stones[stoneIndex];
    if (!isMyTurn || game.phase !== 'play' || selectedHandIndex === null) {
      return false;
    }
    const card = game.yourHand[selectedHandIndex];
    if (!card) return false;
    if (card.tactic === 'blind') return stone.owner === '' && !stone.blind;
    if (card.tactic === 'mud') return stone.owner === '' && !stone.mud;
    return stone.owner === '' && stone.yourCards.length < stone.required;
  };

  const handleHandClick = (index: number) => {
    if (game.phase === 'recruiter_return' && isMyTurn) {
      onRecruiterReturn(index);
      return;
    }
    if (!isMyTurn || game.phase !== 'play') return;

    if (selectedHandIndex === index) {
      setSelectedHandIndex(null);
      setTargeting(null);
      return;
    }

    const card = game.yourHand[index];
    setSelectedHandIndex(index);
    switch (card.tactic) {
      case 'recruiter':
        setSelectedHandIndex(null);
        onPlayRuse({ handIndex: index, fromStone: 0, fromIndex: 0, toStone: 0 });
        break;
      case 'banshee':
        setTargeting({ kind: 'banshee', handIndex: index });
        break;
      case 'strategist':
        setTargeting({ kind: 'strategist-src', handIndex: index });
        break;
      case 'traitor':
        setTargeting({ kind: 'traitor-src', handIndex: index });
        break;
      default:
        setTargeting(null);
    }
  };

  // 상대 쪽 보드 카드 클릭 (밴시 대상 / 배신자 대상)
  const handleOppCardClick = (stoneIndex: number, cardIndex: number) => {
    if (!targeting) return;
    if (targeting.kind === 'banshee') {
      onPlayRuse({
        handIndex: targeting.handIndex,
        fromStone: stoneIndex,
        fromIndex: cardIndex,
        toStone: 0,
      });
      setTargeting(null);
      setSelectedHandIndex(null);
    } else if (targeting.kind === 'traitor-src') {
      const card = game.stones[stoneIndex].oppCards[cardIndex];
      if (card.tactic) return; // 클랜 카드만 강탈 가능
      setTargeting({
        kind: 'traitor-dst',
        handIndex: targeting.handIndex,
        fromStone: stoneIndex,
        fromIndex: cardIndex,
      });
    }
  };

  // 내 쪽 보드 카드 클릭 (전략가 원본)
  const handleYourCardClick = (stoneIndex: number, cardIndex: number) => {
    if (targeting?.kind !== 'strategist-src') return;
    setTargeting({
      kind: 'strategist-dst',
      handIndex: targeting.handIndex,
      fromStone: stoneIndex,
      fromIndex: cardIndex,
    });
  };

  const handleStoneClick = (stoneIndex: number) => {
    const stone = game.stones[stoneIndex];

    if (targeting?.kind === 'strategist-dst' || targeting?.kind === 'traitor-dst') {
      onPlayRuse({
        handIndex: targeting.handIndex,
        fromStone: targeting.fromStone,
        fromIndex: targeting.fromIndex,
        toStone: stoneIndex,
      });
      setTargeting(null);
      setSelectedHandIndex(null);
      return;
    }

    if (game.phase === 'claim' && isMyTurn && stone.claimable) {
      onClaimStone(stoneIndex);
      return;
    }
    if (canPlayOn(stoneIndex) && selectedHandIndex !== null) {
      onPlayCard(selectedHandIndex, stoneIndex);
      setSelectedHandIndex(null);
    }
  };

  const handleStrategistDiscard = () => {
    if (targeting?.kind !== 'strategist-dst') return;
    onPlayRuse({
      handIndex: targeting.handIndex,
      fromStone: targeting.fromStone,
      fromIndex: targeting.fromIndex,
      toStone: -1,
    });
    setTargeting(null);
    setSelectedHandIndex(null);
  };

  const statusText = (() => {
    if (!isMyTurn) {
      if (game.phase === 'claim') return `${opponentName}님이 돌을 가져가는 중...`;
      if (game.phase === 'recruiter_draw' || game.phase === 'recruiter_return') {
        return `${opponentName}님이 모병관을 쓰는 중...`;
      }
      if (game.phase === 'draw') return `${opponentName}님이 카드를 뽑는 중...`;
      return `${opponentName}님의 차례입니다`;
    }
    switch (game.phase) {
      case 'claim':
        return '가져올 수 있는 돌이 있습니다! 돌을 누르거나 턴을 마치세요';
      case 'draw':
        return '뽑을 덱을 선택하세요';
      case 'recruiter_draw':
        return `모병관: 뽑을 덱을 선택하세요 (${game.recruiterDraws}장 남음)`;
      case 'recruiter_return':
        return `모병관: 덱 밑으로 돌려보낼 카드를 손패에서 고르세요 (${game.recruiterReturns}장)`;
      default:
        break;
    }
    if (targeting) {
      switch (targeting.kind) {
        case 'banshee':
          return '밴시: 버릴 상대 카드를 선택하세요';
        case 'strategist-src':
          return '전략가: 옮길 내 카드를 선택하세요';
        case 'strategist-dst':
          return '전략가: 옮길 돌을 누르거나 버리세요';
        case 'traitor-src':
          return '배신자: 데려올 상대 클랜 카드를 선택하세요';
        case 'traitor-dst':
          return '배신자: 내 쪽 어느 돌에 놓을지 누르세요';
      }
    }
    return selectedHandIndex === null
      ? '손패에서 카드를 선택하세요'
      : '카드를 놓을 돌을 선택하세요';
  })();

  const showDeckButtons =
    isMyTurn && (game.phase === 'draw' || game.phase === 'recruiter_draw');
  const handleDeckPick = (deck: 'clan' | 'tactic') => {
    if (game.phase === 'draw') onDraw(deck);
    else onRecruiterDraw(deck);
  };

  const oppCardTargetable = (card: STCard): boolean => {
    if (targeting?.kind === 'banshee') return true;
    if (targeting?.kind === 'traitor-src') return !card.tactic;
    return false;
  };
  const yourCardTargetable = targeting?.kind === 'strategist-src';

  return (
    <div className="st-board">
      {/* 상대 정보 */}
      <div className="st-player-bar st-opponent-bar">
        <div className="st-player-info">
          <span className={`st-turn-dot${!isMyTurn ? ' active' : ''}`} />
          <span className="st-player-name">{opponentName}</span>
          <span className="st-player-meta">손패 {game.opponentHandCount}장</span>
          {game.tacticMode && (
            <span className="st-player-meta">전술 {game.oppPlayedTactics}</span>
          )}
        </div>
        <div className="st-player-stones">돌 {game.oppStoneCount}개</div>
      </div>

      {/* 보드: 9개 레인 (세로) */}
      <div className="st-lanes">
        {game.stones.map((stone) => {
          const flash =
            lastEvent?.stoneIndex === stone.index &&
            (lastEvent.kind === 'card_played' || lastEvent.kind === 'stone_claimed');
          const playable = canPlayOn(stone.index);
          const claimNow = game.phase === 'claim' && isMyTurn && stone.claimable;
          const destNow =
            (targeting?.kind === 'strategist-dst' || targeting?.kind === 'traitor-dst') &&
            stone.owner === '' &&
            stone.yourCards.length < stone.required;
          return (
            <div
              key={stone.index}
              className={[
                'st-lane',
                playable || destNow ? 'playable' : '',
                claimNow ? 'claimable' : '',
                flash ? 'flash' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <div className="st-lane-cards st-lane-opp">
                {stone.oppCards.map((card, i) => (
                  <button
                    key={i}
                    type="button"
                    className={`st-board-card${
                      oppCardTargetable(card) ? ' targetable' : ''
                    }`}
                    disabled={!oppCardTargetable(card)}
                    onClick={() => handleOppCardClick(stone.index, i)}
                  >
                    <ClanCard card={card} small />
                  </button>
                ))}
              </div>

              <button
                type="button"
                className={[
                  'st-stone',
                  stone.owner === 'you' ? 'owned-you' : '',
                  stone.owner === 'opponent' ? 'owned-opp' : '',
                  stone.blind ? 'blind' : '',
                  stone.mud ? 'mud' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                disabled={!playable && !claimNow && !destNow}
                onClick={() => handleStoneClick(stone.index)}
              >
                {claimNow ? '획득!' : stone.index + 1}
                {(stone.blind || stone.mud) && (
                  <span className="st-stone-badge">
                    {stone.blind ? '합' : ''}
                    {stone.mud ? '4' : ''}
                  </span>
                )}
              </button>

              <div className="st-lane-cards st-lane-you">
                {stone.yourCards.map((card, i) => (
                  <button
                    key={i}
                    type="button"
                    className={`st-board-card${yourCardTargetable ? ' targetable' : ''}`}
                    disabled={!yourCardTargetable}
                    onClick={() => handleYourCardClick(stone.index, i)}
                  >
                    <ClanCard card={card} small />
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* 버린 더미 */}
      {game.tacticMode && discard.length > 0 && (
        <div className="st-discard-row">
          <button
            type="button"
            className="st-discard-toggle"
            onClick={() => setShowDiscard(!showDiscard)}
          >
            버린 카드 {discard.length}장 {showDiscard ? '▾' : '▸'}
          </button>
          {showDiscard && (
            <div className="st-discard-cards">
              {discard.map((card, i) => (
                <ClanCard key={i} card={card} small />
              ))}
            </div>
          )}
        </div>
      )}

      {/* 상태 안내 + 행동 버튼 */}
      <div className="st-status-row">
        <span className="st-status-text">{statusText}</span>
        {game.phase === 'claim' && isMyTurn && (
          <button type="button" className="st-action-button" onClick={onEndTurn}>
            턴 마치기
          </button>
        )}
        {targeting?.kind === 'strategist-dst' && (
          <button
            type="button"
            className="st-action-button"
            onClick={handleStrategistDiscard}
          >
            버리기
          </button>
        )}
        {targeting && (
          <button
            type="button"
            className="st-action-button ghost"
            onClick={() => {
              setTargeting(null);
              setSelectedHandIndex(null);
            }}
          >
            취소
          </button>
        )}
        {game.canPass && isMyTurn && game.phase === 'play' && (
          <button type="button" className="st-action-button ghost" onClick={onPass}>
            패스
          </button>
        )}
      </div>

      {/* 덱 선택 (드로우 / 모병관) */}
      {showDeckButtons && (
        <div className="st-deck-row">
          <button
            type="button"
            className="st-deck-button"
            disabled={game.deckCount === 0}
            onClick={() => handleDeckPick('clan')}
          >
            클랜 덱 ({game.deckCount})
          </button>
          <button
            type="button"
            className="st-deck-button tactic"
            disabled={game.tacticDeckCount === 0}
            onClick={() => handleDeckPick('tactic')}
          >
            전술 덱 ({game.tacticDeckCount})
          </button>
        </div>
      )}

      {/* 내 정보 + 손패 */}
      <div className="st-player-bar st-your-bar">
        <div className="st-player-info">
          <span className={`st-turn-dot${isMyTurn ? ' active' : ''}`} />
          <span className="st-player-name">{yourName} (나)</span>
          <span className="st-player-meta">덱 {game.deckCount}장</span>
          {game.tacticMode && (
            <>
              <span className="st-player-meta">전술덱 {game.tacticDeckCount}장</span>
              <span className="st-player-meta">전술 {game.yourPlayedTactics}</span>
            </>
          )}
        </div>
        <div className="st-player-stones">돌 {game.yourStoneCount}개</div>
      </div>

      <div className="st-hand">
        {game.yourHand.map((card, i) => (
          <button
            key={`${card.tactic ?? 'clan'}-${card.color}-${card.rank}-${i}`}
            type="button"
            className={`st-hand-slot${selectedHandIndex === i ? ' selected' : ''}`}
            onClick={() => handleHandClick(i)}
            disabled={
              !isMyTurn ||
              (game.phase !== 'play' && game.phase !== 'recruiter_return')
            }
          >
            <ClanCard card={card} />
          </button>
        ))}
      </div>
    </div>
  );
}
