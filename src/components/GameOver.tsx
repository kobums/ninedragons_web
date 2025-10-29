import React from 'react';
import type { PlayerColor, RoundHistory } from '../types/game';
import './GameOver.css';

interface GameOverProps {
  winner: PlayerColor | '';
  blueWins: number;
  redWins: number;
  blueName: string;
  redName: string;
  yourColor: PlayerColor | null;
  roundHistory: RoundHistory[];
  onPlayAgain: () => void;
}

export const GameOver: React.FC<GameOverProps> = ({
  winner,
  blueWins,
  redWins,
  blueName,
  redName,
  yourColor,
  roundHistory,
  onPlayAgain,
}) => {
  const isWinner = winner === yourColor;
  const isDraw = winner === '';

  const renderRoundHistory = () => {
    return Array.from({ length: 9 }, (_, index) => {
      const roundNum = index + 1;
      const roundData = roundHistory.find((r) => r.round === roundNum);

      return (
        <div key={roundNum} className="history-round">
          <div className="history-round-number">R{roundNum}</div>
          <div className="history-tiles">
            <div className={`history-tile blue ${roundData?.winner === 'blue' ? 'winner-tile' : ''}`}>
              {roundData?.blueTile ? (
                <>
                  <span className="tile-number">{roundData.blueTile}</span>
                  <span className={roundData.blueTile % 2 === 1 ? 'white-circle' : 'black-circle'}>
                    {roundData.blueTile % 2 === 1 ? '○' : '●'}
                  </span>
                </>
              ) : (
                <span className="no-tile">-</span>
              )}
            </div>
            <div className="vs-divider">vs</div>
            <div className={`history-tile red ${roundData?.winner === 'red' ? 'winner-tile' : ''}`}>
              {roundData?.redTile ? (
                <>
                  <span className="tile-number">{roundData.redTile}</span>
                  <span className={roundData.redTile % 2 === 1 ? 'white-circle' : 'black-circle'}>
                    {roundData.redTile % 2 === 1 ? '○' : '●'}
                  </span>
                </>
              ) : (
                <span className="no-tile">-</span>
              )}
            </div>
          </div>
          {roundData?.winner && (
            <div className={`history-winner-badge ${roundData.winner}`}>
              {roundData.winner === 'blue' ? `${blueName || '파랑'} 승` : `${redName || '빨강'} 승`}
            </div>
          )}
          {roundData && !roundData.winner && roundData.blueTile && roundData.redTile && (
            <div className="history-winner-badge draw">무승부</div>
          )}
        </div>
      );
    });
  };

  return (
    <div className="game-over-overlay">
      <div className="game-over-modal">
        <h1 className="game-over-title">게임 종료!</h1>

        <div className="final-score">
          <div className={`final-score-item blue ${winner === 'blue' ? 'winner' : ''}`}>
            <span className="color-label">{blueName || '파랑'}</span>
            <span className="score-value">{blueWins}</span>
          </div>
          <div className="score-divider">:</div>
          <div className={`final-score-item red ${winner === 'red' ? 'winner' : ''}`}>
            <span className="color-label">{redName || '빨강'}</span>
            <span className="score-value">{redWins}</span>
          </div>
        </div>

        <div className={`result-message ${isDraw ? 'draw' : isWinner ? 'win' : 'lose'}`}>
          {isDraw ? (
            <h2>무승부!</h2>
          ) : isWinner ? (
            <>
              <h2>🎉 승리! 🎉</h2>
              <p>축하합니다! 당신이 이겼습니다!</p>
            </>
          ) : (
            <>
              <h2>😢 패배</h2>
              <p>다음에는 더 잘할 수 있을 거예요!</p>
            </>
          )}
        </div>

        <div className="round-history-section">
          <h3 className="history-title">라운드 결과</h3>
          <div className="round-history-grid">
            {renderRoundHistory()}
          </div>
        </div>

        <button className="play-again-btn" onClick={onPlayAgain}>
          다시 플레이
        </button>
      </div>
    </div>
  );
};
