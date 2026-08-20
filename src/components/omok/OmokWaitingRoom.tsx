import { useState } from 'react';
import { loadNickname, saveNickname } from '../../utils/nickname';
import './OmokWaitingRoom.css';

interface OmokWaitingRoomProps {
  hasJoined: boolean;
  onJoinGame: (playerName: string, vsBot?: boolean) => void;
  onBack: () => void;
}

export function OmokWaitingRoom({ hasJoined, onJoinGame, onBack }: OmokWaitingRoomProps) {
  const [playerName, setPlayerName] = useState(loadNickname);
  // 연타로 join 이 두 번 나가는 것을 막는다 (서버 가드와 이중 방어)
  const [joining, setJoining] = useState(false);

  const join = (vsBot: boolean) => {
    if (joining) return;
    // 봇전은 이름이 비어 있으면 기본 이름으로 바로 시작한다
    const name = playerName.trim() || (vsBot ? '나' : '');
    if (!name) return;
    saveNickname(playerName);
    setJoining(true);
    onJoinGame(name, vsBot);
    setTimeout(() => setJoining(false), 2000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    join(false);
  };

  return (
    <div className="omok-waiting-room">
      <div className="omok-waiting-container">
        <h1 className="omok-title">오목</h1>
        <p className="omok-subtitle">다섯 돌을 먼저 잇는 클래식 대결 · 2인</p>

        {!hasJoined ? (
          <form onSubmit={handleSubmit} className="omok-join-form">
            <div className="omok-form-group">
              <label htmlFor="omokPlayerName">플레이어 이름</label>
              <input
                type="text"
                id="omokPlayerName"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="이름을 입력하세요"
                maxLength={20}
                required
              />
            </div>
            <button type="submit" className="omok-join-button" disabled={joining}>
              {joining ? '입장 중...' : '게임 참가'}
            </button>
            <button
              type="button"
              className="omok-bot-button"
              disabled={joining}
              onClick={() => join(true)}
            >
              🤖 혼자 연습 (봇 대전)
            </button>
            <button type="button" className="omok-back-button" onClick={onBack}>
              게임 선택으로 돌아가기
            </button>
          </form>
        ) : (
          <div className="omok-waiting-message">
            <div className="omok-spinner" />
            <p>상대방을 기다리는 중...</p>
          </div>
        )}
      </div>
    </div>
  );
}
