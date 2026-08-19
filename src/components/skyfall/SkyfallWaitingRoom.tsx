import { useState } from 'react';
import type { SFGameState } from '../../types/skyfall';
import { SF_MAX_PLAYERS, SF_MIN_PLAYERS } from '../../types/skyfall';
import type { SFToast } from '../../hooks/useSkyfallGameState';
import { RoomCodeBadge, RoomJoinControls, useRoomJoin } from '../RoomCodeControls';
import { loadNickname, saveNickname } from '../../utils/nickname';
import './SkyfallWaitingRoom.css';

interface SkyfallWaitingRoomProps {
  // 입장 전이면 null (hasJoined 가 false 일 수도 있다)
  game: SFGameState | null;
  hasJoined: boolean;
  toasts?: SFToast[];
  onJoin: (name: string, room: string) => void;
  onStart: () => void;
  onFillBots: () => void;
  onBack: () => void;
}

export function SkyfallWaitingRoom({
  game,
  hasJoined,
  toasts = [],
  onJoin,
  onStart,
  onFillBots,
  onBack,
}: SkyfallWaitingRoomProps) {
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
    ? Array.from({ length: SF_MAX_PLAYERS }).filter((_, i) => seatOf(i)).length
    : 0;
  const hostSeat = game?.hostSeat ?? 0;
  const isHost = game !== null && game.yourSeat === hostSeat;
  const needMore = Math.max(0, SF_MIN_PLAYERS - filled);

  return (
    <div className="sf-waiting">
      {toasts.length > 0 && (
        <div className="sf-waiting-toasts">
          {toasts.map((t) => (
            <div key={t.id} className="sf-waiting-toast">
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
      <div className="sf-waiting-container">
        <h1 className="sf-title">마피아</h1>
        <p className="sf-subtitle">클래식 마피아 · 6~10인</p>

        {!hasJoined ? (
          <form onSubmit={handleSubmit} className="sf-join-form">
            <div className="sf-form-group">
              <label htmlFor="sfPlayerName">플레이어 이름</label>
              <input
                type="text"
                id="sfPlayerName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="이름을 입력하세요"
                maxLength={20}
                required
              />
            </div>
            <RoomJoinControls join={roomJoin} tone="dark" idPrefix="sf" />
            <button
              type="submit"
              className="sf-primary-button"
              disabled={joining || !roomJoin.roomReady}
            >
              {joining ? '입장 중...' : '입장하기'}
            </button>
            <button type="button" className="sf-ghost-button" onClick={onBack}>
              게임 선택으로
            </button>
          </form>
        ) : !game ? (
          <p className="sf-waiting-hint">입장 중...</p>
        ) : (
          <div className="sf-seat-list-wrap">
            <RoomCodeBadge code={game.roomCode} tone="dark" />
            <ul className="sf-seat-list">
              {Array.from({ length: SF_MAX_PLAYERS }).map((_, seat) => {
                const p = seatOf(seat);
                return p ? (
                  <li key={seat} className="sf-seat-item">
                    <span className="sf-seat-item-name">
                      {seat === hostSeat && <span className="sf-crown">👑</span>}
                      {p.name}
                      {p.bot && ' 🤖'}
                      {seat === game.yourSeat && ' (나)'}
                    </span>
                    <span className={`sf-dot ${p.connected ? 'on' : 'off'}`} />
                  </li>
                ) : (
                  <li key={seat} className="sf-seat-item empty">
                    {seat + 1}번 좌석 — 대기 중...
                  </li>
                );
              })}
            </ul>

            <p className="sf-waiting-hint">
              {filled}/{SF_MAX_PLAYERS}명
              {needMore > 0
                ? ` · 시작까지 ${needMore}명 더 필요합니다`
                : ' · 호스트가 시작할 수 있습니다'}
            </p>

            {isHost ? (
              <div className="sf-host-actions">
                <button
                  type="button"
                  className="sf-primary-button"
                  onClick={onStart}
                  disabled={filled < SF_MIN_PLAYERS}
                >
                  게임 시작
                </button>
                {needMore > 0 && (
                  <button
                    type="button"
                    className="sf-ghost-button"
                    onClick={onFillBots}
                  >
                    🤖 봇으로 채우기 (6인)
                  </button>
                )}
              </div>
            ) : (
              <p className="sf-waiting-hint">
                👑 {seatOf(hostSeat)?.name ?? '호스트'}님이 시작을 결정합니다
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
