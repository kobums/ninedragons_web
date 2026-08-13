import type { OTGameOver as OTGameOverPayload, OTSide } from '../../types/onitama';
import './OTGameOver.css';

const REASON_LABEL: Record<OTGameOverPayload['reason'], string> = {
  capture_master: '마스터 포획 (돌의 길)',
  reach_temple: '사원 도달 (개울의 길)',
};

interface OTGameOverProps {
  result: OTGameOverPayload;
  yourSide: OTSide | null;
  onPlayAgain: () => void;
}

export function OTGameOver({ result, yourSide, onPlayAgain }: OTGameOverProps) {
  const youWon = yourSide !== null && result.winner === yourSide;

  return (
    <div className="ot-game-over">
      <div className="ot-over-container">
        <h1 className="ot-over-title">{youWon ? '🏆 승리!' : '패배...'}</h1>
        <p className="ot-over-reason">
          <strong>{result.winnerName}</strong>님 승리 — {REASON_LABEL[result.reason]}
        </p>

        <button type="button" className="ot-action-button" onClick={onPlayAgain}>
          다시 하기
        </button>
      </div>
    </div>
  );
}
