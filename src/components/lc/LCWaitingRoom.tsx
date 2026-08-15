import { useState } from 'react';
import './LCWaitingRoom.css';

interface LCWaitingRoomProps {
  hasJoined: boolean;
  onJoinGame: (playerName: string, vsBot?: boolean) => void;
  onBack: () => void;
}

export function LCWaitingRoom({ hasJoined, onJoinGame, onBack }: LCWaitingRoomProps) {
  const [playerName, setPlayerName] = useState('');
  // 연타로 join 이 두 번 나가는 것을 막는다 (서버 가드와 이중 방어)
  const [joining, setJoining] = useState(false);

  const join = (vsBot: boolean) => {
    if (joining) return;
    // 봇전은 이름이 비어 있으면 기본 이름으로 바로 시작한다
    const name = playerName.trim() || (vsBot ? '나' : '');
    if (!name) return;
    setJoining(true);
    onJoinGame(name, vsBot);
    setTimeout(() => setJoining(false), 2000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    join(false);
  };

  return (
    <div className="lc-waiting-room">
      <div className="lc-waiting-container">
        <h1 className="lc-title">로스트 시티</h1>
        <p className="lc-subtitle">탐험대에 카드를 쌓는 수집 대결 · 2인</p>

        {!hasJoined ? (
          <form onSubmit={handleSubmit} className="lc-join-form">
            <div className="lc-form-group">
              <label htmlFor="lcPlayerName">플레이어 이름</label>
              <input
                type="text"
                id="lcPlayerName"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="이름을 입력하세요"
                maxLength={20}
                required
              />
            </div>
            <button type="submit" className="lc-join-button" disabled={joining}>
              {joining ? '입장 중...' : '게임 참가'}
            </button>
            <button
              type="button"
              className="lc-bot-button"
              disabled={joining}
              onClick={() => join(true)}
            >
              🤖 혼자 연습 (봇 대전)
            </button>
            <button type="button" className="lc-back-button" onClick={onBack}>
              게임 선택으로 돌아가기
            </button>
          </form>
        ) : (
          <div className="lc-waiting-message">
            <div className="lc-spinner" />
            <p>상대방을 기다리는 중...</p>
          </div>
        )}
      </div>
    </div>
  );
}
