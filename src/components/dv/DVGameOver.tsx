import type { DVGameOver as DVGameOverPayload } from '../../types/davinci';
import { DVTileRow } from './DVTileRow';
import './DVGameOver.css';

interface DVGameOverProps {
  result: DVGameOverPayload;
  yourSeat: number | null;
  onPlayAgain: () => void;
}

export function DVGameOver({ result, yourSeat, onPlayAgain }: DVGameOverProps) {
  const youWon = yourSeat !== null && result.winnerSeat === yourSeat;

  return (
    <div className="dv-game-over">
      <div className="dv-game-over-container">
        <h1 className="dv-over-title">{youWon ? '🏆 승리!' : '게임 종료'}</h1>
        <p className="dv-over-winner">
          승자: <strong>{result.winnerName}</strong>
          {result.reason === 'forfeit_win' && ' (상대 몰수패)'}
        </p>

        <div className="dv-over-board">
          {result.players.map((p) => (
            <DVTileRow
              key={p.seat}
              player={p}
              isYou={p.seat === yourSeat}
              isCurrent={p.seat === result.winnerSeat}
            />
          ))}
        </div>

        <button type="button" className="dv-primary-button" onClick={onPlayAgain}>
          다시 하기
        </button>
      </div>
    </div>
  );
}
