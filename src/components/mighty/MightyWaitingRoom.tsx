import { useState } from 'react';
import type { MTGameState } from '../../types/mighty';
import { RoomCodeBadge, RoomJoinControls, useRoomJoin } from '../RoomCodeControls';
import { loadNickname, saveNickname } from '../../utils/nickname';
import './MightyWaitingRoom.css';

const MAX_PLAYERS = 5;
const HOST_SEAT = 0;

interface MightyWaitingRoomProps {
  // 입장 전이면 null (hasJoined 가 false 일 수도 있다)
  game: MTGameState | null;
  hasJoined: boolean;
  onJoin: (name: string, room: string) => void;
  onFillBots: () => void;
  onBack: () => void;
}

export function MightyWaitingRoom({
  game,
  hasJoined,
  onJoin,
  onFillBots,
  onBack,
}: MightyWaitingRoomProps) {
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
    ? Array.from({ length: MAX_PLAYERS }).filter((_, i) => seatOf(i)).length
    : 0;

  return (
    <div className="mt-waiting">
      <div className="mt-waiting-container">
        <h1 className="mt-title">마이티</h1>
        <p className="mt-subtitle">공약 트릭테이킹 · 5인</p>

        {!hasJoined ? (
          <form onSubmit={handleSubmit} className="mt-join-form">
            <div className="mt-form-group">
              <label htmlFor="mtPlayerName">플레이어 이름</label>
              <input
                type="text"
                id="mtPlayerName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="이름을 입력하세요"
                maxLength={20}
                required
              />
            </div>
            <RoomJoinControls join={roomJoin} tone="dark" idPrefix="mt" />
            <button
              type="submit"
              className="mt-primary-button"
              disabled={joining || !roomJoin.roomReady}
            >
              {joining ? '입장 중...' : '입장하기'}
            </button>
            <button type="button" className="mt-ghost-button" onClick={onBack}>
              게임 선택으로
            </button>
          </form>
        ) : !game ? (
          <p className="mt-waiting-hint">입장 중...</p>
        ) : (
          <div className="mt-seat-list-wrap">
            <RoomCodeBadge code={game.roomCode} tone="dark" />
            <ul className="mt-seat-list">
              {Array.from({ length: MAX_PLAYERS }).map((_, seat) => {
                const p = seatOf(seat);
                return p ? (
                  <li key={seat} className="mt-seat-item">
                    <span className="mt-seat-item-name">
                      {seat === HOST_SEAT && <span className="mt-crown">👑</span>}
                      {p.name}
                      {p.bot && ' 🤖'}
                      {seat === game.yourSeat && ' (나)'}
                    </span>
                    <span className={`mt-dot ${p.connected ? 'on' : 'off'}`} />
                  </li>
                ) : (
                  <li key={seat} className="mt-seat-item empty">
                    {seat + 1}번 좌석 — 대기 중...
                  </li>
                );
              })}
            </ul>

            <p className="mt-waiting-hint">
              {filled}/{MAX_PLAYERS}명 · 5명이 모이면 자동 시작됩니다
            </p>

            {game.yourSeat === HOST_SEAT ? (
              <button
                type="button"
                className="mt-primary-button"
                onClick={onFillBots}
                disabled={filled >= MAX_PLAYERS}
              >
                🤖 봇으로 채우고 시작
              </button>
            ) : (
              <p className="mt-waiting-hint">
                👑 {seatOf(HOST_SEAT)?.name ?? '호스트'}님이 봇 채우기로 바로 시작할
                수도 있습니다
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
