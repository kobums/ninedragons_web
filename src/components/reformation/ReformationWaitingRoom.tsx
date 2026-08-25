import { useState } from 'react';
import type { RFGameState } from '../../types/reformation';
import {
  RF_BOT_FILL_TARGET,
  RF_MAX_PLAYERS,
  RF_MIN_PLAYERS,
} from '../../types/reformation';
import type { RFToast } from '../../hooks/useReformationGameState';
import {
  RoomCodeBadge,
  RoomJoinControls,
  useRoomJoin,
} from '../RoomCodeControls';
import { loadNickname, saveNickname } from '../../utils/nickname';
import './ReformationWaitingRoom.css';

interface ReformationWaitingRoomProps {
  // 입장 전이면 null (hasJoined 가 false 일 수도 있다)
  game: RFGameState | null;
  hasJoined: boolean;
  toasts?: RFToast[];
  onJoin: (name: string, room: string) => void;
  onStart: () => void;
  onFillBots: () => void;
  onBack: () => void;
}

export function ReformationWaitingRoom({
  game,
  hasJoined,
  toasts = [],
  onJoin,
  onStart,
  onFillBots,
  onBack,
}: ReformationWaitingRoomProps) {
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
    ? Array.from({ length: RF_MAX_PLAYERS }).filter((_, i) => seatOf(i)).length
    : 0;
  const hostSeat = game?.hostSeat ?? 0;
  const isHost = game !== null && game.yourSeat === hostSeat;
  const needMore = Math.max(0, RF_MIN_PLAYERS - filled);
  // 최대 10인이라 빈 좌석을 전부 그리면 목록이 길어진다 —
  // 채워진 좌석 + 다음 한 자리(최소 5줄)까지만 보여준다
  const visibleSlots = Math.min(
    RF_MAX_PLAYERS,
    Math.max(filled + 1, RF_BOT_FILL_TARGET),
  );

  return (
    <div className="rf-waiting">
      {toasts.length > 0 && (
        <div className="rf-waiting-toasts">
          {toasts.map((t) => (
            <div key={t.id} className="rf-waiting-toast">
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
      <div className="rf-waiting-container">
        <h1 className="rf-title">쿠: 리포메이션</h1>
        <p className="rf-subtitle">
          ⚜️ 충성파와 ⚒️ 개혁파로 갈린 궁정 — 같은 진영은 서로 공격할 수
          없습니다 · 2~10인
        </p>

        <div className="rf-faction-primer">
          <span className="rf-primer-chip loyalist">⚜️ 충성파</span>
          <span className="rf-primer-vs">vs</span>
          <span className="rf-primer-chip reformist">⚒️ 개혁파</span>
          <p className="rf-primer-note">
            진영은 전원 공개입니다. 은화를 피난처에 놓아 개종하거나, 쌓인 피난처 은화를
            횡령할 수 있습니다.
          </p>
        </div>

        {!hasJoined ? (
          <form onSubmit={handleSubmit} className="rf-join-form">
            <div className="rf-form-group">
              <label htmlFor="rfPlayerName">플레이어 이름</label>
              <input
                type="text"
                id="rfPlayerName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="이름을 입력하세요"
                maxLength={20}
                required
              />
            </div>
            <RoomJoinControls join={roomJoin} tone="dark" idPrefix="rf" />
            <button
              type="submit"
              className="rf-primary-button"
              disabled={joining || !roomJoin.roomReady}
            >
              {joining ? '입장 중...' : '입장하기'}
            </button>
            <button type="button" className="rf-ghost-button" onClick={onBack}>
              게임 선택으로
            </button>
          </form>
        ) : !game ? (
          <p className="rf-waiting-hint">입장 중...</p>
        ) : (
          <div className="rf-seat-list-wrap">
            <RoomCodeBadge code={game.roomCode} tone="dark" />
            <ul className="rf-seat-list">
              {Array.from({ length: visibleSlots }).map((_, seat) => {
                const p = seatOf(seat);
                return p ? (
                  <li key={seat} className="rf-seat-item">
                    <span className="rf-seat-item-name">
                      {seat === hostSeat && <span className="rf-crown">👑</span>}
                      {p.name}
                      {p.bot && ' 🤖'}
                      {seat === game.yourSeat && ' (나)'}
                    </span>
                    <span className={`rf-dot ${p.connected ? 'on' : 'off'}`} />
                  </li>
                ) : (
                  <li key={seat} className="rf-seat-item empty">
                    {seat + 1}번 좌석 — 대기 중...
                  </li>
                );
              })}
            </ul>

            <p className="rf-waiting-hint">
              {filled}/{RF_MAX_PLAYERS}명
              {needMore > 0
                ? ` · 시작까지 ${needMore}명 더 필요합니다`
                : ' · 호스트가 시작할 수 있습니다'}
            </p>
            <p className="rf-waiting-hint">
              시작하면 절반씩 두 진영으로 무작위 배정됩니다 (홀수면 한쪽이 1명
              많습니다)
            </p>

            {isHost ? (
              <div className="rf-host-actions">
                <button
                  type="button"
                  className="rf-primary-button"
                  onClick={onStart}
                  disabled={filled < RF_MIN_PLAYERS}
                >
                  게임 시작
                </button>
                {filled < RF_BOT_FILL_TARGET && (
                  <button
                    type="button"
                    className="rf-ghost-button"
                    onClick={onFillBots}
                  >
                    🤖 봇으로 채우고 바로 시작 ({RF_BOT_FILL_TARGET}인)
                  </button>
                )}
              </div>
            ) : (
              <p className="rf-waiting-hint">
                👑 {seatOf(hostSeat)?.name ?? '호스트'}님이 시작을 결정합니다
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
