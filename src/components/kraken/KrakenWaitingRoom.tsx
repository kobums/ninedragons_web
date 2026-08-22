import { useState } from 'react';
import type { KRGameState } from '../../types/kraken';
import {
  KR_BOT_FILL_TARGET,
  KR_MAX_PLAYERS,
  KR_MIN_PLAYERS,
  KR_ROLE_POOL,
} from '../../types/kraken';
import type { KRToast } from '../../hooks/useKrakenGameState';
import {
  RoomCodeBadge,
  RoomJoinControls,
  useRoomJoin,
} from '../RoomCodeControls';
import { loadNickname, saveNickname } from '../../utils/nickname';
import './KrakenWaitingRoom.css';

interface KrakenWaitingRoomProps {
  // 입장 전이면 null (hasJoined 가 false 일 수도 있다)
  game: KRGameState | null;
  hasJoined: boolean;
  toasts?: KRToast[];
  onJoin: (name: string, room: string) => void;
  onStart: () => void;
  onFillBots: () => void;
  onBack: () => void;
}

export function KrakenWaitingRoom({
  game,
  hasJoined,
  toasts = [],
  onJoin,
  onStart,
  onFillBots,
  onBack,
}: KrakenWaitingRoomProps) {
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
    ? Array.from({ length: KR_MAX_PLAYERS }).filter((_, i) => seatOf(i)).length
    : 0;
  const hostSeat = game?.hostSeat ?? 0;
  const isHost = game !== null && game.yourSeat === hostSeat;
  const needMore = Math.max(0, KR_MIN_PLAYERS - filled);
  // 지금 인원으로 시작하면 어떤 역할 풀이 되는지 미리 보여준다 (전원 공개 정보)
  const pool = game?.rolePool ?? KR_ROLE_POOL[filled] ?? null;

  return (
    <div className="kr-scope kr-waiting">
      {toasts.length > 0 && (
        <div className="kr-waiting-toasts">
          {toasts.map((t) => (
            <div key={t.id} className="kr-waiting-toast">
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
      <div className="kr-waiting-container">
        <h1 className="kr-title">노 터치 크라켄</h1>
        <p className="kr-subtitle">🐙 심해 정체 은닉 카드 뒤집기 · 4~8인</p>

        {!hasJoined ? (
          <form onSubmit={handleSubmit} className="kr-join-form">
            <div className="kr-form-group">
              <label htmlFor="krPlayerName">플레이어 이름</label>
              <input
                type="text"
                id="krPlayerName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="이름을 입력하세요"
                maxLength={20}
                required
              />
            </div>
            <RoomJoinControls join={roomJoin} tone="dark" idPrefix="kr" />
            <button
              type="submit"
              className="kr-primary-button"
              disabled={joining || !roomJoin.roomReady}
            >
              {joining ? '입장 중...' : '입장하기'}
            </button>
            <button type="button" className="kr-ghost-button" onClick={onBack}>
              게임 선택으로
            </button>
          </form>
        ) : !game ? (
          <p className="kr-waiting-hint">입장 중...</p>
        ) : (
          <div className="kr-seat-list-wrap">
            <RoomCodeBadge code={game.roomCode} tone="dark" />
            <ul className="kr-seat-list">
              {Array.from({ length: KR_MAX_PLAYERS }).map((_, seat) => {
                const p = seatOf(seat);
                return p ? (
                  <li key={seat} className="kr-seat-item">
                    <span className="kr-seat-item-name">
                      {seat === hostSeat && <span className="kr-crown">👑</span>}
                      {p.name}
                      {p.bot && ' 🤖'}
                      {seat === game.yourSeat && ' (나)'}
                    </span>
                    <span className={`kr-dot ${p.connected ? 'on' : 'off'}`} />
                  </li>
                ) : (
                  <li key={seat} className="kr-seat-item empty">
                    {seat + 1}번 좌석 — 대기 중...
                  </li>
                );
              })}
            </ul>

            <p className="kr-waiting-hint">
              {filled}/{KR_MAX_PLAYERS}명
              {needMore > 0
                ? ` · 시작까지 ${needMore}명 더 필요합니다`
                : ' · 호스트가 시작할 수 있습니다'}
            </p>

            {pool && filled >= KR_MIN_PLAYERS && (
              <p className="kr-pool-hint">
                {filled}인 역할 풀 — 🗺 탐험대 {pool.expedition} · 💀 해골{' '}
                {pool.skeleton} (총 {pool.expedition + pool.skeleton}장 중{' '}
                {filled}장만 배분되어 실제 구성은 아무도 모릅니다)
              </p>
            )}

            {isHost ? (
              <div className="kr-host-actions">
                <button
                  type="button"
                  className="kr-primary-button"
                  onClick={onStart}
                  disabled={filled < KR_MIN_PLAYERS}
                >
                  {filled < KR_MIN_PLAYERS
                    ? `${KR_MIN_PLAYERS}명 이상 모여야 합니다`
                    : '게임 시작'}
                </button>
                {filled < KR_BOT_FILL_TARGET && (
                  <button
                    type="button"
                    className="kr-ghost-button"
                    onClick={onFillBots}
                  >
                    🤖 봇으로 채우고 시작 ({KR_BOT_FILL_TARGET}인)
                  </button>
                )}
              </div>
            ) : (
              <p className="kr-waiting-hint">
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
