import React, { useState } from 'react';
import type { PlayerColor } from '../types/game';
import './WaitingRoom.css';

interface WaitingRoomProps {
  onJoinGame: (playerName: string, color?: PlayerColor) => void;
  isWaiting: boolean;
  hasJoined?: boolean;
}

export const WaitingRoom: React.FC<WaitingRoomProps> = ({
  onJoinGame,
  isWaiting,
  hasJoined = false,
}) => {
  const [playerName, setPlayerName] = useState('');
  const [selectedColor, setSelectedColor] = useState<PlayerColor | ''>('');

  const handleJoin = () => {
    if (playerName.trim()) {
      onJoinGame(playerName, selectedColor || undefined);
    }
  };

  // 이미 참가했고 대기 중인 경우에만 대기 화면 표시
  if (isWaiting && hasJoined) {
    return (
      <div className="waiting-room">
        <div className="waiting-content">
          <h1>구룡투</h1>
          <div className="waiting-animation">
            <div className="spinner"></div>
          </div>
          <p className="waiting-text">상대방을 기다리는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="waiting-room">
      <div className="join-content">
        <h1>구룡투</h1>
        <p className="game-description">
          1부터 9까지의 숫자로 심리전을 펼치는 2인 대전 게임
        </p>

        <div className="join-form">
          <div className="form-group">
            <label htmlFor="playerName">플레이어 이름</label>
            <input
              id="playerName"
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="이름을 입력하세요"
              onKeyPress={(e) => e.key === 'Enter' && handleJoin()}
            />
          </div>

          <div className="form-group">
            <label>색상 선택 (선택사항)</label>
            <div className="color-buttons">
              <button
                className={`color-btn blue ${
                  selectedColor === 'blue' ? 'selected' : ''
                }`}
                onClick={() =>
                  setSelectedColor(selectedColor === 'blue' ? '' : 'blue')
                }
              >
                파랑
              </button>
              <button
                className={`color-btn red ${
                  selectedColor === 'red' ? 'selected' : ''
                }`}
                onClick={() =>
                  setSelectedColor(selectedColor === 'red' ? '' : 'red')
                }
              >
                빨강
              </button>
            </div>
          </div>

          <button
            className="join-btn"
            onClick={handleJoin}
            disabled={!playerName.trim()}
          >
            게임 참가
          </button>
        </div>

        <div className="game-rules">
          <h3>게임 규칙</h3>
          <ul>
            <li>각 플레이어는 1~9 숫자 타일을 한 세트씩 가집니다</li>
            <li>매 라운드마다 타일을 하나씩 선택합니다</li>
            <li>더 높은 숫자가 승리합니다</li>
            <li>특별 규칙: 1은 9를 이깁니다</li>
            <li>
              5승을 먼저 달성하거나, 9라운드 후 더 많이 이긴 플레이어가
              승리합니다
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};
