import { useState } from 'react';
import type { SBGameState } from '../../types/saboteur';
import {
  SB_BOT_FILL_TARGET,
  SB_MAX_PLAYERS,
  SB_MIN_PLAYERS,
  SB_SABOTEUR_COUNT,
} from '../../types/saboteur';
import type { SBToast } from '../../hooks/useSaboteurGameState';
import {
  RoomCodeBadge,
  RoomJoinControls,
  useRoomJoin,
} from '../RoomCodeControls';
import { loadNickname, saveNickname } from '../../utils/nickname';
import './SaboteurWaitingRoom.css';

interface SaboteurWaitingRoomProps {
  // 입장 전이면 null (hasJoined 가 false 일 수도 있다)
  game: SBGameState | null;
  hasJoined: boolean;
  toasts?: SBToast[];
  onJoin: (name: string, room: string) => void;
  onStart: () => void;
  onFillBots: () => void;
  onBack: () => void;
}

export function SaboteurWaitingRoom({
  game,
  hasJoined,
  toasts = [],
  onJoin,
  onStart,
  onFillBots,
  onBack,
}: SaboteurWaitingRoomProps) {
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
    ? Array.from({ length: SB_MAX_PLAYERS }).filter((_, i) => seatOf(i)).length
    : 0;
  const hostSeat = game?.hostSeat ?? 0;
  const isHost = game !== null && game.yourSeat === hostSeat;
  const needMore = Math.max(0, SB_MIN_PLAYERS - filled);
  // 지금 인원으로 시작하면 파괴꾼이 몇 명인지 (전원 공개 정보)
  const saboteurs = SB_SABOTEUR_COUNT[filled] ?? 0;

  return (
    <div className="sb-scope sb-waiting">
      {toasts.length > 0 && (
        <div className="sb-waiting-toasts">
          {toasts.map((t) => (
            <div key={t.id} className="sb-waiting-toast">
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
      <div className="sb-waiting-container">
        <h1 className="sb-title">사보타지</h1>
        <p className="sb-subtitle">
          ⛏ 갱도 정체 은닉 길 잇기 · 3~10인
        </p>

        {!hasJoined ? (
          <form onSubmit={handleSubmit} className="sb-join-form">
            <div className="sb-form-group">
              <label htmlFor="sbPlayerName">플레이어 이름</label>
              <input
                type="text"
                id="sbPlayerName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="이름을 입력하세요"
                maxLength={20}
                required
              />
            </div>
            <RoomJoinControls join={roomJoin} tone="dark" idPrefix="sb" />
            <button
              type="submit"
              className="sb-primary-button"
              disabled={joining || !roomJoin.roomReady}
            >
              {joining ? '입장 중...' : '입장하기'}
            </button>
            <button type="button" className="sb-ghost-button" onClick={onBack}>
              게임 선택으로
            </button>
          </form>
        ) : !game ? (
          <p className="sb-waiting-hint">입장 중...</p>
        ) : (
          <div className="sb-seat-list-wrap">
            <RoomCodeBadge code={game.roomCode} tone="dark" />
            <ul className="sb-seat-list">
              {Array.from({ length: SB_MAX_PLAYERS }).map((_, seat) => {
                const p = seatOf(seat);
                return p ? (
                  <li key={seat} className="sb-seat-item">
                    <span className="sb-seat-item-name">
                      {seat === hostSeat && <span className="sb-crown">👑</span>}
                      {p.name}
                      {p.bot && ' 🤖'}
                      {seat === game.yourSeat && ' (나)'}
                    </span>
                    <span className={`sb-dot ${p.connected ? 'on' : 'off'}`} />
                  </li>
                ) : (
                  <li key={seat} className="sb-seat-item empty">
                    {seat + 1}번 좌석 — 대기 중...
                  </li>
                );
              })}
            </ul>

            <p className="sb-waiting-hint">
              {filled}/{SB_MAX_PLAYERS}명
              {needMore > 0
                ? ` · 시작까지 ${needMore}명 더 필요합니다`
                : ' · 호스트가 시작할 수 있습니다'}
            </p>

            {filled >= SB_MIN_PLAYERS && saboteurs > 0 && (
              <p className="sb-pool-hint">
                {filled}인 구성 — 💣 방해꾼 {saboteurs}명 · ⛏ 광부{' '}
                {filled - saboteurs}명 (역할 풀에서 인원수만큼만 뽑으므로 실제
                구성은 아무도 모릅니다)
              </p>
            )}

            {isHost ? (
              <div className="sb-host-actions">
                <button
                  type="button"
                  className="sb-primary-button"
                  onClick={onStart}
                  disabled={filled < SB_MIN_PLAYERS}
                >
                  {filled < SB_MIN_PLAYERS
                    ? `${SB_MIN_PLAYERS}명 이상 모여야 합니다`
                    : '게임 시작'}
                </button>
                {filled < SB_BOT_FILL_TARGET && (
                  <button
                    type="button"
                    className="sb-ghost-button"
                    onClick={onFillBots}
                  >
                    🤖 봇으로 채우고 시작 ({SB_BOT_FILL_TARGET}인)
                  </button>
                )}
              </div>
            ) : (
              <p className="sb-waiting-hint">
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
