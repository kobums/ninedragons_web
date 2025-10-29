import type { NCGameState, TeamColor } from '../../types/numberchange';
import './NCGameBoard.css';

interface NCGameBoardProps {
  gameState: NCGameState;
  onSelectBlock: (blockIndex: number) => void;
  onSubmit: (useHidden: boolean) => void;
  isMyTurn: boolean;
  canSubmit: boolean;
  getSelectedBlocks: () => { block1: number; block2: number } | null;
  onDismissHiddenNotification: () => void;
  onSelectHiddenBlock: (choice: number) => void;
  onConfirmHiddenSelection: () => void;
}

export function NCGameBoard({
  gameState,
  onSelectBlock,
  onSubmit,
  isMyTurn,
  canSubmit,
  getSelectedBlocks,
  onDismissHiddenNotification,
  onSelectHiddenBlock,
  onConfirmHiddenSelection,
}: NCGameBoardProps) {
  const getTeamColorClass = (team: TeamColor) => {
    return team === 'team1' ? 'team1-color' : 'team2-color';
  };

  const isBlockSelected = (blockIndex: number): 1 | 2 | null => {
    if (gameState.selectedBlock1Index === blockIndex) return 1;
    if (gameState.selectedBlock2Index === blockIndex) return 2;
    return null;
  };

  const selectedBlocks = getSelectedBlocks();

  const handleSubmit = (useHidden: boolean) => {
    if (canSubmit) {
      onSubmit(useHidden);
    }
  };

  return (
    <div className="nc-game-board">
      {/* 히든 찬스 사용 알림 */}
      {gameState.opponentUsedHiddenNotification && (
        <div className="nc-hidden-notification-overlay" onClick={onDismissHiddenNotification}>
          <div className="nc-hidden-notification" onClick={(e) => e.stopPropagation()}>
            <h2>⚠️ 상대방이 히든 찬스를 사용했습니다!</h2>
            <p>상대방의 블록 중 하나를 선택할 수 있습니다.</p>
            <button onClick={onDismissHiddenNotification}>확인</button>
          </div>
        </div>
      )}

      {/* 히든 블록 선택 UI */}
      {gameState.showHiddenBlockSelection && (
        <div className="nc-hidden-notification-overlay">
          <div className="nc-hidden-notification" onClick={(e) => e.stopPropagation()}>
            <h2>블록 선택</h2>
            <p>상대방의 블록 중 하나를 선택하세요</p>
            <div className="nc-hidden-block-choices">
              <button
                className={`nc-hidden-choice ${gameState.selectedBlockChoice === 1 ? 'selected' : ''}`}
                onClick={() => onSelectHiddenBlock(1)}
              >
                블록 1
              </button>
              <button
                className={`nc-hidden-choice ${gameState.selectedBlockChoice === 2 ? 'selected' : ''}`}
                onClick={() => onSelectHiddenBlock(2)}
              >
                블록 2
              </button>
            </div>
            <button
              className="nc-confirm-button"
              onClick={onConfirmHiddenSelection}
              disabled={gameState.selectedBlockChoice === null}
            >
              확인
            </button>
          </div>
        </div>
      )}


      <div className="nc-game-container">
        {/* 헤더 정보 */}
        <div className="nc-game-header">
          <div className="nc-round-info">
            <span className="nc-round-label">라운드</span>
            <span className="nc-round-number">{gameState.currentRound}/12</span>
          </div>

          <div className="nc-score-board">
            <div className={`nc-team-score ${gameState.yourTeam === 'team1' ? 'your-team' : ''}`}>
              <span className="nc-team-label">{gameState.team1Name || '블루'}</span>
              <span className="nc-score team1-color">{gameState.team1Score}</span>
            </div>
            <div className="nc-score-separator">:</div>
            <div className={`nc-team-score ${gameState.yourTeam === 'team2' ? 'your-team' : ''}`}>
              <span className="nc-team-label">{gameState.team2Name || '빨강'}</span>
              <span className="nc-score team2-color">{gameState.team2Score}</span>
            </div>
          </div>

          <div className="nc-turn-indicator">
            <span className="nc-your-turn">블록을 선택하세요</span>
          </div>
        </div>

        {/* 사용 가능한 블록 */}
        <div className="nc-blocks-section">
          <h3>내 블록 선택</h3>
          <div className="nc-blocks-grid">
            {gameState.availableBlocks.map((block, index) => {
              const selectionPosition = isBlockSelected(index);
              return (
                <button
                  key={`${block}-${index}`}
                  className={`nc-block ${selectionPosition ? `selected-${selectionPosition}` : ''}`}
                  onClick={() => onSelectBlock(index)}
                >
                  <span className="nc-block-number">{block}</span>
                  {selectionPosition && (
                    <span className="nc-selection-badge">{selectionPosition}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* 선택된 블록 표시 */}
        {selectedBlocks && (
          <div className="nc-selected-blocks">
            <h3>선택된 블록</h3>
            <div className="nc-selected-display">
              <div className="nc-selected-item">
                <span className="nc-selected-label">블록 1:</span>
                <span className="nc-selected-value">
                  {selectedBlocks.block1}
                </span>
              </div>
              <div className="nc-selected-plus">+</div>
              <div className="nc-selected-item">
                <span className="nc-selected-label">블록 2:</span>
                <span className="nc-selected-value">
                  {selectedBlocks.block2}
                </span>
              </div>
              <div className="nc-selected-equals">=</div>
              <div className="nc-selected-item">
                <span className="nc-selected-label">합계:</span>
                <span className="nc-selected-total">
                  {selectedBlocks.block1 + selectedBlocks.block2}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 제출 버튼 */}
        <div className="nc-submit-section">
            <button
              className="nc-submit-button normal"
              onClick={() => handleSubmit(false)}
              disabled={!canSubmit}
            >
              제출하기
            </button>
            {!gameState.hasUsedHidden && (
              <button
                className="nc-submit-button hidden"
                onClick={() => handleSubmit(true)}
                disabled={!canSubmit}
              >
                히든 찬스 사용
              </button>
            )}
        </div>

        {/* 히든 찬스 상태 */}
        <div className="nc-hidden-status">
          <div className={`nc-hidden-item ${gameState.hasUsedHidden ? 'used' : ''}`}>
            내 히든 찬스: {gameState.hasUsedHidden ? '사용됨' : '사용 가능'}
          </div>
          <div className={`nc-hidden-item ${gameState.opponentHasUsedHidden ? 'used' : ''}`}>
            상대 히든 찬스: {gameState.opponentHasUsedHidden ? '사용됨' : '사용 가능'}
          </div>
        </div>

        {/* 라운드 히스토리 */}
        {gameState.roundHistory.length > 0 && (
          <div className="nc-history">
            <h3>라운드 히스토리</h3>
            <div className="nc-history-list">
              {gameState.roundHistory.slice().reverse().map((round) => (
                <div key={round.round} className="nc-history-item">
                  <div className="nc-history-round">R{round.round}</div>
                  <div className="nc-history-blocks">
                    <div className="nc-history-team">
                      <span className="team1-color">
                        {gameState.team1Name || '블루'}: {round.team1Hidden ? '???' : `${round.team1Block1} + ${round.team1Block2} = ${round.team1Total}`}
                      </span>
                    </div>
                    <div className="nc-history-vs">VS</div>
                    <div className="nc-history-team">
                      <span className="team2-color">
                        {gameState.team2Name || '빨강'}: {round.team2Hidden ? '???' : `${round.team2Block1} + ${round.team2Block2} = ${round.team2Total}`}
                      </span>
                    </div>
                  </div>
                  <div className={`nc-history-winner ${getTeamColorClass(round.winner)}`}>
                    {round.winner ? `${round.winner === 'team1' ? (gameState.team1Name || '블루') : (gameState.team2Name || '빨강')} 승리` : '무승부'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
