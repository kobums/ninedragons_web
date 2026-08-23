import { useState } from 'react';
import type { KGGameState } from '../../types/skullking';
import {
  KG_BOT_FILL_TARGET,
  KG_MAX_PLAYERS,
  KG_MIN_PLAYERS,
  kgMaxRound,
} from '../../types/skullking';
import type { KGToast } from '../../hooks/useSkullKingGameState';
import {
  RoomCodeBadge,
  RoomJoinControls,
  useRoomJoin,
} from '../RoomCodeControls';
import { loadNickname, saveNickname } from '../../utils/nickname';
import './SkullKingWaitingRoom.css';

interface SkullKingWaitingRoomProps {
  // 입장 전이면 null (hasJoined 가 false 일 수도 있다)
  game: KGGameState | null;
  hasJoined: boolean;
  toasts?: KGToast[];
  onJoin: (name: string, room: string) => void;
  onStart: () => void;
  onFillBots: () => void;
  onBack: () => void;
}

export function SkullKingWaitingRoom({
  game,
  hasJoined,
  toasts = [],
  onJoin,
  onStart,
  onFillBots,
  onBack,
}: SkullKingWaitingRoomProps) {
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
    ? Array.from({ length: KG_MAX_PLAYERS }).filter((_, i) => seatOf(i)).length
    : 0;
  const hostSeat = game?.hostSeat ?? 0;
  const isHost = game !== null && game.yourSeat === hostSeat;
  const needMore = Math.max(0, KG_MIN_PLAYERS - filled);
  // 지금 인원으로 시작하면 몇 라운드짜리 판이 되는지 미리 보여준다
  const rounds = filled > 0 ? kgMaxRound(filled) : 0;

  return (
    <div className="kg-scope kg-waiting">
      {toasts.length > 0 && (
        <div className="kg-waiting-toasts">
          {toasts.map((t) => (
            <div key={t.id} className="kg-waiting-toast">
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
      <div className="kg-waiting-container">
        <h1 className="kg-title">스컬킹</h1>
        <p className="kg-subtitle">🏴‍☠️ 비드 트릭테이킹 · 2~8인</p>

        {!hasJoined ? (
          <form onSubmit={handleSubmit} className="kg-join-form">
            <div className="kg-form-group">
              <label htmlFor="kgPlayerName">플레이어 이름</label>
              <input
                type="text"
                id="kgPlayerName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="이름을 입력하세요"
                maxLength={20}
                required
              />
            </div>
            <RoomJoinControls join={roomJoin} tone="dark" idPrefix="kg" />
            <button
              type="submit"
              className="kg-primary-button"
              disabled={joining || !roomJoin.roomReady}
            >
              {joining ? '입장 중...' : '입장하기'}
            </button>
            <button type="button" className="kg-ghost-button" onClick={onBack}>
              게임 선택으로
            </button>
          </form>
        ) : !game ? (
          <p className="kg-waiting-hint">입장 중...</p>
        ) : (
          <div className="kg-seat-list-wrap">
            <RoomCodeBadge code={game.roomCode} tone="dark" />
            <ul className="kg-seat-list">
              {Array.from({ length: KG_MAX_PLAYERS }).map((_, seat) => {
                const p = seatOf(seat);
                return p ? (
                  <li key={seat} className="kg-seat-item">
                    <span className="kg-seat-item-name">
                      {seat === hostSeat && <span className="kg-crown">👑</span>}
                      {p.name}
                      {p.bot && ' 🤖'}
                      {seat === game.yourSeat && ' (나)'}
                    </span>
                    <span className={`kg-dot ${p.connected ? 'on' : 'off'}`} />
                  </li>
                ) : (
                  <li key={seat} className="kg-seat-item empty">
                    {seat + 1}번 좌석 — 대기 중...
                  </li>
                );
              })}
            </ul>

            <p className="kg-waiting-hint">
              {filled}/{KG_MAX_PLAYERS}명
              {needMore > 0
                ? ` · 시작까지 ${needMore}명 더 필요합니다`
                : ' · 호스트가 시작할 수 있습니다'}
            </p>

            {filled >= KG_MIN_PLAYERS && (
              <p className="kg-round-hint">
                {filled}인이면 총 {rounds}라운드 — r라운드에 각자 r장씩 받습니다
                (덱 66장을 넘지 않게 라운드 수가 정해집니다)
              </p>
            )}

            {isHost ? (
              <div className="kg-host-actions">
                <button
                  type="button"
                  className="kg-primary-button"
                  onClick={onStart}
                  disabled={filled < KG_MIN_PLAYERS}
                >
                  {filled < KG_MIN_PLAYERS
                    ? `${KG_MIN_PLAYERS}명 이상 모여야 합니다`
                    : '게임 시작'}
                </button>
                {filled < KG_BOT_FILL_TARGET && (
                  <button
                    type="button"
                    className="kg-ghost-button"
                    onClick={onFillBots}
                  >
                    🤖 봇으로 채우고 시작 ({KG_BOT_FILL_TARGET}인)
                  </button>
                )}
              </div>
            ) : (
              <p className="kg-waiting-hint">
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
