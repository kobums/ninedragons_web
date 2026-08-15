import { useState } from 'react';
import { useRematchCountdown } from '../../hooks/useRematchCountdown';
import type { JHGameOver as JHGameOverResult, JHRole } from '../../types/jekyllhyde';
import './JHGameOver.css';

interface JHGameOverProps {
  result: JHGameOverResult;
  yourRole: JHRole | null;
  onPlayAgain: () => void;
  rematchOffered: boolean;
  onRematch: () => void;
}

const REASON_LABELS: Record<JHGameOverResult['reason'], string> = {
  corrupted: '하이드가 인격을 완전히 잠식했습니다',
  survived: '지킬이 세 밤을 버텨냈습니다',
  forfeit: '상대 몰수',
};

export function JHGameOver({
  result,
  yourRole,
  onPlayAgain,
  rematchOffered,
  onRematch,
}: JHGameOverProps) {
  const [requested, setRequested] = useState(false);
  // 서버의 재대결 창(60초)에 맞춘 남은 시간
  const { secondsLeft, expired } = useRematchCountdown();

  const youWon = yourRole !== null && result.winner === yourRole;
  const winnerName =
    result.winner === 'jekyll' ? result.jekyllName : result.hydeName;
  const winnerLabel = result.winner === 'jekyll' ? '지킬' : '하이드';

  return (
    <div className="jh-game-over">
      <div className="jh-game-over-container">
        <span className="jh-game-over-eyebrow">게임 종료</span>
        <h1 className={`jh-game-over-title${youWon ? ' win' : ''}`}>
          {youWon ? '승리!' : '패배'}
        </h1>
        <p className="jh-game-over-reason">
          {winnerName}({winnerLabel})님의 승리 — {REASON_LABELS[result.reason]}
        </p>

        <table className="jh-round-table">
          <thead>
            <tr>
              <th>라운드</th>
              <th>지킬</th>
              <th>하이드</th>
              <th>마커 이동</th>
            </tr>
          </thead>
          <tbody>
            {result.roundResults.map((r) => (
              <tr key={r.round}>
                <td>{r.round}</td>
                <td>{r.jekyllTricks}</td>
                <td>{r.hydeTricks}</td>
                <td>+{r.moved}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {rematchOffered && !requested && !expired && (
          <p className="jh-rematch-offer">상대가 재대결을 원합니다!</p>
        )}
        <button
          type="button"
          className="jh-action-button"
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
          <p className="jh-rematch-countdown">재대결 가능 시간 {secondsLeft}초</p>
        )}
        <button type="button" className="jh-secondary-button" onClick={onPlayAgain}>
          새 게임 찾기
        </button>
      </div>
    </div>
  );
}
