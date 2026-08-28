import { useState } from 'react';
import type { CTGameState } from '../../types/citadels';
import {
  CT_BOT_FILL_TARGET,
  CT_CITY_GOAL,
  CT_COLORS,
  CT_COLOR_ICON,
  CT_COLOR_LABEL,
  CT_COLOR_TONE,
  CT_MAX_PLAYERS,
  CT_MIN_PLAYERS,
  CT_ROLES,
  CT_ROLE_ABILITY,
  CT_ROLE_ICON,
  CT_ROLE_NAME,
} from '../../types/citadels';
import type { CTToast } from '../../hooks/useCitadelsGameState';
import {
  RoomCodeBadge,
  RoomJoinControls,
  useRoomJoin,
} from '../RoomCodeControls';
import { loadNickname, saveNickname } from '../../utils/nickname';
import './CitadelsWaitingRoom.css';

interface CitadelsWaitingRoomProps {
  // 입장 전이면 null (hasJoined 가 false 일 수도 있다)
  game: CTGameState | null;
  hasJoined: boolean;
  toasts?: CTToast[];
  onJoin: (name: string, room: string) => void;
  onStart: () => void;
  onFillBots: () => void;
  onBack: () => void;
}

export function CitadelsWaitingRoom({
  game,
  hasJoined,
  toasts = [],
  onJoin,
  onStart,
  onFillBots,
  onBack,
}: CitadelsWaitingRoomProps) {
  const [name, setName] = useState(loadNickname);
  // 연타로 join 이 두 번 나가는 것을 막는다
  const [joining, setJoining] = useState(false);
  // 직업 8종 설명은 길어서 접어 둔다 (280px 에서도 화면이 무너지지 않게)
  const [rolesOpen, setRolesOpen] = useState(false);
  const roomJoin = useRoomJoin();

  const handleSubmit = (e: React.FormEvent) => {
    if (e) e.preventDefault();
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
    ? Array.from({ length: CT_MAX_PLAYERS }).filter((_, i) => seatOf(i)).length
    : 0;
  const hostSeat = game?.hostSeat ?? 0;
  const isHost = game !== null && game.yourSeat === hostSeat;
  const needMore = Math.max(0, CT_MIN_PLAYERS - filled);

  return (
    <div className="ct-waiting">
      {toasts.length > 0 && (
        <div className="ct-waiting-toasts">
          {toasts.map((t) => (
            <div key={t.id} className="ct-waiting-toast">
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
      <div className="ct-waiting-container">
        <h1 className="ct-title">시타델</h1>
        <p className="ct-subtitle">
          🏰 직업을 골라 금화를 모으고 건물 {CT_CITY_GOAL}채를 먼저 세우세요 ·
          3~7인
        </p>

        {/* 건물 5색 범례 — 색 + 아이콘 + 한글 이름을 함께 보여준다 */}
        <div className="ct-color-legend">
          {CT_COLORS.map((c) => (
            <span key={c} className={`ct-color-legend-item c-${c}`}>
              <span className="ct-color-legend-block" aria-hidden="true">
                {CT_COLOR_ICON[c]}
              </span>
              <span className="ct-color-legend-name">{CT_COLOR_LABEL[c]}</span>
              <span className="ct-color-legend-tone">{CT_COLOR_TONE[c]}</span>
            </span>
          ))}
        </div>

        {!hasJoined ? (
          <form onSubmit={handleSubmit} className="ct-join-form">
            <div className="ct-form-group">
              <label htmlFor="ctPlayerName">플레이어 이름</label>
              <input
                type="text"
                id="ctPlayerName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="이름을 입력하세요"
                maxLength={20}
                required
              />
            </div>
            <RoomJoinControls join={roomJoin} tone="dark" idPrefix="ct" />
            <button
              type="submit"
              className="ct-primary-button"
              disabled={joining || !roomJoin.roomReady}
            >
              {joining ? '입장 중...' : '입장하기'}
            </button>
            <button type="button" className="ct-ghost-button" onClick={onBack}>
              게임 선택으로
            </button>
          </form>
        ) : !game ? (
          <p className="ct-waiting-hint">입장 중...</p>
        ) : (
          <div className="ct-seat-list-wrap">
            <RoomCodeBadge code={game.roomCode} tone="dark" />
            <ul className="ct-seat-list">
              {Array.from({ length: CT_MAX_PLAYERS }).map((_, seat) => {
                const p = seatOf(seat);
                return p ? (
                  <li key={seat} className="ct-seat-item">
                    <span className="ct-seat-item-name">
                      {seat === hostSeat && <span className="ct-crown">👑</span>}
                      {p.name}
                      {p.bot && ' 🤖'}
                      {seat === game.yourSeat && ' (나)'}
                    </span>
                    <span className={`ct-dot ${p.connected ? 'on' : 'off'}`} />
                  </li>
                ) : (
                  <li key={seat} className="ct-seat-item empty">
                    {seat + 1}번 좌석 — 대기 중...
                  </li>
                );
              })}
            </ul>

            <p className="ct-waiting-hint">
              {filled}/{CT_MAX_PLAYERS}명
              {needMore > 0
                ? ` · 시작까지 ${needMore}명 더 필요합니다`
                : ' · 호스트가 시작할 수 있습니다'}
            </p>

            <p className="ct-rule-hint">
              한 라운드는 <b>직업 선택 → 직업 호출</b> 두 단계입니다. 왕관을 가진
              사람부터 직업 카드를 한 장씩 골라 쥐고, 1번 암살자부터 8번 장군까지
              차례로 부릅니다. 자기 직업이 불리면 <b>① 금화 2 받기 또는 건물
              카드 2장 뽑아 1장 남기기</b>, <b>② 건물 건설</b>(건축가는 3채),
              <b>③ 직업 능력</b> 순으로 진행합니다. 누군가 {CT_CITY_GOAL}채를
              완성하면 그 라운드까지 하고 끝납니다.
            </p>

            <button
              type="button"
              className="ct-ghost-button ct-roles-toggle"
              onClick={() => setRolesOpen((v) => !v)}
              aria-expanded={rolesOpen}
            >
              {rolesOpen ? '▲ 직업 8종 접기' : '▼ 직업 8종 설명 보기'}
            </button>

            {rolesOpen && (
              <ul className="ct-role-legend">
                {CT_ROLES.map((r) => (
                  <li key={r} className="ct-role-legend-item">
                    <span className="ct-role-legend-head">
                      <span className="ct-role-legend-num">{r}</span>
                      <span className="ct-role-legend-name">
                        {CT_ROLE_ICON[r]} {CT_ROLE_NAME[r]}
                      </span>
                    </span>
                    <span className="ct-role-legend-desc">
                      {CT_ROLE_ABILITY[r]}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {isHost ? (
              <div className="ct-host-actions">
                <button
                  type="button"
                  className="ct-primary-button"
                  onClick={onStart}
                  disabled={filled < CT_MIN_PLAYERS}
                >
                  {filled < CT_MIN_PLAYERS
                    ? `${CT_MIN_PLAYERS}명 이상 모여야 합니다`
                    : '게임 시작'}
                </button>
                {filled < CT_BOT_FILL_TARGET && (
                  <button
                    type="button"
                    className="ct-ghost-button"
                    onClick={onFillBots}
                  >
                    🤖 봇으로 채우고 시작 ({CT_BOT_FILL_TARGET}인)
                  </button>
                )}
              </div>
            ) : (
              <p className="ct-waiting-hint">
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
