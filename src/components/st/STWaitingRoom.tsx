import { useState } from 'react';
import './STWaitingRoom.css';

interface STWaitingRoomProps {
  hasJoined: boolean;
  onJoinGame: (playerName: string) => void;
  onBack: () => void;
}

export function STWaitingRoom({ hasJoined, onJoinGame, onBack }: STWaitingRoomProps) {
  const [playerName, setPlayerName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (playerName.trim()) {
      onJoinGame(playerName.trim());
    }
  };

  return (
    <div className="st-waiting-room">
      <div className="st-waiting-container">
        <span className="st-eyebrow">국경석 쟁탈전</span>
        <h1 className="st-title">쇼텐토텐</h1>
        <p className="st-subtitle">아홉 개의 돌을 둔 카드 진형 대결</p>

        {!hasJoined ? (
          <form onSubmit={handleSubmit} className="st-join-form">
            <div className="st-form-group">
              <label htmlFor="stPlayerName">플레이어 이름</label>
              <input
                type="text"
                id="stPlayerName"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="이름을 입력하세요"
                maxLength={20}
                required
              />
            </div>

            <button type="submit" className="st-join-button">
              게임 참가
            </button>
            <button type="button" className="st-back-button" onClick={onBack}>
              게임 선택으로 돌아가기
            </button>
          </form>
        ) : (
          <div className="st-waiting-message">
            <div className="st-spinner"></div>
            <p>상대방을 기다리는 중...</p>
            <small>다른 플레이어가 참가할 때까지 기다려주세요</small>
          </div>
        )}

        <div className="st-game-rules">
          <h3>게임 규칙</h3>
          <ul>
            <li>6가지 색, 1~9 숫자의 클랜 카드로 아홉 개의 돌을 두고 겨룹니다</li>
            <li>매 턴 카드 한 장을 돌 옆 내 쪽에 놓고 한 장을 뽑습니다 (돌마다 최대 3장)</li>
            <li>
              족보 순위: 컬러런(같은 색 연속) &gt; 트리플(같은 숫자) &gt; 컬러(같은 색)
              &gt; 런(연속) &gt; 합계
            </li>
            <li>동점이면 합이 큰 쪽, 그것도 같으면 먼저 3장을 완성한 쪽이 이깁니다</li>
            <li>
              상대가 3장을 못 채웠어도, 공개된 카드만으로 이길 수 없음이 증명되면
              먼저 돌을 가져올 수 있습니다
            </li>
            <li>돌 5개, 또는 나란히 붙은 돌 3개를 가져오면 즉시 승리합니다</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
