import { useEffect, useState } from 'react';
import type { STCard, STEvent, STGameState } from '../../types/schottentotten';
import './STGameBoard.css';

interface STGameBoardProps {
  game: STGameState;
  lastEvent: STEvent | null;
  onPlayCard: (handIndex: number, stoneIndex: number) => void;
  onClaimStone: (stoneIndex: number) => void;
  onEndTurn: () => void;
}

function ClanCard({ card, small }: { card: STCard; small?: boolean }) {
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
  onClaimStone,
  onEndTurn,
}: STGameBoardProps) {
  const [selectedHandIndex, setSelectedHandIndex] = useState<number | null>(null);

  const isMyTurn = game.currentSide === game.yourSide;
  const opponentName =
    game.yourSide === 'south' ? game.northName : game.southName;
  const yourName = game.yourSide === 'south' ? game.southName : game.northName;

  // 턴이 바뀌거나 손패가 갱신되면 선택을 초기화한다
  useEffect(() => {
    setSelectedHandIndex(null);
  }, [game.yourHand.length, game.currentSide, game.phase]);

  const canPlayOn = (stoneIndex: number): boolean => {
    const stone = game.stones[stoneIndex];
    return (
      isMyTurn &&
      game.phase === 'play' &&
      selectedHandIndex !== null &&
      stone.owner === '' &&
      stone.yourCards.length < 3
    );
  };

  const handleLaneClick = (stoneIndex: number) => {
    const stone = game.stones[stoneIndex];
    if (game.phase === 'claim' && isMyTurn && stone.claimable) {
      onClaimStone(stoneIndex);
      return;
    }
    if (canPlayOn(stoneIndex) && selectedHandIndex !== null) {
      onPlayCard(selectedHandIndex, stoneIndex);
      setSelectedHandIndex(null);
    }
  };

  const statusText = (() => {
    if (game.phase === 'claim') {
      return isMyTurn
        ? '가져올 수 있는 돌이 있습니다! 돌을 누르거나 턴을 마치세요'
        : `${opponentName}님이 돌을 가져가는 중...`;
    }
    if (isMyTurn) {
      return selectedHandIndex === null
        ? '손패에서 카드를 선택하세요'
        : '카드를 놓을 돌을 선택하세요';
    }
    return `${opponentName}님의 차례입니다`;
  })();

  return (
    <div className="st-board">
      {/* 상대 정보 */}
      <div className="st-player-bar st-opponent-bar">
        <div className="st-player-info">
          <span className={`st-turn-dot${!isMyTurn ? ' active' : ''}`} />
          <span className="st-player-name">{opponentName}</span>
          <span className="st-player-meta">손패 {game.opponentHandCount}장</span>
        </div>
        <div className="st-player-stones">돌 {game.oppStoneCount}개</div>
      </div>

      {/* 보드: 9개 레인 */}
      <div className="st-lanes">
        {game.stones.map((stone) => {
          const flash =
            lastEvent?.stoneIndex === stone.index &&
            (lastEvent.kind === 'card_played' || lastEvent.kind === 'stone_claimed');
          const playable = canPlayOn(stone.index);
          const claimNow = game.phase === 'claim' && isMyTurn && stone.claimable;
          return (
            <button
              key={stone.index}
              type="button"
              className={[
                'st-lane',
                playable ? 'playable' : '',
                claimNow ? 'claimable' : '',
                flash ? 'flash' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => handleLaneClick(stone.index)}
              disabled={!playable && !claimNow}
            >
              <div className="st-lane-cards st-lane-opp">
                {stone.oppCards.map((card, i) => (
                  <ClanCard key={i} card={card} small />
                ))}
              </div>

              <div
                className={[
                  'st-stone',
                  stone.owner === 'you' ? 'owned-you' : '',
                  stone.owner === 'opponent' ? 'owned-opp' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {claimNow ? '획득!' : stone.index + 1}
              </div>

              <div className="st-lane-cards st-lane-you">
                {stone.yourCards.map((card, i) => (
                  <ClanCard key={i} card={card} small />
                ))}
              </div>
            </button>
          );
        })}
      </div>

      {/* 상태 안내 + 턴 마치기 */}
      <div className="st-status-row">
        <span className="st-status-text">{statusText}</span>
        {game.phase === 'claim' && isMyTurn && (
          <button type="button" className="st-end-turn-button" onClick={onEndTurn}>
            턴 마치기
          </button>
        )}
      </div>

      {/* 내 정보 + 손패 */}
      <div className="st-player-bar st-your-bar">
        <div className="st-player-info">
          <span className={`st-turn-dot${isMyTurn ? ' active' : ''}`} />
          <span className="st-player-name">{yourName} (나)</span>
          <span className="st-player-meta">덱 {game.deckCount}장</span>
        </div>
        <div className="st-player-stones">돌 {game.yourStoneCount}개</div>
      </div>

      <div className="st-hand">
        {game.yourHand.map((card, i) => (
          <button
            key={`${card.color}-${card.rank}`}
            type="button"
            className={`st-hand-slot${selectedHandIndex === i ? ' selected' : ''}`}
            onClick={() =>
              setSelectedHandIndex(selectedHandIndex === i ? null : i)
            }
            disabled={!isMyTurn || game.phase !== 'play'}
          >
            <ClanCard card={card} />
          </button>
        ))}
      </div>
    </div>
  );
}
