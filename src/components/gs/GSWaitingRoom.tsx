import { useState } from 'react';
import { loadNickname, saveNickname } from '../../utils/nickname';
import './GSWaitingRoom.css';

interface GSWaitingRoomProps {
  hasJoined: boolean;
  onJoinGame: (playerName: string, vsBot?: boolean) => void;
  onBack: () => void;
}

export function GSWaitingRoom({ hasJoined, onJoinGame, onBack }: GSWaitingRoomProps) {
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
    <div className="gs-waiting-room">
      <div className="gs-waiting-container">
        <h1 className="gs-title">가이스터</h1>
        <p className="gs-subtitle">유령 정체를 숨긴 탈출 대결 · 2인</p>

        {!hasJoined ? (
          <form onSubmit={handleSubmit} className="gs-join-form">
            <div className="gs-form-group">
              <label htmlFor="gsPlayerName">플레이어 이름</label>
              <input
                type="text"
                id="gsPlayerName"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="이름을 입력하세요"
                maxLength={20}
                required
              />
            </div>
            <button type="submit" className="gs-join-button" disabled={joining}>
              {joining ? '입장 중...' : '게임 참가'}
            </button>
            <button
              type="button"
              className="gs-bot-button"
              disabled={joining}
              onClick={() => join(true)}
            >
              🤖 혼자 연습 (봇 대전)
            </button>
            <button type="button" className="gs-back-button" onClick={onBack}>
              게임 선택으로 돌아가기
            </button>
          </form>
        ) : (
          <div className="gs-waiting-message">
            <div className="gs-spinner" />
            <p>상대방을 기다리는 중...</p>
          </div>
        )}
      </div>
    </div>
  );
}
