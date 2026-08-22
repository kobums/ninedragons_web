import { useState } from 'react';
import type { IDGameState } from '../../types/insider';
import {
  ID_BOT_FILL_TARGET,
  ID_MAX_PLAYERS,
  ID_MIN_PLAYERS,
} from '../../types/insider';
import type { IDToast } from '../../hooks/useInsiderGameState';
import {
  RoomCodeBadge,
  RoomJoinControls,
  useRoomJoin,
} from '../RoomCodeControls';
import { loadNickname, saveNickname } from '../../utils/nickname';
import './InsiderWaitingRoom.css';

interface InsiderWaitingRoomProps {
  // 입장 전이면 null (hasJoined 가 false 일 수도 있다)
  game: IDGameState | null;
  hasJoined: boolean;
  toasts?: IDToast[];
  onJoin: (name: string, room: string) => void;
  onStart: () => void;
  onFillBots: () => void;
  onBack: () => void;
}

export function InsiderWaitingRoom({
  game,
  hasJoined,
  toasts = [],
  onJoin,
  onStart,
  onFillBots,
  onBack,
}: InsiderWaitingRoomProps) {
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
    ? Array.from({ length: ID_MAX_PLAYERS }).filter((_, i) => seatOf(i)).length
    : 0;
  const hostSeat = game?.hostSeat ?? 0;
  const isHost = game !== null && game.yourSeat === hostSeat;
  const needMore = Math.max(0, ID_MIN_PLAYERS - filled);

  return (
    <div className="id-scope id-waiting">
      {toasts.length > 0 && (
        <div className="id-waiting-toasts">
          {toasts.map((t) => (
            <div key={t.id} className="id-waiting-toast">
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
      <div className="id-waiting-container">
        <h1 className="id-title">인사이더</h1>
        <p className="id-subtitle">🕵 정체 은닉 스무고개 · 4~8인</p>

        {!hasJoined ? (
          <form onSubmit={handleSubmit} className="id-join-form">
            <div className="id-form-group">
              <label htmlFor="idPlayerName">플레이어 이름</label>
              <input
                type="text"
                id="idPlayerName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="이름을 입력하세요"
                maxLength={20}
                required
              />
            </div>
            <RoomJoinControls join={roomJoin} tone="dark" idPrefix="id" />
            <button
              type="submit"
              className="id-primary-button"
              disabled={joining || !roomJoin.roomReady}
            >
              {joining ? '입장 중...' : '입장하기'}
            </button>
            <button type="button" className="id-ghost-button" onClick={onBack}>
              게임 선택으로
            </button>
          </form>
        ) : !game ? (
          <p className="id-waiting-hint">입장 중...</p>
        ) : (
          <div className="id-seat-list-wrap">
            <RoomCodeBadge code={game.roomCode} tone="dark" />
            <ul className="id-seat-list">
              {Array.from({ length: ID_MAX_PLAYERS }).map((_, seat) => {
                const p = seatOf(seat);
                return p ? (
                  <li key={seat} className="id-seat-item">
                    <span className="id-seat-item-name">
                      {seat === hostSeat && <span className="id-crown">👑</span>}
                      {p.name}
                      {p.bot && ' 🤖'}
                      {seat === game.yourSeat && ' (나)'}
                    </span>
                    <span className={`id-dot ${p.connected ? 'on' : 'off'}`} />
                  </li>
                ) : (
                  <li key={seat} className="id-seat-item empty">
                    {seat + 1}번 좌석 — 대기 중...
                  </li>
                );
              })}
            </ul>

            <p className="id-waiting-hint">
              {filled}/{ID_MAX_PLAYERS}명
              {needMore > 0
                ? ` · 시작까지 ${needMore}명 더 필요합니다`
                : ' · 호스트가 시작할 수 있습니다'}
            </p>

            {isHost ? (
              <div className="id-host-actions">
                <button
                  type="button"
                  className="id-primary-button"
                  onClick={onStart}
                  disabled={filled < ID_MIN_PLAYERS}
                >
                  {filled < ID_MIN_PLAYERS
                    ? `${ID_MIN_PLAYERS}명 이상 모여야 합니다`
                    : '게임 시작'}
                </button>
                {filled < ID_BOT_FILL_TARGET && (
                  <button
                    type="button"
                    className="id-ghost-button"
                    onClick={onFillBots}
                  >
                    🤖 봇으로 채우고 시작 ({ID_BOT_FILL_TARGET}인)
                  </button>
                )}
              </div>
            ) : (
              <p className="id-waiting-hint">
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
