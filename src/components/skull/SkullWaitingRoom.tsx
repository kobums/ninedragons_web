import { useState } from 'react';
import type { SKGameState } from '../../types/skull';
import { SK_MAX_PLAYERS, SK_MIN_PLAYERS } from '../../types/skull';
import type { SKToast } from '../../hooks/useSkullGameState';
import { RoomCodeBadge, RoomJoinControls, useRoomJoin } from '../RoomCodeControls';
import { loadNickname, saveNickname } from '../../utils/nickname';
import './SkullWaitingRoom.css';

interface SkullWaitingRoomProps {
  // 입장 전이면 null (hasJoined 가 false 일 수도 있다)
  game: SKGameState | null;
  hasJoined: boolean;
  toasts?: SKToast[];
  onJoin: (name: string, room: string) => void;
  onStart: () => void;
  onFillBots: () => void;
  onBack: () => void;
}

export function SkullWaitingRoom({
  game,
  hasJoined,
  toasts = [],
  onJoin,
  onStart,
  onFillBots,
  onBack,
}: SkullWaitingRoomProps) {
  const [name, setName] = useState(loadNickname);
  // 연타로 join 이 두 번 나가는 것을 막는다
  const [joining, setJoining] = useState(false);
  const roomJoin = useRoomJoin();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (joining || !name.trim() || !roomJoin.roomReady) return;
    setJoining(true);
    saveNickname(name);
    onJoin(name.trim(), roomJoin.room);
    // 응답이 늦거나 실패해도 다시 시도할 수 있게 잠깐만 잠근다
    setTimeout(() => setJoining(false), 2000);
  };

  // 좌석 번호 → 참가자. 이름 없는 항목은 빈 좌석으로 취급한다.
  const seatOf = (seat: number) => {
    const p = game?.players.find((pl) => pl.seat === seat);
    return p && p.name ? p : null;
  };
  const filled = game
    ? Array.from({ length: SK_MAX_PLAYERS }).filter((_, i) => seatOf(i)).length
    : 0;
  const hostSeat = game?.hostSeat ?? 0;
  const isHost = game !== null && game.yourSeat === hostSeat;
  const needMore = Math.max(0, SK_MIN_PLAYERS - filled);

  return (
    <div className="sk-waiting">
      {toasts.length > 0 && (
        <div className="sk-waiting-toasts">
          {toasts.map((t) => (
            <div key={t.id} className="sk-waiting-toast">
              {t.event.message ??
                (t.event.kind === 'left'
                  ? `${t.event.name ?? '?'}님이 나갔습니다`
                  : t.event.kind === 'joined'
                    ? `${t.event.name ?? '?'}님이 입장했습니다`
                    : '')}
            </div>
          ))}
        </div>
      )}
      <div className="sk-waiting-container">
        <h1 className="sk-title">스컬</h1>
        <p className="sk-subtitle">🌹 장미와 해골 · 베팅 심리전 · 3~6인</p>

        {!hasJoined ? (
          <form onSubmit={handleSubmit} className="sk-join-form">
            <div className="sk-form-group">
              <label htmlFor="skPlayerName">플레이어 이름</label>
              <input
                type="text"
                id="skPlayerName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="이름을 입력하세요"
                maxLength={20}
                required
              />
            </div>
            <RoomJoinControls join={roomJoin} tone="dark" idPrefix="sk" />
            <button
              type="submit"
              className="sk-primary-button"
              disabled={joining || !roomJoin.roomReady}
            >
              {joining ? '입장 중...' : '입장하기'}
            </button>
            <button type="button" className="sk-ghost-button" onClick={onBack}>
              게임 선택으로
            </button>
          </form>
        ) : !game ? (
          <p className="sk-waiting-hint">입장 중...</p>
        ) : (
          <div className="sk-seat-list-wrap">
            <RoomCodeBadge code={game.roomCode} tone="dark" />
            <ul className="sk-seat-list">
              {Array.from({ length: SK_MAX_PLAYERS }).map((_, seat) => {
                const p = seatOf(seat);
                return p ? (
                  <li key={seat} className="sk-seat-item">
                    <span className="sk-seat-item-name">
                      {seat === hostSeat && <span className="sk-crown">👑</span>}
                      {p.name}
                      {p.bot && ' 🤖'}
                      {seat === game.yourSeat && ' (나)'}
                    </span>
                    <span className={`sk-dot ${p.connected ? 'on' : 'off'}`} />
                  </li>
                ) : (
                  <li key={seat} className="sk-seat-item empty">
                    {seat + 1}번 좌석 — 대기 중...
                  </li>
                );
              })}
            </ul>

            <p className="sk-waiting-hint">
              {filled}/{SK_MAX_PLAYERS}명
              {needMore > 0
                ? ` · 시작까지 ${needMore}명 더 필요합니다`
                : ' · 호스트가 시작할 수 있습니다'}
            </p>

            {isHost ? (
              <div className="sk-host-actions">
                <button
                  type="button"
                  className="sk-primary-button"
                  onClick={onStart}
                  disabled={filled < SK_MIN_PLAYERS}
                >
                  게임 시작
                </button>
                {filled < SK_MAX_PLAYERS && (
                  <button
                    type="button"
                    className="sk-ghost-button"
                    onClick={onFillBots}
                  >
                    🤖 봇으로 채우기 (6인)
                  </button>
                )}
              </div>
            ) : (
              <p className="sk-waiting-hint">
                👑 {seatOf(hostSeat)?.name ?? '호스트'}님이 시작을 결정합니다
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
