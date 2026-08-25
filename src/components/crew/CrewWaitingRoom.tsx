import { useState } from 'react';
import type { CWGameState } from '../../types/crew';
import {
  CW_BOT_FILL_TARGET,
  CW_DEFAULT_MAX_MISSION,
  CW_MAX_PLAYERS,
  CW_MIN_PLAYERS,
} from '../../types/crew';
import type { CWToast } from '../../hooks/useCrewGameState';
import {
  RoomCodeBadge,
  RoomJoinControls,
  useRoomJoin,
} from '../RoomCodeControls';
import { loadNickname, saveNickname } from '../../utils/nickname';
import './CrewWaitingRoom.css';

interface CrewWaitingRoomProps {
  // 입장 전이면 null (hasJoined 가 false 일 수도 있다)
  game: CWGameState | null;
  hasJoined: boolean;
  toasts?: CWToast[];
  onJoin: (name: string, room: string) => void;
  onStart: () => void;
  onFillBots: () => void;
  onBack: () => void;
}

export function CrewWaitingRoom({
  game,
  hasJoined,
  toasts = [],
  onJoin,
  onStart,
  onFillBots,
  onBack,
}: CrewWaitingRoomProps) {
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

  // 좌석 번호 → 대원. 이름 없는 항목은 빈 좌석으로 취급한다.
  const seatOf = (seat: number) => {
    const p = (game?.players ?? []).find((pl) => pl.seat === seat);
    return p && p.name ? p : null;
  };
  const filled = game
    ? Array.from({ length: CW_MAX_PLAYERS }).filter((_, i) => seatOf(i)).length
    : 0;
  const hostSeat = game?.hostSeat ?? 0;
  const isHost = game !== null && game.yourSeat === hostSeat;
  const needMore = Math.max(0, CW_MIN_PLAYERS - filled);
  const maxMission = game?.maxMission || CW_DEFAULT_MAX_MISSION;

  return (
    <div className="cw-scope cw-waiting">
      {toasts.length > 0 && (
        <div className="cw-waiting-toasts">
          {toasts.map((t) => (
            <div key={t.id} className="cw-waiting-toast">
              {t.event.message ??
                (t.event.kind === 'left'
                  ? `${t.event.name ?? '?'}님이 나갔습니다`
                  : t.event.kind === 'joined'
                    ? `${t.event.name ?? '?'}님이 탑승했습니다`
                    : '')}
            </div>
          ))}
        </div>
      )}
      <div className="cw-waiting-container">
        <h1 className="cw-title">더 크루</h1>
        <p className="cw-subtitle">🚀 협력 트릭테이킹 · 3~5인 · 전원이 한 팀</p>

        {!hasJoined ? (
          <form onSubmit={handleSubmit} className="cw-join-form">
            <div className="cw-form-group">
              <label htmlFor="cwPlayerName">대원 이름</label>
              <input
                type="text"
                id="cwPlayerName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="이름을 입력하세요"
                maxLength={20}
                required
              />
            </div>
            <RoomJoinControls join={roomJoin} tone="dark" idPrefix="cw" />
            <button
              type="submit"
              className="cw-primary-button"
              disabled={joining || !roomJoin.roomReady}
            >
              {joining ? '탑승 중...' : '탑승하기'}
            </button>
            <button type="button" className="cw-ghost-button" onClick={onBack}>
              게임 선택으로
            </button>
          </form>
        ) : !game ? (
          <p className="cw-waiting-hint">탑승 중...</p>
        ) : (
          <div className="cw-seat-list-wrap">
            <RoomCodeBadge code={game.roomCode} tone="dark" />
            <ul className="cw-seat-list">
              {Array.from({ length: CW_MAX_PLAYERS }).map((_, seat) => {
                const p = seatOf(seat);
                return p ? (
                  <li key={seat} className="cw-seat-item">
                    <span className="cw-seat-item-name">
                      {seat === hostSeat && <span className="cw-crown">👑</span>}
                      {p.name}
                      {p.bot && ' 🤖'}
                      {seat === game.yourSeat && ' (나)'}
                    </span>
                    <span className={`cw-dot ${p.connected ? 'on' : 'off'}`} />
                  </li>
                ) : (
                  <li key={seat} className="cw-seat-item empty">
                    {seat + 1}번 좌석 — 대기 중...
                  </li>
                );
              })}
            </ul>

            <p className="cw-waiting-hint">
              {filled}/{CW_MAX_PLAYERS}명
              {needMore > 0
                ? ` · 출항까지 ${needMore}명 더 필요합니다`
                : ' · 호스트가 시작할 수 있습니다'}
            </p>

            <p className="cw-brief">
              과제 1개짜리 1라운드부터 {maxMission}개짜리 {maxMission}라운드까지
              차례로 돌파합니다. 담당자가 자기 과제 카드를 직접 따내야 하고, 한
              장이라도 남의 손에 들어가면 그 자리에서 실패입니다. 게임 중 말을
              맞출 수 있는 기회는 <strong>1인 1회 통신</strong>뿐입니다.
            </p>

            {isHost ? (
              <div className="cw-host-actions">
                <button
                  type="button"
                  className="cw-primary-button"
                  onClick={onStart}
                  disabled={filled < CW_MIN_PLAYERS}
                >
                  {filled < CW_MIN_PLAYERS
                    ? `${CW_MIN_PLAYERS}명 이상 모여야 합니다`
                    : '출항'}
                </button>
                {filled < CW_BOT_FILL_TARGET && (
                  <button
                    type="button"
                    className="cw-ghost-button"
                    onClick={onFillBots}
                  >
                    🤖 봇으로 채우고 시작 ({CW_BOT_FILL_TARGET}인)
                  </button>
                )}
              </div>
            ) : (
              <p className="cw-waiting-hint">
                👑 {seatOf(hostSeat)?.name ?? '호스트'}님이 출항 버튼을 누르면
                게임이 시작됩니다
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
