import { useState } from 'react';
import type { CCGameState } from '../../types/ciaociao';
import {
  CC_BOT_FILL_TARGET,
  CC_MAX_PLAYERS,
  CC_MIN_PLAYERS,
} from '../../types/ciaociao';
import type { CCToast } from '../../hooks/useCiaoCiaoGameState';
import {
  RoomCodeBadge,
  RoomJoinControls,
  useRoomJoin,
} from '../RoomCodeControls';
import { loadNickname, saveNickname } from '../../utils/nickname';
import './CiaoCiaoWaitingRoom.css';

interface CiaoCiaoWaitingRoomProps {
  // 입장 전이면 null (hasJoined 가 false 일 수도 있다)
  game: CCGameState | null;
  hasJoined: boolean;
  toasts?: CCToast[];
  onJoin: (name: string, room: string) => void;
  onStart: () => void;
  onFillBots: () => void;
  onBack: () => void;
}

export function CiaoCiaoWaitingRoom({
  game,
  hasJoined,
  toasts = [],
  onJoin,
  onStart,
  onFillBots,
  onBack,
}: CiaoCiaoWaitingRoomProps) {
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
    ? Array.from({ length: CC_MAX_PLAYERS }).filter((_, i) => seatOf(i)).length
    : 0;
  const hostSeat = game?.hostSeat ?? 0;
  const isHost = game !== null && game.yourSeat === hostSeat;
  const needMore = Math.max(0, CC_MIN_PLAYERS - filled);

  return (
    <div className="cc-waiting">
      {toasts.length > 0 && (
        <div className="cc-waiting-toasts">
          {toasts.map((t) => (
            <div key={t.id} className="cc-waiting-toast">
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
      <div className="cc-waiting-container">
        <h1 className="cc-title">차오차오</h1>
        <p className="cc-subtitle">🌉 주사위 블러핑 다리 건너기 · 2~4인</p>

        {!hasJoined ? (
          <form onSubmit={handleSubmit} className="cc-join-form">
            <div className="cc-form-group">
              <label htmlFor="ccPlayerName">플레이어 이름</label>
              <input
                type="text"
                id="ccPlayerName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="이름을 입력하세요"
                maxLength={20}
                required
              />
            </div>
            <RoomJoinControls join={roomJoin} idPrefix="cc" />
            <button
              type="submit"
              className="cc-primary-button"
              disabled={joining || !roomJoin.roomReady}
            >
              {joining ? '입장 중...' : '입장하기'}
            </button>
            <button type="button" className="cc-ghost-button" onClick={onBack}>
              게임 선택으로
            </button>
          </form>
        ) : !game ? (
          <p className="cc-waiting-hint">입장 중...</p>
        ) : (
          <div className="cc-seat-list-wrap">
            <RoomCodeBadge code={game.roomCode} />
            <ul className="cc-seat-list">
              {Array.from({ length: CC_MAX_PLAYERS }).map((_, seat) => {
                const p = seatOf(seat);
                return p ? (
                  <li key={seat} className="cc-seat-item">
                    <span className="cc-seat-item-name">
                      <span
                        className={`cc-pawn cc-seat-color-${seat % 4}`}
                        aria-hidden="true"
                      />
                      {seat === hostSeat && <span className="cc-crown">👑</span>}
                      {p.name}
                      {p.bot && ' 🤖'}
                      {seat === game.yourSeat && ' (나)'}
                    </span>
                    <span className={`cc-dot ${p.connected ? 'on' : 'off'}`} />
                  </li>
                ) : (
                  <li key={seat} className="cc-seat-item empty">
                    {seat + 1}번 좌석 — 대기 중...
                  </li>
                );
              })}
            </ul>

            <p className="cc-waiting-hint">
              {filled}/{CC_MAX_PLAYERS}명
              {needMore > 0
                ? ` · 시작까지 ${needMore}명 더 필요합니다`
                : ' · 호스트가 시작할 수 있습니다'}
            </p>

            {isHost ? (
              <div className="cc-host-actions">
                <button
                  type="button"
                  className="cc-primary-button"
                  onClick={onStart}
                  disabled={filled < CC_MIN_PLAYERS}
                >
                  {filled < CC_MIN_PLAYERS
                    ? `${CC_MIN_PLAYERS}명 이상 모여야 합니다`
                    : '게임 시작'}
                </button>
                {filled < CC_BOT_FILL_TARGET && (
                  <button
                    type="button"
                    className="cc-ghost-button"
                    onClick={onFillBots}
                  >
                    🤖 봇으로 채우고 시작
                  </button>
                )}
              </div>
            ) : (
              <p className="cc-waiting-hint">
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
