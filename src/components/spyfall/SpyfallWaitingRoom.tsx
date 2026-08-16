import { useState } from 'react';
import type { SPGameState } from '../../types/spyfall';
import {
  SP_MAX_PLAYERS,
  SP_MIN_PLAYERS,
  SP_TIMER_CHOICES,
  SP_CATEGORY_CHOICES,
  SP_CATEGORY_RANDOM,
} from '../../types/spyfall';
import './SpyfallWaitingRoom.css';

interface SpyfallWaitingRoomProps {
  // 입장 전이면 null (hasJoined 가 false 일 수도 있다)
  game: SPGameState | null;
  hasJoined: boolean;
  onJoin: (name: string) => void;
  onStart: () => void;
  onFillBots: () => void;
  onSetTimer: (minutes: number) => void;
  onSetCategory: (category: string) => void;
  onBack: () => void;
}

export function SpyfallWaitingRoom({
  game,
  hasJoined,
  onJoin,
  onStart,
  onFillBots,
  onSetTimer,
  onSetCategory,
  onBack,
}: SpyfallWaitingRoomProps) {
  const [name, setName] = useState('');
  // 연타로 join 이 두 번 나가는 것을 막는다
  const [joining, setJoining] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (joining || !name.trim()) return;
    setJoining(true);
    onJoin(name.trim());
    // 응답이 늦거나 실패해도 다시 시도할 수 있게 잠깐만 잠근다
    setTimeout(() => setJoining(false), 2000);
  };

  // 좌석 번호 → 참가자. 이름 없는 항목은 빈 좌석으로 취급한다.
  const seatOf = (seat: number) => {
    const p = game?.players.find((pl) => pl.seat === seat);
    return p && p.name ? p : null;
  };
  const filled = game
    ? Array.from({ length: SP_MAX_PLAYERS }).filter((_, i) => seatOf(i)).length
    : 0;
  const hostSeat = game?.hostSeat ?? 0;
  const isHost = game !== null && game.yourSeat === hostSeat;
  const needMore = Math.max(0, SP_MIN_PLAYERS - filled);
  const timerMinutes = game?.timerMinutes ?? 5;
  const categoryChoice = game?.categoryChoice ?? SP_CATEGORY_RANDOM;

  return (
    <div className="sp-waiting">
      <div className="sp-waiting-container">
        <h1 className="sp-title">스파이폴</h1>
        <p className="sp-subtitle">🕵️ 단어 추리 · 3~8인</p>

        {!hasJoined ? (
          <form onSubmit={handleSubmit} className="sp-join-form">
            <div className="sp-form-group">
              <label htmlFor="spPlayerName">플레이어 이름</label>
              <input
                type="text"
                id="spPlayerName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="이름을 입력하세요"
                maxLength={20}
                required
              />
            </div>
            <button type="submit" className="sp-primary-button" disabled={joining}>
              {joining ? '입장 중...' : '입장하기'}
            </button>
            <button type="button" className="sp-ghost-button" onClick={onBack}>
              게임 선택으로
            </button>
          </form>
        ) : !game ? (
          <p className="sp-waiting-hint">입장 중...</p>
        ) : (
          <div className="sp-seat-list-wrap">
            <ul className="sp-seat-list">
              {Array.from({ length: SP_MAX_PLAYERS }).map((_, seat) => {
                const p = seatOf(seat);
                return p ? (
                  <li key={seat} className="sp-seat-item">
                    <span className="sp-seat-item-name">
                      {seat === hostSeat && <span className="sp-crown">👑</span>}
                      {p.name}
                      {p.bot && ' 🤖'}
                      {seat === game.yourSeat && ' (나)'}
                    </span>
                    <span className={`sp-dot ${p.connected ? 'on' : 'off'}`} />
                  </li>
                ) : (
                  <li key={seat} className="sp-seat-item empty">
                    {seat + 1}번 좌석 — 대기 중...
                  </li>
                );
              })}
            </ul>

            {/* 타이머 선택 — host 만 조작, 나머지는 현황 표시 */}
            <div className="sp-timer-picker">
              <span className="sp-timer-label">⏱️ 토론 시간</span>
              <div
                className="sp-timer-options"
                role="group"
                aria-label="토론 시간 선택"
              >
                {SP_TIMER_CHOICES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={`sp-timer-option ${timerMinutes === m ? 'active' : ''}`}
                    onClick={() => isHost && onSetTimer(m)}
                    disabled={!isHost}
                  >
                    {m}분
                  </button>
                ))}
              </div>
            </div>

            {/* 카테고리 선택 — host 만 조작, 나머지는 현황 표시 */}
            <div className="sp-timer-picker">
              <span className="sp-timer-label">🗂️ 카테고리</span>
              <div
                className="sp-timer-options"
                role="group"
                aria-label="카테고리 선택"
              >
                {SP_CATEGORY_CHOICES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`sp-timer-option ${categoryChoice === c ? 'active' : ''}`}
                    onClick={() => isHost && onSetCategory(c)}
                    disabled={!isHost}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <p className="sp-waiting-hint">
              {filled}/{SP_MAX_PLAYERS}명
              {needMore > 0
                ? ` · 시작까지 ${needMore}명 더 필요합니다`
                : ' · 호스트가 시작할 수 있습니다'}
            </p>

            {isHost ? (
              <div className="sp-host-actions">
                <button
                  type="button"
                  className="sp-primary-button"
                  onClick={onStart}
                  disabled={filled < SP_MIN_PLAYERS}
                >
                  게임 시작
                </button>
                {needMore > 0 && (
                  <button
                    type="button"
                    className="sp-ghost-button"
                    onClick={onFillBots}
                  >
                    🤖 봇으로 채우기 ({SP_MIN_PLAYERS}인)
                  </button>
                )}
              </div>
            ) : (
              <p className="sp-waiting-hint">
                👑 {seatOf(hostSeat)?.name ?? '호스트'}님이 시작을 결정합니다
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
