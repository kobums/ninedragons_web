import { useState } from 'react';
import type { TichuGameState, TichuPlayer } from '../../types/tichu';
import type { TichuToast } from '../../hooks/useTichuGameState';
import './TichuWaitingRoom.css';

const SEATS = [0, 1, 2, 3];

interface TichuWaitingRoomProps {
  // waiting 스냅샷 (입장 전이나 스냅샷 도착 전에는 null)
  game: TichuGameState | null;
  toasts?: TichuToast[];
  hasJoined: boolean;
  onJoin: (name: string) => void;
  onSetTarget: (target: 500 | 1000) => void;
  onFillBots: () => void;
  onBack: () => void;
}

export function TichuWaitingRoom({
  game,
  toasts = [],
  hasJoined,
  onJoin,
  onSetTarget,
  onFillBots,
  onBack,
}: TichuWaitingRoomProps) {
  const [playerName, setPlayerName] = useState('');
  // 연타로 join 이 두 번 나가는 것을 막는다 (서버 가드와 이중 방어)
  const [joining, setJoining] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (joining || !playerName.trim()) return;
    setJoining(true);
    onJoin(playerName.trim());
    // 응답이 늦거나 실패해도 다시 시도할 수 있게 잠깐만 잠근다
    setTimeout(() => setJoining(false), 2000);
  };

  const seatPlayer = (seat: number): TichuPlayer | null => {
    const p = game?.players.find((pl) => pl.seat === seat);
    return p && p.name !== '' ? p : null;
  };

  const filled = SEATS.filter((seat) => seatPlayer(seat) !== null).length;
  const isHost = hasJoined && game?.yourSeat === 0;
  const target = game?.targetScore ?? 500;

  return (
    <div className="tc-waiting-room">
      {toasts.length > 0 && (
        <div className="tc-waiting-toasts">
          {toasts.map((t) => (
            <div key={t.id} className="tc-waiting-toast">
              {t.event.message}
            </div>
          ))}
        </div>
      )}
      <div className="tc-waiting-container">
        <h1 className="tc-waiting-title">티츄</h1>
        <p className="tc-waiting-subtitle">팀 트릭테이킹 · 4인 (0·2 팀 vs 1·3 팀)</p>

        {!hasJoined ? (
          <form onSubmit={handleSubmit} className="tc-join-form">
            <div className="tc-form-group">
              <label htmlFor="tcPlayerName">플레이어 이름</label>
              <input
                type="text"
                id="tcPlayerName"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="이름을 입력하세요"
                maxLength={20}
                required
              />
            </div>
            <button type="submit" className="tc-primary-button" disabled={joining}>
              {joining ? '입장 중...' : '입장하기'}
            </button>
            <button type="button" className="tc-ghost-button" onClick={onBack}>
              게임 선택으로
            </button>
          </form>
        ) : (
          <div className="tc-waiting-body">
            <ul className="tc-seat-list">
              {SEATS.map((seat) => {
                const p = seatPlayer(seat);
                const team = seat % 2 === 0 ? 'team02' : 'team13';
                return (
                  <li
                    key={seat}
                    className={`tc-seat-item ${team} ${p ? '' : 'empty'}`}
                  >
                    <span className="tc-seat-team">
                      {seat % 2 === 0 ? '0·2 팀' : '1·3 팀'}
                    </span>
                    {p ? (
                      <span className="tc-seat-name">
                        {seat === 0 && <span className="tc-crown">👑</span>}
                        {p.bot && <span className="tc-bot-mark">🤖</span>}
                        {p.name}
                        {seat === game?.yourSeat && ' (나)'}
                        <span className={`tc-dot ${p.connected ? 'on' : 'off'}`} />
                      </span>
                    ) : (
                      <span className="tc-seat-empty-label">대기 중...</span>
                    )}
                  </li>
                );
              })}
            </ul>

            <p className="tc-waiting-hint">
              {filled}/4명 · 4명이 모이면 자동 시작됩니다
            </p>

            <div className="tc-target-row">
              <span className="tc-target-label">목표 점수</span>
              <div className="tc-target-toggle">
                {([500, 1000] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`tc-target-option ${target === t ? 'active' : ''}`}
                    disabled={!isHost}
                    onClick={() => onSetTarget(t)}
                  >
                    {t}점
                  </button>
                ))}
              </div>
            </div>

            {isHost ? (
              <button type="button" className="tc-bot-button" onClick={onFillBots}>
                🤖 봇으로 채우고 시작
              </button>
            ) : (
              <p className="tc-waiting-hint">
                👑 호스트가 목표 점수를 정하고 봇 시작을 할 수 있습니다
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
