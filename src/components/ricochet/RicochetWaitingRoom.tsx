import { useState } from 'react';
import type { RRGameState } from '../../types/ricochet';
import {
  RR_BOT_FILL_TARGET,
  RR_COLORS,
  RR_COLOR_GLYPH,
  RR_COLOR_LABEL,
  RR_MAX_PLAYERS,
  RR_MIN_PLAYERS,
} from '../../types/ricochet';
import type { RRToast } from '../../hooks/useRicochetGameState';
import {
  RoomCodeBadge,
  RoomJoinControls,
  useRoomJoin,
} from '../RoomCodeControls';
import { loadNickname, saveNickname } from '../../utils/nickname';
import './RicochetWaitingRoom.css';

interface RicochetWaitingRoomProps {
  // 입장 전이면 null (hasJoined 가 false 일 수도 있다)
  game: RRGameState | null;
  hasJoined: boolean;
  toasts?: RRToast[];
  onJoin: (name: string, room: string) => void;
  onStart: () => void;
  onFillBots: () => void;
  onBack: () => void;
}

export function RicochetWaitingRoom({
  game,
  hasJoined,
  toasts = [],
  onJoin,
  onStart,
  onFillBots,
  onBack,
}: RicochetWaitingRoomProps) {
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
    ? Array.from({ length: RR_MAX_PLAYERS }).filter((_, i) => seatOf(i)).length
    : 0;
  const hostSeat = game?.hostSeat ?? 0;
  const isHost = game !== null && game.yourSeat === hostSeat;

  return (
    <div className="rr-scope rr-waiting">
      {toasts.length > 0 && (
        <div className="rr-waiting-toasts">
          {toasts.map((t) => (
            <div key={t.id} className="rr-waiting-toast">
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
      <div className="rr-waiting-container">
        <h1 className="rr-title">리코셰 로봇</h1>
        <p className="rr-subtitle">
          🤖 동시에 푸는 미끄럼 퍼즐 · 1~8인 (혼자 연습도 가능)
        </p>

        <div className="rr-robot-row" aria-hidden="true">
          {RR_COLORS.map((color) => (
            <span key={color} className={`rr-robot rr-c-${color}`}>
              {RR_COLOR_GLYPH[color]}
            </span>
          ))}
        </div>
        <p className="rr-rule-hint">
          로봇은 <strong>벽이나 다른 로봇에 막힐 때까지 미끄러집니다</strong> —
          한 칸씩은 못 움직입니다. 목표 색 로봇을 목표 칸에 데려가는 최소 수를
          먼저 찾아 외치세요.
        </p>

        {!hasJoined ? (
          <form onSubmit={handleSubmit} className="rr-join-form">
            <div className="rr-form-group">
              <label htmlFor="rrPlayerName">플레이어 이름</label>
              <input
                type="text"
                id="rrPlayerName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="이름을 입력하세요"
                maxLength={20}
                required
              />
            </div>
            <RoomJoinControls join={roomJoin} idPrefix="rr" />
            <button
              type="submit"
              className="rr-primary-button"
              disabled={joining || !roomJoin.roomReady}
            >
              {joining ? '입장 중...' : '입장하기'}
            </button>
            <button type="button" className="rr-ghost-button" onClick={onBack}>
              게임 선택으로
            </button>
          </form>
        ) : !game ? (
          <p className="rr-waiting-hint">입장 중...</p>
        ) : (
          <div className="rr-seat-list-wrap">
            <RoomCodeBadge code={game.roomCode} />
            <ul className="rr-seat-list">
              {Array.from({ length: RR_MAX_PLAYERS }).map((_, seat) => {
                const p = seatOf(seat);
                return p ? (
                  <li key={seat} className="rr-seat-item">
                    <span className="rr-seat-item-name">
                      {seat === hostSeat && <span className="rr-crown">👑</span>}
                      {p.name}
                      {p.bot && ' 🤖'}
                      {seat === game.yourSeat && ' (나)'}
                    </span>
                    <span className={`rr-dot ${p.connected ? 'on' : 'off'}`} />
                  </li>
                ) : (
                  <li key={seat} className="rr-seat-item empty">
                    {seat + 1}번 좌석 — 대기 중...
                  </li>
                );
              })}
            </ul>

            <p className="rr-waiting-hint">
              {filled}/{RR_MAX_PLAYERS}명 · 차례가 없어 전원이 동시에 같은 판을
              풉니다
            </p>

            <ul className="rr-color-legend">
              {RR_COLORS.map((color) => (
                <li key={color}>
                  <span className={`rr-robot sm rr-c-${color}`}>
                    {RR_COLOR_GLYPH[color]}
                  </span>
                  {RR_COLOR_LABEL[color]} 로봇
                </li>
              ))}
            </ul>

            {isHost ? (
              <div className="rr-host-actions">
                <button
                  type="button"
                  className="rr-primary-button"
                  onClick={onStart}
                  disabled={filled < RR_MIN_PLAYERS}
                >
                  게임 시작
                </button>
                {filled < RR_BOT_FILL_TARGET && (
                  <button
                    type="button"
                    className="rr-ghost-button"
                    onClick={onFillBots}
                  >
                    🤖 봇으로 채우고 시작 ({RR_BOT_FILL_TARGET}인)
                  </button>
                )}
              </div>
            ) : (
              <p className="rr-waiting-hint">
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
