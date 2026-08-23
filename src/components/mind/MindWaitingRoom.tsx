import { useState } from 'react';
import type { MIGameState } from '../../types/mind';
import {
  MI_BOT_FILL_TARGET,
  MI_MAX_PLAYERS,
  MI_MAX_ROUND_BY_PLAYERS,
  MI_MIN_PLAYERS,
} from '../../types/mind';
import type { MIToast } from '../../hooks/useMindGameState';
import {
  RoomCodeBadge,
  RoomJoinControls,
  useRoomJoin,
} from '../RoomCodeControls';
import { loadNickname, saveNickname } from '../../utils/nickname';
import './MindWaitingRoom.css';

interface MindWaitingRoomProps {
  // 입장 전이면 null (hasJoined 가 false 일 수도 있다)
  game: MIGameState | null;
  hasJoined: boolean;
  toasts?: MIToast[];
  onJoin: (name: string, room: string) => void;
  onStart: () => void;
  onFillBots: () => void;
  onBack: () => void;
}

export function MindWaitingRoom({
  game,
  hasJoined,
  toasts = [],
  onJoin,
  onStart,
  onFillBots,
  onBack,
}: MindWaitingRoomProps) {
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
    ? Array.from({ length: MI_MAX_PLAYERS }).filter((_, i) => seatOf(i)).length
    : 0;
  const hostSeat = game?.hostSeat ?? 0;
  const isHost = game !== null && game.yourSeat === hostSeat;
  // 서버 maxRound 가 진실이지만 대기 중에는 0 일 수 있어 인원 표로 미리 보여준다
  const previewMaxRound =
    game?.maxRound && game.maxRound > 0
      ? game.maxRound
      : (MI_MAX_ROUND_BY_PLAYERS[filled] ?? 0);

  return (
    <div className="mi-scope mi-waiting">
      {toasts.length > 0 && (
        <div className="mi-waiting-toasts">
          {toasts.map((t) => (
            <div key={t.id} className="mi-waiting-toast">
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
      <div className="mi-waiting-container">
        <h1 className="mi-title">더 마인드</h1>
        <p className="mi-subtitle">
          ✨ 말하지 않고 오름차순 맞추기 · {MI_MIN_PLAYERS}~{MI_MAX_PLAYERS}인
          협력
        </p>

        {!hasJoined ? (
          <form onSubmit={handleSubmit} className="mi-join-form">
            <div className="mi-form-group">
              <label htmlFor="miPlayerName">플레이어 이름</label>
              <input
                type="text"
                id="miPlayerName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="이름을 입력하세요"
                maxLength={20}
                required
              />
            </div>
            <RoomJoinControls join={roomJoin} tone="dark" idPrefix="mi" />
            <button
              type="submit"
              className="mi-primary-button"
              disabled={joining || !roomJoin.roomReady}
            >
              {joining ? '입장 중...' : '입장하기'}
            </button>
            <button type="button" className="mi-ghost-button" onClick={onBack}>
              게임 선택으로
            </button>
          </form>
        ) : !game ? (
          <p className="mi-waiting-hint">입장 중...</p>
        ) : (
          <div className="mi-seat-list-wrap">
            <RoomCodeBadge code={game.roomCode} tone="dark" />

            {/* 규칙 요약 — 말하지 않는다는 점과 차례가 없다는 점을 먼저 못 박는다 */}
            <div className="mi-rule-card">
              <p className="mi-rule-line">
                손에 든 숫자 카드를 <strong>전원 통틀어 오름차순</strong>으로
                중앙에 냅니다
              </p>
              <p className="mi-rule-line">
                <strong>차례가 없습니다</strong> — 누구든 아무 때나 낼 수 있고,
                낼 수 있는 카드는 늘 내 최저 카드 하나뿐입니다
              </p>
              <p className="mi-rule-line danger">
                🤫 말·채팅·손짓 금지 — 이 게임에는 리액션조차 없습니다.
                &lsquo;지금이다&rsquo; 감각만 맞추세요
              </p>
              <p className="mi-rule-line muted">
                더 작은 카드가 남아 있으면 실수 — 그 카드들이 전부 터지고 ❤️
                생명이 1 줄어듭니다. 라운드 3·6·9 마치면 생명 +1, 2·5·8 마치면
                ⭐ 수리검 +1.
              </p>
              {previewMaxRound > 0 && (
                <p className="mi-rule-line muted">
                  {filled}인 기준 최종 라운드는 {previewMaxRound}라운드입니다
                </p>
              )}
            </div>

            <ul className="mi-seat-list">
              {Array.from({ length: MI_MAX_PLAYERS }).map((_, seat) => {
                const p = seatOf(seat);
                return p ? (
                  <li key={seat} className="mi-seat-item">
                    <span className="mi-seat-item-name">
                      {seat === hostSeat && <span className="mi-crown">👑</span>}
                      {p.name}
                      {p.bot && ' 🤖'}
                      {seat === game.yourSeat && ' (나)'}
                    </span>
                    <span className={`mi-dot ${p.connected ? 'on' : 'off'}`} />
                  </li>
                ) : (
                  <li key={seat} className="mi-seat-item empty">
                    {seat + 1}번 좌석 — 대기 중...
                  </li>
                );
              })}
            </ul>

            <p className="mi-waiting-hint">
              {filled}/{MI_MAX_PLAYERS}명
              {filled < MI_MIN_PLAYERS
                ? ` · ${MI_MIN_PLAYERS}명부터 시작할 수 있습니다`
                : ' · 시작 생명은 인원수와 같고 수리검은 1개로 시작합니다'}
            </p>

            {isHost ? (
              <div className="mi-host-actions">
                <button
                  type="button"
                  className="mi-primary-button"
                  onClick={onStart}
                  disabled={filled < MI_MIN_PLAYERS}
                >
                  게임 시작
                </button>
                {filled < MI_BOT_FILL_TARGET && (
                  <button
                    type="button"
                    className="mi-ghost-button"
                    onClick={onFillBots}
                  >
                    🤖 봇으로 {MI_BOT_FILL_TARGET}인 채우고 시작
                  </button>
                )}
              </div>
            ) : (
              <p className="mi-waiting-hint">
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
