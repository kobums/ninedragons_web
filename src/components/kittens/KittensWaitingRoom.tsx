import { useState } from 'react';
import type { EKGameState } from '../../types/kittens';
import {
  EK_BOT_FILL_TARGET,
  EK_MAX_PLAYERS,
  EK_MIN_PLAYERS,
} from '../../types/kittens';
import type { EKToast } from '../../hooks/useKittensGameState';
import {
  RoomCodeBadge,
  RoomJoinControls,
  useRoomJoin,
} from '../RoomCodeControls';
import { loadNickname, saveNickname } from '../../utils/nickname';
import './KittensWaitingRoom.css';

interface KittensWaitingRoomProps {
  // 입장 전이면 null (hasJoined 가 false 일 수도 있다)
  game: EKGameState | null;
  hasJoined: boolean;
  toasts?: EKToast[];
  onJoin: (name: string, room: string) => void;
  onStart: () => void;
  onFillBots: () => void;
  onBack: () => void;
}

export function KittensWaitingRoom({
  game,
  hasJoined,
  toasts = [],
  onJoin,
  onStart,
  onFillBots,
  onBack,
}: KittensWaitingRoomProps) {
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
    ? Array.from({ length: EK_MAX_PLAYERS }).filter((_, i) => seatOf(i)).length
    : 0;
  const hostSeat = game?.hostSeat ?? 0;
  const isHost = game !== null && game.yourSeat === hostSeat;

  return (
    <div className="ek-waiting">
      {toasts.length > 0 && (
        <div className="ek-waiting-toasts">
          {toasts.map((t) => (
            <div key={t.id} className="ek-waiting-toast">
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

      <div className="ek-waiting-container">
        <span className="ek-waiting-mark" aria-hidden="true">
          💣
        </span>
        <h1 className="ek-title">익스플로딩 키튼</h1>
        <p className="ek-subtitle">
          폭탄을 피해 끝까지 살아남기 · {EK_MIN_PLAYERS}~{EK_MAX_PLAYERS}인
        </p>

        {!hasJoined ? (
          <form onSubmit={handleSubmit} className="ek-join-form">
            <div className="ek-form-group">
              <label htmlFor="ekPlayerName">플레이어 이름</label>
              <input
                type="text"
                id="ekPlayerName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="이름을 입력하세요"
                maxLength={20}
                required
              />
            </div>
            <RoomJoinControls join={roomJoin} idPrefix="ek" />
            <button
              type="submit"
              className="ek-primary-button"
              disabled={joining || !roomJoin.roomReady}
            >
              {joining ? '입장 중...' : '입장하기'}
            </button>
            <button type="button" className="ek-ghost-button" onClick={onBack}>
              게임 선택으로
            </button>
          </form>
        ) : !game ? (
          <p className="ek-waiting-hint">입장 중...</p>
        ) : (
          <div className="ek-seat-list-wrap">
            <RoomCodeBadge code={game.roomCode} />

            {/* 규칙 요약 — 폭탄과 해체, 그리고 아뇨만 먼저 못 박는다 */}
            <div className="ek-rule-card">
              <p className="ek-rule-line">
                차례마다 카드를 원하는 만큼 내고 <strong>덱에서 1장을 뽑으면
                차례가 끝납니다</strong>
              </p>
              <p className="ek-rule-line">
                💣 폭탄을 뽑았는데 🛡 해체가 없으면 <strong>탈락</strong>
                입니다. 해체를 쓰면 폭탄을 덱 아무 곳에 몰래 되꽂습니다.
              </p>
              <p className="ek-rule-line muted">
                🚫 아뇨는 남이 낸 기능 카드를 무효로 만듭니다. 아뇨 위에 아뇨를
                겹칠 수 있고, 겹친 수가 짝수면 원래 효과가 살아납니다.
              </p>
            </div>

            <ul className="ek-seat-list">
              {Array.from({ length: EK_MAX_PLAYERS }).map((_, seat) => {
                const p = seatOf(seat);
                return p ? (
                  <li key={seat} className="ek-seat-item">
                    <span className="ek-seat-item-name">
                      {seat === hostSeat && <span className="ek-crown">👑</span>}
                      {p.name}
                      {p.bot && ' 🤖'}
                      {seat === game.yourSeat && ' (나)'}
                    </span>
                    <span className={`ek-dot ${p.connected ? 'on' : 'off'}`} />
                  </li>
                ) : (
                  <li key={seat} className="ek-seat-item empty">
                    {seat + 1}번 좌석 — 대기 중...
                  </li>
                );
              })}
            </ul>

            <p className="ek-waiting-hint">
              {filled}/{EK_MAX_PLAYERS}명
              {filled < EK_MIN_PLAYERS
                ? ` · ${EK_MIN_PLAYERS}명부터 시작할 수 있습니다`
                : ` · 폭탄은 인원보다 1장 적게 들어갑니다 (지금 ${Math.max(
                    0,
                    filled - 1,
                  )}장)`}
            </p>

            {isHost ? (
              <div className="ek-host-actions">
                <button
                  type="button"
                  className="ek-primary-button"
                  onClick={onStart}
                  disabled={filled < EK_MIN_PLAYERS}
                >
                  게임 시작
                </button>
                {filled < EK_BOT_FILL_TARGET && (
                  <button
                    type="button"
                    className="ek-ghost-button"
                    onClick={onFillBots}
                  >
                    🤖 봇으로 채우고 시작
                  </button>
                )}
              </div>
            ) : (
              <p className="ek-waiting-hint">
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
