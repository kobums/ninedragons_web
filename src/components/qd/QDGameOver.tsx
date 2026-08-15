import { useState } from 'react';
import type { QDGameOver as QDGameOverPayload, QDSide } from '../../types/quoridor';
import './QDGameOver.css';

const REASON_LABEL: Record<QDGameOverPayload['reason'], string> = {
  reach_goal: '골 라인 도달',
};

interface QDGameOverProps {
  result: QDGameOverPayload;
  yourSide: QDSide | null;
  onPlayAgain: () => void;
  rematchOffered: boolean;
  onRematch: () => void;
}

export function QDGameOver({
  result,
  yourSide,
  onPlayAgain,
  rematchOffered,
  onRematch,
}: QDGameOverProps) {
  const [requested, setRequested] = useState(false);

  const youWon = yourSide !== null && result.winner === yourSide;

  return (
    <div className="qd-game-over">
      <div className="qd-over-container">
        <h1 className="qd-over-title">{youWon ? '🏆 승리!' : '패배...'}</h1>
        <p className="qd-over-reason">
          <strong>{result.winnerName}</strong>님 승리 — {REASON_LABEL[result.reason]}
        </p>

        {rematchOffered && !requested && (
          <p className="qd-rematch-offer">상대가 재대결을 원합니다!</p>
        )}
        <button
          type="button"
          className="qd-action-button"
          disabled={requested}
          onClick={() => {
            setRequested(true);
            onRematch();
          }}
        >
          {requested ? '상대 수락 대기 중...' : rematchOffered ? '🔁 재대결 수락' : '🔁 재대결 신청'}
        </button>
        <button type="button" className="qd-secondary-button" onClick={onPlayAgain}>
          새 게임 찾기
        </button>
      </div>
    </div>
  );
}
