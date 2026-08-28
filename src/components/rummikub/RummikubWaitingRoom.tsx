import { useState } from 'react';
import type { RUGameState } from '../../types/rummikub';
import {
  RU_BOT_FILL_TARGET,
  RU_COLORS,
  RU_MAX_PLAYERS,
  RU_MELD_MIN,
  RU_MIN_PLAYERS,
  RU_START_TILES,
  RU_TILE_COUNT,
  ruColorLabel,
  ruColorMark,
} from '../../types/rummikub';
import type { RUToast } from '../../hooks/useRummikubGameState';
import {
  RoomCodeBadge,
  RoomJoinControls,
  useRoomJoin,
} from '../RoomCodeControls';
import { loadNickname, saveNickname } from '../../utils/nickname';
import './RummikubWaitingRoom.css';

interface RummikubWaitingRoomProps {
  // 입장 전이면 null (hasJoined 가 false 일 수도 있다)
  game: RUGameState | null;
  hasJoined: boolean;
  toasts?: RUToast[];
  onJoin: (name: string, room: string) => void;
  onStart: () => void;
  onFillBots: () => void;
  onBack: () => void;
}

export function RummikubWaitingRoom({
  game,
  hasJoined,
  toasts = [],
  onJoin,
  onStart,
  onFillBots,
  onBack,
}: RummikubWaitingRoomProps) {
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
    ? Array.from({ length: RU_MAX_PLAYERS }).filter((_, i) => seatOf(i)).length
    : 0;
  const hostSeat = game?.hostSeat ?? 0;
  const isHost = game !== null && game.yourSeat === hostSeat;
  const needMore = Math.max(0, RU_MIN_PLAYERS - filled);

  return (
    <div className="ru-waiting">
      {toasts.length > 0 && (
        <div className="ru-waiting-toasts">
          {toasts.map((t) => (
            <div key={t.id} className="ru-waiting-toast">
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
      <div className="ru-waiting-container">
        <h1 className="ru-title">루미큐브</h1>
        <p className="ru-subtitle">
          🁢 받침대를 먼저 비우세요 — 그룹과 연속을 짜 맞추는 타일 게임 · 2~4인
        </p>

        {/* 타일 색 범례 — 색만이 아니라 기호·이름으로도 구분된다 */}
        <div className="ru-legend">
          {RU_COLORS.map((color) => (
            <span key={color} className={`ru-legend-item ru-c-${color}`}>
              <span className="ru-legend-tile">
                <span className="ru-legend-mark" aria-hidden="true">
                  {ruColorMark(color)}
                </span>
                <span className="ru-legend-num">7</span>
              </span>
              <span className="ru-legend-name">{ruColorLabel(color)}</span>
            </span>
          ))}
          <span className="ru-legend-item ru-c-joker">
            <span className="ru-legend-tile">
              <span className="ru-legend-mark" aria-hidden="true">
                🃏
              </span>
            </span>
            <span className="ru-legend-name">조커</span>
          </span>
        </div>
        <p className="ru-legend-note">
          조커는 세트 안에서 어떤 타일도 대신합니다 — 대신 남으면 벌점 50점
        </p>

        {!hasJoined ? (
          <form onSubmit={handleSubmit} className="ru-join-form">
            <div className="ru-form-group">
              <label htmlFor="ruPlayerName">플레이어 이름</label>
              <input
                type="text"
                id="ruPlayerName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="이름을 입력하세요"
                maxLength={20}
                required
              />
            </div>
            <RoomJoinControls join={roomJoin} idPrefix="ru" />
            <button
              type="submit"
              className="ru-primary-button"
              disabled={joining || !roomJoin.roomReady}
            >
              {joining ? '입장 중...' : '입장하기'}
            </button>
            <button type="button" className="ru-ghost-button" onClick={onBack}>
              게임 선택으로
            </button>
          </form>
        ) : !game ? (
          <p className="ru-waiting-hint">입장 중...</p>
        ) : (
          <div className="ru-seat-list-wrap">
            <RoomCodeBadge code={game.roomCode} />
            <ul className="ru-seat-list">
              {Array.from({ length: RU_MAX_PLAYERS }).map((_, seat) => {
                const p = seatOf(seat);
                return p ? (
                  <li key={seat} className="ru-seat-item">
                    <span className="ru-seat-item-name">
                      {seat === hostSeat && <span className="ru-crown">👑</span>}
                      {p.name}
                      {p.bot && ' 🤖'}
                      {seat === game.yourSeat && ' (나)'}
                    </span>
                    <span className={`ru-dot ${p.connected ? 'on' : 'off'}`} />
                  </li>
                ) : (
                  <li key={seat} className="ru-seat-item empty">
                    {seat + 1}번 좌석 — 대기 중...
                  </li>
                );
              })}
            </ul>

            <p className="ru-waiting-hint">
              {filled}/{RU_MAX_PLAYERS}명
              {needMore > 0
                ? ` · 시작까지 ${needMore}명 더 필요합니다`
                : ' · 호스트가 시작할 수 있습니다'}
            </p>

            <p className="ru-rule-hint">
              타일 {RU_TILE_COUNT}개(4색 × 1~13 두 벌 + 조커 2개)를 섞고 각자{' '}
              {RU_START_TILES}개를 받침대에 올린 채 시작합니다.
              <br />
              차례에는 타일을 내려놓거나, 못 하면{' '}
              <b>타일더미에서 1개 가져가고 끝냅니다</b>.
              <br />
              <b>세트</b>는 두 가지입니다 — <b>그룹</b>(색이 다른 같은 숫자
              3~4개)과 <b>연속</b>(색이 같고 숫자가 이어지는 3개 이상).
              <br />
              첫 내려놓기는 <b>등록</b>이라고 하며, 테이블 타일을 섞지 않고{' '}
              <b>내 타일만으로 합 {RU_MELD_MIN}점 이상</b>이어야 합니다. 등록한
              차례에는 숫자조합을 할 수 없습니다.
              <br />
              등록을 마치면 <b>숫자조합</b> — 테이블 위 세트를 마음대로 헐고 다시
              짤 수 있습니다. 단 차례가 끝날 때 테이블의 모든 세트가 유효해야
              하고, 내 타일이 최소 1개는 새로 나가야 합니다. 어긋나면{' '}
              <b>서버가 통째로 되돌립니다</b>.
              <br />
              받침대를 먼저 비운 사람이 승리합니다. 패자는 남은 타일 숫자 합이
              마이너스(조커는 50점)이고, 그 합계가 승자의 점수가 됩니다. 등록도
              못 하고 끝나면 벌점 100점입니다.
            </p>

            {isHost ? (
              <div className="ru-host-actions">
                <button
                  type="button"
                  className="ru-primary-button"
                  onClick={onStart}
                  disabled={filled < RU_MIN_PLAYERS}
                >
                  {filled < RU_MIN_PLAYERS
                    ? `${RU_MIN_PLAYERS}명 이상 모여야 합니다`
                    : '게임 시작'}
                </button>
                {filled < RU_BOT_FILL_TARGET && (
                  <button
                    type="button"
                    className="ru-ghost-button"
                    onClick={onFillBots}
                  >
                    🤖 봇으로 채우고 시작 ({RU_BOT_FILL_TARGET}인)
                  </button>
                )}
              </div>
            ) : (
              <p className="ru-waiting-hint">
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
