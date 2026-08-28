import { useState } from 'react';
import type { SUGameState } from '../../types/startups';
import {
  SU_BOT_FILL_TARGET,
  SU_COMPANIES,
  SU_DECK_SIZE,
  SU_MAX_PLAYERS,
  SU_MIN_PLAYERS,
  SU_REMOVED_CARDS,
  SU_START_MONEY,
} from '../../types/startups';
import type { SUToast } from '../../hooks/useStartupsGameState';
import {
  RoomCodeBadge,
  RoomJoinControls,
  useRoomJoin,
} from '../RoomCodeControls';
import { loadNickname, saveNickname } from '../../utils/nickname';
import './StartupsWaitingRoom.css';

interface StartupsWaitingRoomProps {
  // 입장 전이면 null (hasJoined 가 false 일 수도 있다)
  game: SUGameState | null;
  hasJoined: boolean;
  toasts?: SUToast[];
  onJoin: (name: string, room: string) => void;
  onStart: () => void;
  onFillBots: () => void;
  onBack: () => void;
}

export function StartupsWaitingRoom({
  game,
  hasJoined,
  toasts = [],
  onJoin,
  onStart,
  onFillBots,
  onBack,
}: StartupsWaitingRoomProps) {
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
    ? Array.from({ length: SU_MAX_PLAYERS }).filter((_, i) => seatOf(i)).length
    : 0;
  const hostSeat = game?.hostSeat ?? 0;
  const isHost = game !== null && game.yourSeat === hostSeat;
  const needMore = Math.max(0, SU_MIN_PLAYERS - filled);

  return (
    <div className="su-waiting">
      {toasts.length > 0 && (
        <div className="su-waiting-toasts">
          {toasts.map((t) => (
            <div key={t.id} className="su-waiting-toast">
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
      <div className="su-waiting-container">
        <h1 className="su-title">스타트업스</h1>
        <p className="su-subtitle">
          📈 회사 6종의 대주주가 되어 돈을 긁어모으세요 · 3~7인
        </p>

        {/* 회사 6종 범례 — 색만이 아니라 이모지·이름·가치로도 구분된다 */}
        <div className="su-company-legend">
          {SU_COMPANIES.map((c) => (
            <span
              key={c.id}
              className={`su-company-legend-item su-tone-${c.tone}`}
            >
              <span className="su-legend-emoji" aria-hidden="true">
                {c.emoji}
              </span>
              <span className="su-legend-name">{c.name}</span>
              <span className="su-legend-size">{c.size}장 · {c.size}원</span>
            </span>
          ))}
        </div>
        <p className="su-legend-note">
          장수가 적은 회사일수록 귀하지만, 대주주가 됐을 때 받는 돈은 적습니다
        </p>

        {!hasJoined ? (
          <form onSubmit={handleSubmit} className="su-join-form">
            <div className="su-form-group">
              <label htmlFor="suPlayerName">플레이어 이름</label>
              <input
                type="text"
                id="suPlayerName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="이름을 입력하세요"
                maxLength={20}
                required
              />
            </div>
            <RoomJoinControls join={roomJoin} idPrefix="su" />
            <button
              type="submit"
              className="su-primary-button"
              disabled={joining || !roomJoin.roomReady}
            >
              {joining ? '입장 중...' : '입장하기'}
            </button>
            <button type="button" className="su-ghost-button" onClick={onBack}>
              게임 선택으로
            </button>
          </form>
        ) : !game ? (
          <p className="su-waiting-hint">입장 중...</p>
        ) : (
          <div className="su-seat-list-wrap">
            <RoomCodeBadge code={game.roomCode} />
            <ul className="su-seat-list">
              {Array.from({ length: SU_MAX_PLAYERS }).map((_, seat) => {
                const p = seatOf(seat);
                return p ? (
                  <li key={seat} className="su-seat-item">
                    <span className="su-seat-item-name">
                      {seat === hostSeat && <span className="su-crown">👑</span>}
                      {p.name}
                      {p.bot && ' 🤖'}
                      {seat === game.yourSeat && ' (나)'}
                    </span>
                    <span className={`su-dot ${p.connected ? 'on' : 'off'}`} />
                  </li>
                ) : (
                  <li key={seat} className="su-seat-item empty">
                    {seat + 1}번 좌석 — 대기 중...
                  </li>
                );
              })}
            </ul>

            <p className="su-waiting-hint">
              {filled}/{SU_MAX_PLAYERS}명
              {needMore > 0
                ? ` · 시작까지 ${needMore}명 더 필요합니다`
                : ' · 호스트가 시작할 수 있습니다'}
            </p>

            <p className="su-rule-hint">
              주식 카드 {SU_DECK_SIZE}장을 섞고 {SU_REMOVED_CARDS}장을 빼서
              게임에서 제외합니다(아무도 못 봅니다). 각자 주식 카드 1장과 돈{' '}
              {SU_START_MONEY}원으로 시작합니다.
              <br />
              차례에는 <b>①</b> 덱 맨 위를 뽑거나 시장 카드 하나를 가져오고,{' '}
              <b>②</b> 손패에서 1장을 시장에 앞면으로 내려놓습니다.
              <br />
              <b>내가 대주주인 회사는 덱에서 뽑아도 가져올 수 없습니다</b> —
              돈 1원을 덱 위에 <b>안티</b>로 얹고 다시 뽑습니다(돈이 없으면
              시장에서 가져와야 합니다). 시장 카드를 가져오면 그 위에 쌓인
              안티를 전부 받습니다.
              <br />
              덱이 떨어지면 그 라운드를 마치고 정산합니다. 회사마다 앞면 카드를
              가장 많이 가진 <b>대주주</b>(동수면 없음)가 남들의 그 회사 카드
              1장당 <b>회사 가치(=총 장수)</b>만큼 돈을 받습니다. 최종 돈이 가장
              많은 사람이 승리합니다.
            </p>

            {isHost ? (
              <div className="su-host-actions">
                <button
                  type="button"
                  className="su-primary-button"
                  onClick={onStart}
                  disabled={filled < SU_MIN_PLAYERS}
                >
                  {filled < SU_MIN_PLAYERS
                    ? `${SU_MIN_PLAYERS}명 이상 모여야 합니다`
                    : '게임 시작'}
                </button>
                {filled < SU_BOT_FILL_TARGET && (
                  <button
                    type="button"
                    className="su-ghost-button"
                    onClick={onFillBots}
                  >
                    🤖 봇으로 채우고 시작 ({SU_BOT_FILL_TARGET}인)
                  </button>
                )}
              </div>
            ) : (
              <p className="su-waiting-hint">
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
