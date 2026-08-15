import { useState } from 'react';
import { useRematchCountdown } from '../../hooks/useRematchCountdown';
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
  rematchOffered: boolean;
  onRematch: () => void;
}

export function OTGameOver({
  result,
  yourSide,
  onPlayAgain,
  rematchOffered,
  onRematch,
}: OTGameOverProps) {
  const [requested, setRequested] = useState(false);
  // 서버의 재대결 창(60초)에 맞춘 남은 시간
  const { secondsLeft, expired } = useRematchCountdown();

  const youWon = yourSide !== null && result.winner === yourSide;

  return (
    <div className="ot-game-over">
      <div className="ot-over-container">
        <h1 className="ot-over-title">{youWon ? '🏆 승리!' : '패배...'}</h1>
        <p className="ot-over-reason">
          <strong>{result.winnerName}</strong>님 승리 — {REASON_LABEL[result.reason]}
        </p>

        {rematchOffered && !requested && !expired && (
          <p className="ot-rematch-offer">상대가 재대결을 원합니다!</p>
        )}
        <button
          type="button"
          className="ot-action-button"
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
          <p className="ot-rematch-countdown">재대결 가능 시간 {secondsLeft}초</p>
        )}
        <button type="button" className="ot-secondary-button" onClick={onPlayAgain}>
          새 게임 찾기
        </button>
      </div>
    </div>
  );
}
