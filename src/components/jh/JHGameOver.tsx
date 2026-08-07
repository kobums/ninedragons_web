import type { JHGameOver as JHGameOverResult, JHRole } from '../../types/jekyllhyde';
import './JHGameOver.css';

interface JHGameOverProps {
  result: JHGameOverResult;
  yourRole: JHRole | null;
  onPlayAgain: () => void;
}

const REASON_LABELS: Record<JHGameOverResult['reason'], string> = {
  corrupted: '하이드가 인격을 완전히 잠식했습니다',
  survived: '지킬이 세 밤을 버텨냈습니다',
  forfeit: '상대 몰수',
};

export function JHGameOver({ result, yourRole, onPlayAgain }: JHGameOverProps) {
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

        <button type="button" className="jh-play-again-button" onClick={onPlayAgain}>
          다시 하기
        </button>
      </div>
    </div>
  );
}
