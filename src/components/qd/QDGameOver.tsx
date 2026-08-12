import type { QDGameOver as QDGameOverPayload, QDSide } from '../../types/quoridor';
import './QDGameOver.css';

const REASON_LABEL: Record<QDGameOverPayload['reason'], string> = {
  reach_goal: '골 라인 도달',
};

interface QDGameOverProps {
  result: QDGameOverPayload;
  yourSide: QDSide | null;
  onPlayAgain: () => void;
}

export function QDGameOver({ result, yourSide, onPlayAgain }: QDGameOverProps) {
  const youWon = yourSide !== null && result.winner === yourSide;

  return (
    <div className="qd-game-over">
      <div className="qd-over-container">
        <h1 className="qd-over-title">{youWon ? '🏆 승리!' : '패배...'}</h1>
        <p className="qd-over-reason">
          <strong>{result.winnerName}</strong>님 승리 — {REASON_LABEL[result.reason]}
        </p>

        <button type="button" className="qd-action-button" onClick={onPlayAgain}>
          다시 하기
        </button>
      </div>
    </div>
  );
}
