import React from 'react';
import { Tile } from './Tile';
import type { GameState } from '../types/game';
import './GameBoard.css';

interface GameBoardProps {
  gameState: GameState;
  onTileClick: (tile: number) => void;
  isMyTurn: boolean;
}

export const GameBoard: React.FC<GameBoardProps> = ({
  gameState,
  onTileClick,
  isMyTurn,
}) => {
  const renderTiles = () => {
    return [1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => {
      const isUsed = gameState.usedTiles.includes(num);
      const isAvailable = gameState.availableTiles.includes(num);

      return (
        <Tile
          key={num}
          number={num}
          onClick={() => onTileClick(num)}
          disabled={!isMyTurn || !isAvailable}
          isPlayed={isUsed}
          color={gameState.yourColor || undefined}
        />
      );
    });
  };

  const renderRoundStatus = () => {
    console.log('Rendering round status:', {
      currentRound: gameState.currentRound,
      currentRoundTiles: gameState.currentRoundTiles,
      historyLength: gameState.roundHistory.length,
      history: gameState.roundHistory,
    });

    return Array.from({ length: 9 }, (_, index) => {
      const roundNum = index + 1;
      const roundData = gameState.roundHistory.find(
        (r) => r.round === roundNum
      );
      const isCurrentRound = roundNum === gameState.currentRound;

      // 현재 라운드이고 히스토리에 없는 경우만 currentRoundTiles 사용
      let blueTile = roundData?.blueTile;
      let redTile = roundData?.redTile;

      if (isCurrentRound && !roundData) {
        // 현재 진행 중인 라운드
        blueTile = gameState.currentRoundTiles.blue;
        redTile = gameState.currentRoundTiles.red;
      }

      const isPlaying = isCurrentRound && !roundData && (blueTile || redTile);

      if (roundNum === gameState.currentRound || roundData) {
        console.log(`Round ${roundNum}:`, {
          isCurrentRound,
          hasRoundData: !!roundData,
          blueTile,
          redTile,
          isPlaying,
          source: roundData ? 'history' : 'currentRoundTiles',
        });
      }

      return (
        <div key={roundNum} className="round-status-item">
          <div className="round-number">R{roundNum}</div>
          <div className="round-tiles-pair">
            <div
              className={`round-tile-indicator blue ${
                !blueTile ? 'empty' : ''
              } ${isPlaying && blueTile ? 'current' : ''}`}
            >
              {blueTile ? (
                <span
                  className={blueTile % 2 === 1 ? 'white-tile' : 'black-tile'}
                >
                  {blueTile % 2 === 1 ? '○' : '●'}
                </span>
              ) : (
                <span className="empty-slot">-</span>
              )}
            </div>
            <div
              className={`round-tile-indicator red ${!redTile ? 'empty' : ''} ${
                isPlaying && redTile ? 'current' : ''
              }`}
            >
              {redTile ? (
                <span
                  className={redTile % 2 === 1 ? 'white-tile' : 'black-tile'}
                >
                  {redTile % 2 === 1 ? '○' : '●'}
                </span>
              ) : (
                <span className="empty-slot">-</span>
              )}
            </div>
          </div>
          {roundData && roundData.winner && (
            <div className={`round-winner-bar ${roundData.winner}`}></div>
          )}
          {roundData &&
            !roundData.winner &&
            roundData.blueTile &&
            roundData.redTile && <div className="round-winner-bar draw"></div>}
        </div>
      );
    });
  };

  const renderOpponentTiles = () => {
    const opponentColor = gameState.yourColor === 'blue' ? 'red' : 'blue';
    const allTiles = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    const opponentAvailableTiles = allTiles.filter(
      (tile) => !gameState.opponentUsedTiles.includes(tile)
    );

    // 패를 색상 패턴으로만 표시 (순서를 섞어서)
    const shuffledTiles = React.useMemo(() => {
      const tiles = [...opponentAvailableTiles];
      // 게임 상태 기반으로 일관된 순서 유지하되 무작위하게 보이도록
      const seed = gameState.gameId || '';
      return tiles.sort((a, b) => {
        const hashA = (a * seed.length + gameState.currentRound) % 10;
        const hashB = (b * seed.length + gameState.currentRound) % 10;
        return hashA - hashB;
      });
    }, [
      opponentAvailableTiles.join(','),
      gameState.gameId,
      gameState.currentRound,
      gameState.opponentUsedTiles.length,
    ]);

    return (
      <div className="opponent-tiles-display">
        <div className="opponent-tiles-label">
          상대방 남은 패 ({opponentAvailableTiles.length}개)
        </div>
        <div className="opponent-tiles-grid">
          {shuffledTiles.map((tile, index) => {
            const isOdd = tile % 2 === 1;
            return (
              <div
                key={`${tile}-${index}`}
                className={`opponent-tile ${opponentColor} ${
                  isOdd ? 'odd' : 'even'
                }`}
              />
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="game-board">
      <div className="game-info">
        <div className="round-info">
          <h2>라운드 {gameState.currentRound}/9</h2>
        </div>
      </div>

      <div className="round-status-board">
        <div className="round-status-header">
          <div className="player-label blue">
            파랑 {gameState.yourColor === 'blue' ? '(나)' : ''}
          </div>
          <div className="player-label red">
            빨강 {gameState.yourColor === 'red' ? '(나)' : ''}
          </div>
        </div>
        <div className="round-status-grid">{renderRoundStatus()}</div>
        <div className="score-summary">
          <div
            className={`score-item blue ${
              gameState.yourColor === 'blue' ? 'my-score' : ''
            }`}
          >
            <span className="score-label">파랑</span>
            <span className="score-value">{gameState.blueWins}승</span>
          </div>
          <div
            className={`score-item red ${
              gameState.yourColor === 'red' ? 'my-score' : ''
            }`}
          >
            <span className="score-label">빨강</span>
            <span className="score-value">{gameState.redWins}승</span>
          </div>
        </div>
      </div>

      {gameState.isGameStarted && renderOpponentTiles()}

      <div className="turn-indicator">
        {isMyTurn ? (
          <span className="my-turn">당신의 차례입니다!</span>
        ) : (
          <span className="opponent-turn">상대방의 차례입니다</span>
        )}
      </div>

      <div className="tiles-container">{renderTiles()}</div>

      {gameState.yourColor && (
        <div className="player-info">
          당신은{' '}
          <span className={`color-badge ${gameState.yourColor}`}>
            {gameState.yourColor === 'blue' ? '파랑' : '빨강'}
          </span>{' '}
          플레이어입니다
        </div>
      )}
    </div>
  );
};
