import { useState } from 'react';
import { useRematchCountdown } from '../../hooks/useRematchCountdown';
import type { CSGameOver as CSGameOverPayload, CSSide } from '../../types/cantstop';
import './CSGameOver.css';

interface CSGameOverProps {
  result: CSGameOverPayload;
  yourSide: CSSide | null;
  onPlayAgain: () => void;
  rematchOffered: boolean;
  onRematch: () => void;
}

export function CSGameOver({
  result,
  yourSide,
  onPlayAgain,
  rematchOffered,
  onRematch,
}: CSGameOverProps) {
  const [requested, setRequested] = useState(false);
  // 서버의 재대결 창(60초)에 맞춘 남은 시간
  const { secondsLeft, expired } = useRematchCountdown();

  const youWon = yourSide !== null && result.winner === yourSide;

  return (
    <div className="cs-game-over">
      <div className="cs-over-container">
        <h1 className="cs-over-title">{youWon ? '🏆 승리!' : '패배...'}</h1>
        <p className="cs-over-reason">
          <strong>{result.winnerName}</strong>님이 {result.claimedCols.join('·')} 컬럼을 완등했습니다
        </p>

        {rematchOffered && !requested && !expired && (
          <p className="cs-rematch-offer">상대가 재대결을 원합니다!</p>
        )}
        <button
          type="button"
          className="cs-action-button"
          disabled={requested || expired}
          onClick={() => {
            setRequested(true);
            onRematch();
          }}
        >
          {expired
            ? '재대결 시간 만료'
            : requested
              ? '상대 수락 대기 중...'
              : rematchOffered
                ? '🔁 재대결 수락'
                : '🔁 재대결 신청'}
        </button>
        {!expired && (
          <p className="cs-rematch-countdown">재대결 가능 시간 {secondsLeft}초</p>
        )}
        <button type="button" className="cs-secondary-button" onClick={onPlayAgain}>
          새 게임 찾기
        </button>
      </div>
    </div>
  );
}
