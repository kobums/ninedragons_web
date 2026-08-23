import { useState } from 'react';
import type { SEGameState } from '../../types/set';
import {
  SE_BOT_FILL_TARGET,
  SE_MAX_PLAYERS,
  SE_MIN_PLAYERS,
} from '../../types/set';
import type { SEToast } from '../../hooks/useSetGameState';
import {
  RoomCodeBadge,
  RoomJoinControls,
  useRoomJoin,
} from '../RoomCodeControls';
import { loadNickname, saveNickname } from '../../utils/nickname';
import './SetWaitingRoom.css';

interface SetWaitingRoomProps {
  // 입장 전이면 null (hasJoined 가 false 일 수도 있다)
  game: SEGameState | null;
  hasJoined: boolean;
  toasts?: SEToast[];
  onJoin: (name: string, room: string) => void;
  onStart: () => void;
  onFillBots: () => void;
  onBack: () => void;
}

export function SetWaitingRoom({
  game,
  hasJoined,
  toasts = [],
  onJoin,
  onStart,
  onFillBots,
  onBack,
}: SetWaitingRoomProps) {
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
    ? Array.from({ length: SE_MAX_PLAYERS }).filter((_, i) => seatOf(i)).length
    : 0;
  const hostSeat = game?.hostSeat ?? 0;
  const isHost = game !== null && game.yourSeat === hostSeat;

  return (
    <div className="se-scope se-waiting">
      {toasts.length > 0 && (
        <div className="se-waiting-toasts">
          {toasts.map((t) => (
            <div key={t.id} className="se-waiting-toast">
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
      <div className="se-waiting-container">
        <h1 className="se-title">세트</h1>
        <p className="se-subtitle">
          🔺 차례 없는 선착순 패턴 찾기 · 1~{SE_MAX_PLAYERS}인
        </p>

        {!hasJoined ? (
          <form onSubmit={handleSubmit} className="se-join-form">
            <div className="se-form-group">
              <label htmlFor="sePlayerName">플레이어 이름</label>
              <input
                type="text"
                id="sePlayerName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="이름을 입력하세요"
                maxLength={20}
                required
              />
            </div>
            <RoomJoinControls join={roomJoin} idPrefix="se" />
            <button
              type="submit"
              className="se-primary-button"
              disabled={joining || !roomJoin.roomReady}
            >
              {joining ? '입장 중...' : '입장하기'}
            </button>
            <button type="button" className="se-ghost-button" onClick={onBack}>
              게임 선택으로
            </button>
          </form>
        ) : !game ? (
          <p className="se-waiting-hint">입장 중...</p>
        ) : (
          <div className="se-seat-list-wrap">
            <RoomCodeBadge code={game.roomCode} />

            {/* 규칙 요약 — 차례가 없다는 점을 먼저 못 박는다 */}
            <div className="se-rule-card">
              <p className="se-rule-line">
                네 속성(모양·개수·채움·색)이 각각 <strong>전부 같거나 전부
                다른</strong> 카드 3장이 세트입니다
              </p>
              <p className="se-rule-line muted">
                차례가 없습니다 — 먼저 찾아 탭한 사람이 가져갑니다.
                성공 +1점, 헛짚으면 −1점에 5초 잠금.
              </p>
            </div>

            <ul className="se-seat-list">
              {Array.from({ length: SE_MAX_PLAYERS }).map((_, seat) => {
                const p = seatOf(seat);
                return p ? (
                  <li key={seat} className="se-seat-item">
                    <span className="se-seat-item-name">
                      {seat === hostSeat && <span className="se-crown">👑</span>}
                      {p.name}
                      {p.bot && ' 🤖'}
                      {seat === game.yourSeat && ' (나)'}
                    </span>
                    <span className={`se-dot ${p.connected ? 'on' : 'off'}`} />
                  </li>
                ) : (
                  <li key={seat} className="se-seat-item empty">
                    {seat + 1}번 좌석 — 대기 중...
                  </li>
                );
              })}
            </ul>

            <p className="se-waiting-hint">
              {filled}/{SE_MAX_PLAYERS}명
              {filled < SE_MIN_PLAYERS
                ? ' · 시작을 기다리는 중입니다'
                : ' · 혼자서도 연습으로 시작할 수 있습니다'}
            </p>

            {isHost ? (
              <div className="se-host-actions">
                <button
                  type="button"
                  className="se-primary-button"
                  onClick={onStart}
                  disabled={filled < SE_MIN_PLAYERS}
                >
                  게임 시작
                </button>
                {filled < SE_BOT_FILL_TARGET && (
                  <button
                    type="button"
                    className="se-ghost-button"
                    onClick={onFillBots}
                  >
                    🤖 봇으로 채우고 시작
                  </button>
                )}
              </div>
            ) : (
              <p className="se-waiting-hint">
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
