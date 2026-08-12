import { useState } from 'react';
import './QDWaitingRoom.css';

interface QDWaitingRoomProps {
  hasJoined: boolean;
  onJoinGame: (playerName: string) => void;
  onBack: () => void;
}

export function QDWaitingRoom({ hasJoined, onJoinGame, onBack }: QDWaitingRoomProps) {
  const [playerName, setPlayerName] = useState('');
  // 연타로 join 이 두 번 나가는 것을 막는다 (서버 가드와 이중 방어)
  const [joining, setJoining] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (joining || !playerName.trim()) return;
    setJoining(true);
    onJoinGame(playerName.trim());
    setTimeout(() => setJoining(false), 2000);
  };

  return (
    <div className="qd-waiting-room">
      <div className="qd-waiting-container">
        <h1 className="qd-title">쿼리도</h1>
        <p className="qd-subtitle">벽으로 길을 막는 경주 대결 · 2인</p>

        {!hasJoined ? (
          <form onSubmit={handleSubmit} className="qd-join-form">
            <div className="qd-form-group">
              <label htmlFor="qdPlayerName">플레이어 이름</label>
              <input
                type="text"
                id="qdPlayerName"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="이름을 입력하세요"
                maxLength={20}
                required
              />
            </div>
            <button type="submit" className="qd-join-button" disabled={joining}>
              {joining ? '입장 중...' : '게임 참가'}
            </button>
            <button type="button" className="qd-back-button" onClick={onBack}>
              게임 선택으로 돌아가기
            </button>
          </form>
        ) : (
          <div className="qd-waiting-message">
            <div className="qd-spinner" />
            <p>상대방을 기다리는 중...</p>
          </div>
        )}
      </div>
    </div>
  );
}
