import { useState } from 'react';
import './OTWaitingRoom.css';

interface OTWaitingRoomProps {
  hasJoined: boolean;
  onJoinGame: (playerName: string) => void;
  onBack: () => void;
}

export function OTWaitingRoom({ hasJoined, onJoinGame, onBack }: OTWaitingRoomProps) {
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
    <div className="ot-waiting-room">
      <div className="ot-waiting-container">
        <h1 className="ot-title">오니타마</h1>
        <p className="ot-subtitle">이동 카드가 순환하는 기물 대결 · 2인</p>

        {!hasJoined ? (
          <form onSubmit={handleSubmit} className="ot-join-form">
            <div className="ot-form-group">
              <label htmlFor="otPlayerName">플레이어 이름</label>
              <input
                type="text"
                id="otPlayerName"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="이름을 입력하세요"
                maxLength={20}
                required
              />
            </div>
            <button type="submit" className="ot-join-button" disabled={joining}>
              {joining ? '입장 중...' : '게임 참가'}
            </button>
            <button type="button" className="ot-back-button" onClick={onBack}>
              게임 선택으로 돌아가기
            </button>
          </form>
        ) : (
          <div className="ot-waiting-message">
            <div className="ot-spinner" />
            <p>상대방을 기다리는 중...</p>
          </div>
        )}
      </div>
    </div>
  );
}
