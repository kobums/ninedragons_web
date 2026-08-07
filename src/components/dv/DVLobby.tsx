import { useState } from 'react';
import type { DVLobbyState } from '../../types/davinci';
import './DVLobby.css';

const MAX_PLAYERS = 4;

interface DVLobbyProps {
  lobby: DVLobbyState | null;
  onJoin: (playerName: string) => void;
  onStart: () => void;
  onLeave: () => void;
  onBack: () => void;
}

export function DVLobby({ lobby, onJoin, onStart, onLeave, onBack }: DVLobbyProps) {
  const [playerName, setPlayerName] = useState('');
  // 연타로 join 이 두 번 나가는 것을 막는다. 서버에도 가드가 있지만
  // 버튼을 잠가 두 번째 클릭 자체가 나가지 않게 한다.
  const [joining, setJoining] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (joining || !playerName.trim()) return;
    setJoining(true);
    onJoin(playerName.trim());
    // 응답이 늦거나 실패해도 다시 시도할 수 있게 잠깐만 잠근다
    setTimeout(() => setJoining(false), 2000);
  };

  return (
    <div className="dv-lobby">
      <div className="dv-lobby-container">
        <h1 className="dv-title">다빈치 코드</h1>
        <p className="dv-subtitle">숫자 추리 게임 · 2~4인</p>

        {!lobby ? (
          <form onSubmit={handleSubmit} className="dv-join-form">
            <div className="dv-form-group">
              <label htmlFor="dvPlayerName">플레이어 이름</label>
              <input
                type="text"
                id="dvPlayerName"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="이름을 입력하세요"
                maxLength={20}
                required
              />
            </div>
            <button type="submit" className="dv-primary-button" disabled={joining}>
              {joining ? '입장 중...' : '입장하기'}
            </button>
            <button type="button" className="dv-ghost-button" onClick={onBack}>
              게임 선택으로
            </button>
          </form>
        ) : (
          <div className="dv-waiting">
            <ul className="dv-player-list">
              {lobby.players.map((p) => (
                <li key={p.seat} className="dv-player-item">
                  <span className="dv-player-item-name">
                    {p.seat === lobby.hostSeat && <span className="dv-crown">👑</span>}
                    {p.name}
                    {p.seat === lobby.yourSeat && ' (나)'}
                  </span>
                  <span className={`dv-dot ${p.connected ? 'on' : 'off'}`} />
                </li>
              ))}
              {Array.from({ length: MAX_PLAYERS - lobby.players.length }).map((_, i) => (
                <li key={`empty-${i}`} className="dv-player-item empty">
                  대기 중...
                </li>
              ))}
            </ul>

            <p className="dv-lobby-hint">
              {lobby.players.length}/{MAX_PLAYERS}명 · 4명이 모이면 자동 시작됩니다
            </p>

            {lobby.yourSeat === lobby.hostSeat ? (
              <button
                type="button"
                className="dv-primary-button"
                onClick={onStart}
                disabled={!lobby.canStart}
              >
                {lobby.canStart ? '게임 시작' : '2명 이상 모여야 합니다'}
              </button>
            ) : (
              <p className="dv-lobby-hint">
                👑 {lobby.players.find((p) => p.seat === lobby.hostSeat)?.name ?? '호스트'}
                님이 시작 버튼을 누르면 게임이 시작됩니다
              </p>
            )}

            <button type="button" className="dv-ghost-button" onClick={onLeave}>
              나가기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
