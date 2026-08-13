import type { LCGameOver as LCGameOverPayload, LCSide } from '../../types/lostcities';
import './LCGameOver.css';

interface LCGameOverProps {
  result: LCGameOverPayload;
  yourSide: LCSide | null;
  onPlayAgain: () => void;
}

export function LCGameOver({ result, yourSide, onPlayAgain }: LCGameOverProps) {
  const isTie = result.winner === '';
  const youWon = !isTie && yourSide !== null && result.winner === yourSide;
  const myScore = yourSide === 'north' ? result.northScore : result.southScore;
  const oppScore = yourSide === 'north' ? result.southScore : result.northScore;

  return (
    <div className="lc-game-over">
      <div className="lc-over-container">
        <h1 className="lc-over-title">{isTie ? '무승부' : youWon ? '🏆 승리!' : '패배...'}</h1>
        <p className="lc-over-reason">
          {isTie ? (
            <>동점입니다</>
          ) : (
            <>
              <strong>{result.winnerName}</strong>님 승리
            </>
          )}
        </p>

        <div className="lc-over-scores">
          <div className="lc-over-score">
            <span className="lc-over-score-label">나</span>
            <span className="lc-over-score-value">{myScore}점</span>
          </div>
          <div className="lc-over-score">
            <span className="lc-over-score-label">상대</span>
            <span className="lc-over-score-value">{oppScore}점</span>
          </div>
        </div>

        <button type="button" className="lc-action-button" onClick={onPlayAgain}>
          다시 하기
        </button>
      </div>
    </div>
  );
}
