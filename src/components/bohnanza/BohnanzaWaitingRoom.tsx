import { useState } from 'react';
import type { BZGameState } from '../../types/bohnanza';
import {
  BZ_BEANS,
  BZ_BOT_FILL_TARGET,
  BZ_DECK_SIZE,
  BZ_MAX_PLAYERS,
  BZ_METER_STEPS,
  BZ_MIN_PLAYERS,
  BZ_START_FIELDS,
  BZ_START_HAND,
  BZ_THIRD_FIELD_COST,
} from '../../types/bohnanza';
import type { BZToast } from '../../hooks/useBohnanzaGameState';
import {
  RoomCodeBadge,
  RoomJoinControls,
  useRoomJoin,
} from '../RoomCodeControls';
import { loadNickname, saveNickname } from '../../utils/nickname';
import './BohnanzaWaitingRoom.css';

interface BohnanzaWaitingRoomProps {
  // 입장 전이면 null (hasJoined 가 false 일 수도 있다)
  game: BZGameState | null;
  hasJoined: boolean;
  toasts?: BZToast[];
  onJoin: (name: string, room: string) => void;
  onStart: () => void;
  onFillBots: () => void;
  onBack: () => void;
}

export function BohnanzaWaitingRoom({
  game,
  hasJoined,
  toasts = [],
  onJoin,
  onStart,
  onFillBots,
  onBack,
}: BohnanzaWaitingRoomProps) {
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
    ? Array.from({ length: BZ_MAX_PLAYERS }).filter((_, i) => seatOf(i)).length
    : 0;
  const hostSeat = game?.hostSeat ?? 0;
  const isHost = game !== null && game.yourSeat === hostSeat;
  const needMore = Math.max(0, BZ_MIN_PLAYERS - filled);

  return (
    <div className="bz-waiting">
      {toasts.length > 0 && (
        <div className="bz-waiting-toasts">
          {toasts.map((t) => (
            <div key={t.id} className="bz-waiting-toast">
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
      <div className="bz-waiting-container">
        <h1 className="bz-title">보난자</h1>
        <p className="bz-subtitle">
          🫘 콩을 심고 거래해 금화를 모으세요 · 3~5인
        </p>

        {/* ★ 콩미터 표 — 이 게임 판단의 전부. 대기실에서 미리 익혀 둔다 ★ */}
        <div className="bz-meter-table-wrap">
          <span className="bz-legend-title">콩미터 — 몇 장을 수확하면 금화 몇 개</span>
          <table className="bz-meter-table">
            <thead>
              <tr>
                <th className="left">콩</th>
                <th>장수</th>
                {Array.from({ length: BZ_METER_STEPS }).map((_, i) => (
                  <th key={i}>🪙{i + 1}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {BZ_BEANS.map((b) => (
                <tr key={b.bean} className={`bz-tone-${b.tone}`}>
                  <td className="left bz-meter-bean">
                    <span className="bz-meter-emoji" aria-hidden="true">
                      {b.emoji}
                    </span>
                    <span className="bz-meter-name">{b.name}</span>
                  </td>
                  <td className="bz-meter-total">{b.total}</td>
                  {b.meter.map((need, i) => (
                    <td
                      key={i}
                      className={need === null ? 'bz-meter-none' : 'bz-meter-need'}
                    >
                      {need === null ? '—' : need}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="bz-legend-note">
          숫자는 <b>금화 N개를 받는 최소 장수</b>입니다 · 문턱에 못 미치면 금화
          0개 · <b>강낭콩만 예외로 금화 1개·4개 칸이 없습니다</b>
          <br />
          흔한 콩(장수 많음)일수록 모으기 쉽지만 문턱이 높습니다 — 총{' '}
          {BZ_DECK_SIZE}장
        </p>

        {!hasJoined ? (
          <form onSubmit={handleSubmit} className="bz-join-form">
            <div className="bz-form-group">
              <label htmlFor="bzPlayerName">플레이어 이름</label>
              <input
                type="text"
                id="bzPlayerName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="이름을 입력하세요"
                maxLength={20}
                required
              />
            </div>
            <RoomJoinControls join={roomJoin} idPrefix="bz" />
            <button
              type="submit"
              className="bz-primary-button"
              disabled={joining || !roomJoin.roomReady}
            >
              {joining ? '입장 중...' : '입장하기'}
            </button>
            <button type="button" className="bz-ghost-button" onClick={onBack}>
              게임 선택으로
            </button>
          </form>
        ) : !game ? (
          <p className="bz-waiting-hint">입장 중...</p>
        ) : (
          <div className="bz-seat-list-wrap">
            <RoomCodeBadge code={game.roomCode} />
            <ul className="bz-seat-list">
              {Array.from({ length: BZ_MAX_PLAYERS }).map((_, seat) => {
                const p = seatOf(seat);
                return p ? (
                  <li key={seat} className="bz-seat-item">
                    <span className="bz-seat-item-name">
                      {seat === hostSeat && <span className="bz-crown">👑</span>}
                      {p.name}
                      {p.bot && ' 🤖'}
                      {seat === game.yourSeat && ' (나)'}
                    </span>
                    <span className={`bz-dot ${p.connected ? 'on' : 'off'}`} />
                  </li>
                ) : (
                  <li key={seat} className="bz-seat-item empty">
                    {seat + 1}번 좌석 — 대기 중...
                  </li>
                );
              })}
            </ul>

            <p className="bz-waiting-hint">
              {filled}/{BZ_MAX_PLAYERS}명
              {needMore > 0
                ? ` · 시작까지 ${needMore}명 더 필요합니다`
                : ' · 호스트가 시작할 수 있습니다'}
            </p>

            {/* 차례 4단계 — 보드 상단 안내와 같은 순서·같은 말로 적는다 */}
            <ol className="bz-step-guide">
              <li>
                <span className="bz-step-no">1</span>
                <span className="bz-step-body">
                  <b>콩 심기</b> — 손패 <b>맨 앞</b> 카드를 <b>반드시</b>{' '}
                  심습니다. 두 번째 카드는 선택, 세 번째부터는 못 심습니다.
                </span>
              </li>
              <li>
                <span className="bz-step-no">2</span>
                <span className="bz-step-body">
                  <b>2장 뒤집기 + 거래·기부</b> — 덱 위 2장을 공개하고 거래하거나
                  그냥 줍니다. <b>모든 거래에는 차례인 사람이 반드시 낍니다.</b>{' '}
                  아무도 안 가져간 공개 카드는 차례인 사람이 심습니다.
                </span>
              </li>
              <li>
                <span className="bz-step-no">3</span>
                <span className="bz-step-body">
                  <b>받은 콩 심기</b> — 거래·기부로 받은 카드는{' '}
                  <b>손에 못 들고 즉시 전부</b> 심습니다.
                </span>
              </li>
              <li>
                <span className="bz-step-no">4</span>
                <span className="bz-step-body">
                  <b>카드 3장 뽑기</b> — 한 장씩 뽑아 손패 <b>맨 뒤</b>에
                  붙입니다.
                </span>
              </li>
            </ol>

            <p className="bz-rule-hint">
              각자 손패 {BZ_START_HAND}장, 콩밭 {BZ_START_FIELDS}개, 금화 0으로
              시작합니다.
              <br />
              <b>손패 순서는 절대 바뀌지 않습니다</b> — 맨 앞에서만 빠지고 맨
              뒤로만 붙습니다. 정렬하거나 순서를 바꿀 수 없습니다.
              <br />
              밭에는 <b>같은 종류만</b> 심을 수 있습니다. 빈 밭도 맞는 밭도
              없으면 밭 하나를 <b>수확</b>해 자리를 만들어야 합니다.
              <br />
              <b>수확</b>은 밭의 콩을 전부 팔아 콩미터대로 금화를 받는 것입니다
              (못 미치면 0개). <b>2장 이상인 밭이 있으면 1장짜리 밭은 수확할 수
              없습니다.</b> 수확은 자기 차례가 아니어도 언제든 가능합니다.
              <br />
              <b>세 번째 콩밭</b>은 금화 {BZ_THIRD_FIELD_COST}개로 삽니다 (게임
              중 1회, 차례가 아니어도 가능, 외상 불가).
              <br />
              덱이 <b>3번째로 소진</b>되면 끝납니다(<b>3인 판은 2번째</b>).
              금화가 가장 많은 사람이 승리하고, 동점이면{' '}
              <b>손에 든 카드가 많은 사람</b>이 이깁니다.
            </p>

            {isHost ? (
              <div className="bz-host-actions">
                <button
                  type="button"
                  className="bz-primary-button"
                  onClick={onStart}
                  disabled={filled < BZ_MIN_PLAYERS}
                >
                  {filled < BZ_MIN_PLAYERS
                    ? `${BZ_MIN_PLAYERS}명 이상 모여야 합니다`
                    : '게임 시작'}
                </button>
                {filled < BZ_BOT_FILL_TARGET && (
                  <button
                    type="button"
                    className="bz-ghost-button"
                    onClick={onFillBots}
                  >
                    🤖 봇으로 채우고 시작 ({BZ_BOT_FILL_TARGET}인)
                  </button>
                )}
              </div>
            ) : (
              <p className="bz-waiting-hint">
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
