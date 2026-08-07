import { useEffect, useState } from 'react';
import type { DVGameState, DVEvent } from '../../types/davinci';
import type { DVToast } from '../../hooks/useDVGameState';
import { DVTile, DVTileRow } from './DVTileRow';
import { DVActionPanel } from './DVActionPanel';
import './DVGameBoard.css';

interface DVGameBoardProps {
  game: DVGameState;
  toasts: DVToast[];
  onDraw: () => void;
  onGuess: (targetSeat: number, tileIndex: number, value: number) => void;
  onContinue: (cont: boolean) => void;
  onPlaceJoker: (tileId: number, position: number) => void;
  onRevealOwn: (tileIndex: number) => void;
}

// 이벤트 토스트 문구
function toastText(event: DVEvent, game: DVGameState): string {
  const name = (seat?: number) =>
    game.players.find((p) => p.seat === seat)?.name ?? '?';

  switch (event.kind) {
    case 'game_started':
      return `게임 시작! ${name(event.seat)}님부터 시작합니다`;
    case 'joker_placed':
      return `${name(event.seat)}님이 조커를 배치했습니다`;
    case 'tile_drawn':
      return `${name(event.seat)}님이 ${event.color === 'black' ? '검은' : '흰'} 타일을 뽑았습니다`;
    case 'guess_made': {
      const value = event.guessedValue === -1 ? '조커' : event.guessedValue;
      const verdict = event.correct ? '성공!' : '실패';
      return `${name(event.guesserSeat)} → ${name(event.targetSeat)}의 ${
        (event.tileIndex ?? 0) + 1
      }번째 타일을 「${value}」로 추리 — ${verdict}`;
    }
    case 'turn_stopped':
      return `${name(event.seat)}님이 추리를 멈췄습니다`;
    case 'tile_revealed':
      return `${name(event.seat)}의 타일 공개: ${event.value === -1 ? '조커' : event.value}`;
    case 'player_eliminated':
      return `${name(event.seat)}님 탈락!`;
    case 'player_forfeited':
      return `${name(event.seat)}님이 재접속하지 않아 몰수패 처리됐습니다`;
  }
}

export function DVGameBoard({
  game,
  toasts,
  onDraw,
  onGuess,
  onContinue,
  onPlaceJoker,
  onRevealOwn,
}: DVGameBoardProps) {
  // 로컬 입력 상태: 서버 스냅샷이 단계나 턴을 바꾸면 리셋한다
  const [selectedTarget, setSelectedTarget] = useState<{
    seat: number;
    tileIndex: number;
  } | null>(null);
  const [guessValue, setGuessValue] = useState<number | null>(null);

  useEffect(() => {
    setSelectedTarget(null);
    setGuessValue(null);
  }, [game.phase, game.currentSeat]);

  const me = game.players.find((p) => p.seat === game.yourSeat);
  const opponents = game.players.filter((p) => p.seat !== game.yourSeat);
  const myTurn = game.currentSeat === game.yourSeat && game.phase !== 'joker_setup';

  const guessMode = game.phase === 'guess' && myTurn;
  const myPendingJoker = game.yourPendingJokers?.[0];
  const jokerSetupMode = game.phase === 'joker_setup' && Boolean(myPendingJoker);
  const placeDrawnJokerMode =
    game.phase === 'place_drawn_joker' && myTurn && Boolean(game.drawnTile);
  const revealOwnMode = game.phase === 'reveal_own' && myTurn;

  const handleInsertAt = (position: number) => {
    if (jokerSetupMode && myPendingJoker) {
      onPlaceJoker(myPendingJoker.id, position);
    } else if (placeDrawnJokerMode && game.drawnTile) {
      onPlaceJoker(game.drawnTile.id, position);
    }
  };

  const handleConfirmGuess = () => {
    if (selectedTarget && guessValue !== null) {
      onGuess(selectedTarget.seat, selectedTarget.tileIndex, guessValue);
    }
  };

  return (
    <div className="dv-board">
      <div className="dv-toasts">
        {toasts.map((toast) => (
          <div key={toast.id} className="dv-toast">
            {toastText(toast.event, game)}
          </div>
        ))}
      </div>

      <div className="dv-opponents">
        {opponents.map((p) => (
          <DVTileRow
            key={p.seat}
            player={p}
            isYou={false}
            isCurrent={game.currentSeat === p.seat && game.phase !== 'joker_setup'}
            selectable={guessMode && !p.eliminated}
            selectedIndex={selectedTarget?.seat === p.seat ? selectedTarget.tileIndex : null}
            onSelectTile={(tileIndex) => {
              setSelectedTarget({ seat: p.seat, tileIndex });
            }}
          />
        ))}
      </div>

      <div className="dv-center">
        <div className="dv-deck">
          <div className="dv-deck-pile">{game.deckCount}</div>
          <span className="dv-deck-label">남은 타일</span>
        </div>
        {game.drawnTile && (
          <div className="dv-drawn">
            <DVTile tile={game.drawnTile} />
            <span className="dv-deck-label">
              {game.currentSeat === game.yourSeat ? '내가 뽑은 타일' : '뽑은 타일'}
            </span>
          </div>
        )}
        {jokerSetupMode && myPendingJoker && (
          <div className="dv-drawn">
            <DVTile tile={myPendingJoker} />
            <span className="dv-deck-label">배치할 조커</span>
          </div>
        )}
      </div>

      {me && (
        <div className="dv-my-area">
          <DVTileRow
            player={me}
            isYou
            isCurrent={myTurn}
            selectable={revealOwnMode}
            onSelectTile={revealOwnMode ? onRevealOwn : undefined}
            insertMode={jokerSetupMode || placeDrawnJokerMode}
            onInsertAt={handleInsertAt}
          />
        </div>
      )}

      <DVActionPanel
        game={game}
        myTurn={myTurn}
        selectedTarget={selectedTarget}
        guessValue={guessValue}
        onPickValue={setGuessValue}
        onConfirmGuess={handleConfirmGuess}
        onDraw={onDraw}
        onContinue={onContinue}
      />
    </div>
  );
}
