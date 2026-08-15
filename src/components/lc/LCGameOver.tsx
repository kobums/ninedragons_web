import { useState } from 'react';
import type { LCGameOver as LCGameOverPayload, LCSide } from '../../types/lostcities';
import './LCGameOver.css';

interface LCGameOverProps {
  result: LCGameOverPayload;
  yourSide: LCSide | null;
  onPlayAgain: () => void;
  rematchOffered: boolean;
  onRematch: () => void;
}

export function LCGameOver({
  result,
  yourSide,
  onPlayAgain,
  rematchOffered,
  onRematch,
}: LCGameOverProps) {
  const [requested, setRequested] = useState(false);

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

        {rematchOffered && !requested && (
          <p className="lc-rematch-offer">상대가 재대결을 원합니다!</p>
        )}
        <button
          type="button"
          className="lc-action-button"
          disabled={requested}
          onClick={() => {
            setRequested(true);
            onRematch();
          }}
        >
          {requested ? '상대 수락 대기 중...' : rematchOffered ? '🔁 재대결 수락' : '🔁 재대결 신청'}
        </button>
        <button type="button" className="lc-secondary-button" onClick={onPlayAgain}>
          새 게임 찾기
        </button>
      </div>
    </div>
  );
}
