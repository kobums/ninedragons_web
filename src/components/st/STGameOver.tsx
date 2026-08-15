import { useState } from 'react';
import { useRematchCountdown } from '../../hooks/useRematchCountdown';
import type { STGameOver as STGameOverResult, STSide } from '../../types/schottentotten';
import './STGameOver.css';

interface STGameOverProps {
  result: STGameOverResult;
  yourSide: STSide | null;
  onPlayAgain: () => void;
  rematchOffered: boolean;
  onRematch: () => void;
}

const REASON_LABELS: Record<STGameOverResult['reason'], string> = {
  five_stones: '돌 5개 획득',
  three_adjacent: '나란히 붙은 돌 3개 획득',
  stalemate: '더 둘 수 없어 돌 개수로 승부',
  forfeit: '상대 몰수',
};

export function STGameOver({
  result,
  yourSide,
  onPlayAgain,
  rematchOffered,
  onRematch,
}: STGameOverProps) {
  const [requested, setRequested] = useState(false);
  // 서버의 재대결 창(60초)에 맞춘 남은 시간
  const { secondsLeft, expired } = useRematchCountdown();

  const youWon = yourSide !== null && result.winner === yourSide;
  const isDraw = result.winner === '';
  const winnerName =
    result.winner === 'south' ? result.southName : result.northName;

  const yourCount =
    yourSide === 'north' ? result.northCount : result.southCount;
  const oppCount = yourSide === 'north' ? result.southCount : result.northCount;

  return (
    <div className="st-game-over">
      <div className="st-game-over-container">
        <span className="st-game-over-eyebrow">게임 종료</span>
        <h1 className={`st-game-over-title${youWon ? ' win' : ''}`}>
          {isDraw ? '무승부' : youWon ? '승리!' : '패배'}
        </h1>
        <p className="st-game-over-reason">
          {isDraw ? REASON_LABELS[result.reason] : `${winnerName}님이 이겼습니다 — ${REASON_LABELS[result.reason]}`}
        </p>

        <div className="st-game-over-score">
          <div className="st-score-cell">
            <span className="st-score-label">내 돌</span>
            <span className="st-score-value">{yourCount}</span>
          </div>
          <span className="st-score-divider">:</span>
          <div className="st-score-cell">
            <span className="st-score-label">상대 돌</span>
            <span className="st-score-value">{oppCount}</span>
          </div>
        </div>

        {rematchOffered && !requested && !expired && (
          <p className="st-rematch-offer">상대가 재대결을 원합니다!</p>
        )}
        <button
          type="button"
          className="st-action-button"
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
          <p className="st-rematch-countdown">재대결 가능 시간 {secondsLeft}초</p>
        )}
        <button type="button" className="st-secondary-button" onClick={onPlayAgain}>
          새 게임 찾기
        </button>
      </div>
    </div>
  );
}
