import './GameSelection.css';

interface GameSelectionProps {
  onSelectGame: (
    game:
      | 'ninedragons'
      | 'numberchange'
      | 'davinci'
      | 'schottentotten'
      | 'jekyllhyde',
  ) => void;
}

export function GameSelection({ onSelectGame }: GameSelectionProps) {
  return (
    <div className="game-selection">
      <div className="game-selection-container">
        <header className="game-selection-header">
          <span className="game-selection-eyebrow">친구와 함께하는 보드게임</span>
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

          <button
            type="button"
            className="game-card davinci"
            onClick={() => onSelectGame('davinci')}
          >
            <div className="game-card-content">
              <span className="game-card-tag">추리 · 심리전</span>
              <h2>다빈치 코드</h2>
              <p className="game-description">숫자 타일 추리 게임</p>
              <div className="game-meta">
                <span>2~4인</span>
                <span>10-15분</span>
              </div>
            </div>
          </button>

          <button
            type="button"
            className="game-card schottentotten"
            onClick={() => onSelectGame('schottentotten')}
          >
            <div className="game-card-content">
              <span className="game-card-tag">전략 · 족보</span>
              <h2>쇼텐토텐</h2>
              <p className="game-description">국경석을 둔 카드 진형 대결</p>
              <div className="game-meta">
                <span>2인</span>
                <span>15-20분</span>
              </div>
            </div>
          </button>

          <button
            type="button"
            className="game-card jekyllhyde"
            onClick={() => onSelectGame('jekyllhyde')}
          >
            <div className="game-card-content">
              <span className="game-card-tag">트릭테이킹 · 심리전</span>
              <h2>지킬 앤 하이드</h2>
              <p className="game-description">인격을 건 카드 트릭 대결</p>
              <div className="game-meta">
                <span>2인</span>
                <span>15-20분</span>
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
