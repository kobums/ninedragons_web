import type { TeamColor, NCRoundHistory } from '../../types/numberchange';
import './NCGameOver.css';

interface NCGameOverProps {
  winner: TeamColor | '';
  team1Score: number;
  team2Score: number;
  team1Name: string;
  team2Name: string;
  yourTeam: TeamColor | null;
  roundHistory: NCRoundHistory[];
  onPlayAgain: () => void;
}

export function NCGameOver({
  winner,
  team1Score,
  team2Score,
  team1Name,
  team2Name,
  yourTeam,
  roundHistory,
  onPlayAgain,
}: NCGameOverProps) {
  const isWinner = winner === yourTeam;
  const isDraw = winner === '';

  return (
    <div className="nc-game-over">
      <div className="nc-game-over-container">
        <div
          className={`nc-result-banner ${
            isDraw ? 'draw' : isWinner ? 'win' : 'lose'
          }`}
        >
          {isDraw ? (
            <>
              <h1 className="nc-result-title">무승부!</h1>
              <p className="nc-result-subtitle">훌륭한 대결이었습니다!</p>
            </>
          ) : isWinner ? (
            <>
              <h1 className="nc-result-title">승리!</h1>
              <p className="nc-result-subtitle">축하합니다!</p>
            </>
          ) : (
            <>
              <h1 className="nc-result-title">패배</h1>
              <p className="nc-result-subtitle">다음 기회에!</p>
            </>
          )}
        </div>

        <div className="nc-final-score">
          <div
            className={`nc-final-team ${
              yourTeam === 'team1' ? 'your-team' : ''
            }`}
          >
            <span className="nc-final-team-label">{team1Name || '블루'}</span>
            <span className="nc-final-team-score team1-color">
              {team1Score}
            </span>
          </div>
          <div className="nc-final-separator">:</div>
          <div
            className={`nc-final-team ${
              yourTeam === 'team2' ? 'your-team' : ''
            }`}
          >
            <span className="nc-final-team-label">{team2Name || '빨강'}</span>
            <span className="nc-final-team-score team2-color">
              {team2Score}
            </span>
          </div>
        </div>

        <div className="nc-game-stats">
          <h3>게임 통계</h3>
          <div className="nc-stats-grid">
            <div className="nc-stat-item">
              <span className="nc-stat-label">총 라운드</span>
              <span className="nc-stat-value">{roundHistory.length}</span>
            </div>
            <div className="nc-stat-item">
              <span className="nc-stat-label">{team1Name || '블루'} 승리</span>
              <span className="nc-stat-value team1-color">{team1Score}</span>
            </div>
            <div className="nc-stat-item">
              <span className="nc-stat-label">{team2Name || '빨강'} 승리</span>
              <span className="nc-stat-value team2-color">{team2Score}</span>
            </div>
            <div className="nc-stat-item">
              <span className="nc-stat-label">무승부</span>
              <span className="nc-stat-value">
                {roundHistory.filter((r) => r.winner === '').length}
              </span>
            </div>
          </div>
        </div>

        <div className="nc-round-summary">
          <h3>라운드별 결과</h3>
          <div className="nc-summary-list">
            {roundHistory.map((round) => (
              <div key={round.round} className="nc-summary-item">
                <div className="nc-summary-round">R{round.round}</div>
                <div className="nc-summary-details">
                  <div className="nc-summary-team team1-color">
                    {team1Name || '블루'}:{' '}
                    {`${round.team1Block1} + ${round.team1Block2} = ${
                      round.team1Total
                    }${round.team1Hidden ? ' (히든)' : ''}`}
                  </div>
                  <div className="nc-summary-vs">VS</div>
                  <div className="nc-summary-team team2-color">
                    {team2Name || '빨강'}:{' '}
                    {`${round.team2Block1} + ${round.team2Block2} = ${
                      round.team2Total
                    }${round.team2Hidden ? ' (히든)' : ''}`}
                  </div>
                </div>
                <div
                  className={`nc-summary-winner ${
                    round.winner === 'team1'
                      ? 'team1-color'
                      : round.winner === 'team2'
                      ? 'team2-color'
                      : 'draw-color'
                  }`}
                >
                  {round.winner
                    ? round.winner === 'team1'
                      ? `${team1Name || '블루'} 승`
                      : `${team2Name || '빨강'} 승`
                    : '무승부'}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="nc-game-over-actions">
          <button className="nc-play-again-button" onClick={onPlayAgain}>
            다시 하기
          </button>
        </div>
      </div>
    </div>
  );
}
