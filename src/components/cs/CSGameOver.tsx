import type { CSGameOver as CSGameOverPayload, CSSide } from '../../types/cantstop';
import './CSGameOver.css';

interface CSGameOverProps {
  result: CSGameOverPayload;
  yourSide: CSSide | null;
  onPlayAgain: () => void;
}

export function CSGameOver({ result, yourSide, onPlayAgain }: CSGameOverProps) {
  const youWon = yourSide !== null && result.winner === yourSide;

  return (
    <div className="cs-game-over">
      <div className="cs-over-container">
        <h1 className="cs-over-title">{youWon ? '🏆 승리!' : '패배...'}</h1>
        <p className="cs-over-reason">
          <strong>{result.winnerName}</strong>님이 {result.claimedCols.join('·')} 컬럼을 완등했습니다
        </p>

        <button type="button" className="cs-action-button" onClick={onPlayAgain}>
          다시 하기
        </button>
      </div>
    </div>
  );
}
