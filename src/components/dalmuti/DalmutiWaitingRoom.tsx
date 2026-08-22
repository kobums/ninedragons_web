import { useState } from 'react';
import type { DMGameState } from '../../types/dalmuti';
import {
  DM_BOT_FILL_TARGET,
  DM_MAX_PLAYERS,
  DM_MIN_PLAYERS,
} from '../../types/dalmuti';
import type { DMToast } from '../../hooks/useDalmutiGameState';
import {
  RoomCodeBadge,
  RoomJoinControls,
  useRoomJoin,
} from '../RoomCodeControls';
import { loadNickname, saveNickname } from '../../utils/nickname';
import './DalmutiWaitingRoom.css';

interface DalmutiWaitingRoomProps {
  // 입장 전이면 null (hasJoined 가 false 일 수도 있다)
  game: DMGameState | null;
  hasJoined: boolean;
  toasts?: DMToast[];
  onJoin: (name: string, room: string) => void;
  onStart: () => void;
  onFillBots: () => void;
  onBack: () => void;
}

export function DalmutiWaitingRoom({
  game,
  hasJoined,
  toasts = [],
  onJoin,
  onStart,
  onFillBots,
  onBack,
}: DalmutiWaitingRoomProps) {
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
    const p = (game?.players ?? []).find((pl) => pl.seat === seat);
    return p && p.name ? p : null;
  };
  const filled = game
    ? Array.from({ length: DM_MAX_PLAYERS }).filter((_, i) => seatOf(i)).length
    : 0;
  const hostSeat = game?.hostSeat ?? 0;
  const isHost = game !== null && game.yourSeat === hostSeat;
  const needMore = Math.max(0, DM_MIN_PLAYERS - filled);

  return (
    <div className="dm-waiting">
      {toasts.length > 0 && (
        <div className="dm-waiting-toasts">
          {toasts.map((t) => (
            <div key={t.id} className="dm-waiting-toast">
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
      <div className="dm-waiting-container">
        <h1 className="dm-title">위대한 달무티</h1>
        <p className="dm-subtitle">👑 낮을수록 강한 클라이밍 · 4~8인 · 3핸드</p>

        {!hasJoined ? (
          <form onSubmit={handleSubmit} className="dm-join-form">
            <div className="dm-form-group">
              <label htmlFor="dmPlayerName">플레이어 이름</label>
              <input
                type="text"
                id="dmPlayerName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="이름을 입력하세요"
                maxLength={20}
                required
              />
            </div>
            <RoomJoinControls join={roomJoin} idPrefix="dm" />
            <button
              type="submit"
              className="dm-primary-button"
              disabled={joining || !roomJoin.roomReady}
            >
              {joining ? '입장 중...' : '입장하기'}
            </button>
            <button type="button" className="dm-ghost-button" onClick={onBack}>
              게임 선택으로
            </button>
          </form>
        ) : !game ? (
          <p className="dm-waiting-hint">입장 중...</p>
        ) : (
          <div className="dm-seat-list-wrap">
            <RoomCodeBadge code={game.roomCode} />
            <ul className="dm-seat-list">
              {Array.from({ length: DM_MAX_PLAYERS }).map((_, seat) => {
                const p = seatOf(seat);
                return p ? (
                  <li key={seat} className="dm-seat-item">
                    <span className="dm-seat-item-name">
                      {seat === hostSeat && <span className="dm-crown">👑</span>}
                      {p.name}
                      {p.bot && ' 🤖'}
                      {seat === game.yourSeat && ' (나)'}
                    </span>
                    <span className={`dm-dot ${p.connected ? 'on' : 'off'}`} />
                  </li>
                ) : (
                  <li key={seat} className="dm-seat-item empty">
                    {seat + 1}번 좌석 — 대기 중...
                  </li>
                );
              })}
            </ul>

            <p className="dm-waiting-hint">
              {filled}/{DM_MAX_PLAYERS}명
              {needMore > 0
                ? ` · 시작까지 ${needMore}명 더 필요합니다`
                : ' · 호스트가 시작할 수 있습니다'}
            </p>

            {isHost ? (
              <div className="dm-host-actions">
                <button
                  type="button"
                  className="dm-primary-button"
                  onClick={onStart}
                  disabled={filled < DM_MIN_PLAYERS}
                >
                  {filled < DM_MIN_PLAYERS
                    ? `${DM_MIN_PLAYERS}명 이상 모여야 합니다`
                    : '게임 시작'}
                </button>
                {filled < DM_BOT_FILL_TARGET && (
                  <button
                    type="button"
                    className="dm-ghost-button"
                    onClick={onFillBots}
                  >
                    🤖 봇으로 채우고 시작
                  </button>
                )}
              </div>
            ) : (
              <p className="dm-waiting-hint">
                👑 {seatOf(hostSeat)?.name ?? '호스트'}님이 시작 버튼을 누르면
                게임이 시작됩니다
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
