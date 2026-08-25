import { useState } from 'react';
import { loadNickname, saveNickname } from '../../utils/nickname';
import './JHWaitingRoom.css';

interface JHWaitingRoomProps {
  hasJoined: boolean;
  onJoinGame: (playerName: string) => void;
  onBack: () => void;
}

export function JHWaitingRoom({ hasJoined, onJoinGame, onBack }: JHWaitingRoomProps) {
  const [playerName, setPlayerName] = useState(loadNickname);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (playerName.trim()) {
      saveNickname(playerName);
      onJoinGame(playerName.trim());
    }
  };

  return (
    <div className="jh-waiting-room">
      <div className="jh-waiting-container">
        <span className="jh-eyebrow">두 개의 인격, 하나의 몸</span>
        <h1 className="jh-title">지킬 대 하이드</h1>
        <p className="jh-subtitle">인격을 건 2인 트릭테이킹 심리전</p>

        {!hasJoined ? (
          <form onSubmit={handleSubmit} className="jh-join-form">
            <div className="jh-form-group">
              <label htmlFor="jhPlayerName">플레이어 이름</label>
              <input
                type="text"
                id="jhPlayerName"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="이름을 입력하세요"
                maxLength={20}
                required
              />
            </div>

            <button type="submit" className="jh-join-button">
              게임 참가
            </button>
            <button type="button" className="jh-back-button" onClick={onBack}>
              게임 선택으로 돌아가기
            </button>
          </form>
        ) : (
          <div className="jh-waiting-message">
            <div className="jh-spinner"></div>
            <p>상대방을 기다리는 중...</p>
            <small>먼저 입장한 사람이 지킬, 나중에 입장한 사람이 하이드입니다</small>
          </div>
        )}

        <div className="jh-game-rules">
          <h3>게임 규칙</h3>
          <ul>
            <li>
              3개 색(오만·분노·탐욕) 1~7 카드와 물약 4장으로 3라운드,
              라운드당 10트릭을 겨룹니다
            </li>
            <li>
              라운드마다 먼저 나온 색일수록 약합니다 — 색 서열은 게임 중에
              만들어집니다
            </li>
            <li>
              같은 색끼리는 높은 숫자가, 다른 색끼리는 서열 높은 색이,
              물약이 섞이면 색을 무시하고 높은 숫자가 이깁니다
            </li>
            <li>
              물약은 상대가 낸 색에 따라 효과가 발동합니다 — 오만: 트릭 강탈,
              탐욕: 손패 2장 교환, 분노: 색 서열 리셋
            </li>
            <li>
              라운드가 끝나면 두 사람의 트릭 수 차이만큼 마커가 하이드 쪽으로
              움직입니다 (되돌아오지 않습니다!)
            </li>
            <li>
              마커가 끝까지 가면 하이드 승리, 3라운드를 버티면 지킬 승리 —
              지킬은 5:5 균형이, 하이드는 큰 격차가 목표입니다
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
