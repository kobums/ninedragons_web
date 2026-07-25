import './GameSelection.css';

interface GameSelectionProps {
  onSelectGame: (game: 'ninedragons' | 'numberchange') => void;
}

export function GameSelection({ onSelectGame }: GameSelectionProps) {
  return (
    <div className="game-selection">
      <div className="game-selection-container">
        <header className="game-selection-header">
          <span className="game-selection-eyebrow">두 사람을 위한 보드게임</span>
          <h1 className="game-selection-title">게임 선택</h1>
          <p className="game-selection-lead">
            함께 플레이할 게임을 골라주세요.
          </p>
        </header>

        <div className="game-cards">
          <button
            type="button"
            className="game-card ninedragons"
            onClick={() => onSelectGame('ninedragons')}
          >
            <div className="game-card-content">
              <span className="game-card-tag">전략 · 심리전</span>
              <h2>구룡투</h2>
              <p className="game-description">전략적 타일 배치 게임</p>
              <div className="game-meta">
                <span>2인</span>
                <span>5분</span>
              </div>
            </div>
          </button>

          <button
            type="button"
            className="game-card numberchange"
            onClick={() => onSelectGame('numberchange')}
          >
            <div className="game-card-content">
              <span className="game-card-tag">계산 · 교환</span>
              <h2>넘버체인지</h2>
              <p className="game-description">숫자 블록 합계 대결 게임</p>
              <div className="game-meta">
                <span>2인</span>
                <span>5-10분</span>
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
