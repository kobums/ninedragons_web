import './GameSelection.css';

interface GameSelectionProps {
  onSelectGame: (game: 'ninedragons' | 'numberchange') => void;
}

export function GameSelection({ onSelectGame }: GameSelectionProps) {
  return (
    <div className="game-selection">
      <div className="game-selection-container">
        <h1 className="game-selection-title">게임 선택</h1>
        <div className="game-cards">
          <div
            className="game-card ninedragons"
            onClick={() => onSelectGame('ninedragons')}
          >
            <div className="game-card-content">
              <h2>구룡투</h2>
              <p className="game-description">
                전략적 타일 배치 게임
              </p>
              <div className="game-info">
                <span>👥 2인</span>
                <span>⏱️ 10-15분</span>
              </div>
            </div>
          </div>

          <div
            className="game-card numberchange"
            onClick={() => onSelectGame('numberchange')}
          >
            <div className="game-card-content">
              <h2>넘버체인지</h2>
              <p className="game-description">
                숫자 블록 합계 대결 게임
              </p>
              <div className="game-info">
                <span>👥 2인</span>
                <span>⏱️ 15-20분</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
