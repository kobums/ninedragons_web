import { useState } from 'react';
import type { BGGameState, BGRole } from '../../types/bang';
import {
  BG_BLUE_KINDS,
  BG_BOT_FILL_TARGET,
  BG_BROWN_KINDS,
  BG_CARD_INFO,
  BG_MAX_PLAYERS,
  BG_MIN_PLAYERS,
  BG_ROLES,
  BG_ROLE_GOAL,
  BG_ROLE_ICON,
  BG_ROLE_NAME,
  BG_ROLE_SETUP,
} from '../../types/bang';
import type { BGToast } from '../../hooks/useBangGameState';
import {
  RoomCodeBadge,
  RoomJoinControls,
  useRoomJoin,
} from '../RoomCodeControls';
import { loadNickname, saveNickname } from '../../utils/nickname';
import './BangWaitingRoom.css';

interface BangWaitingRoomProps {
  // 입장 전이면 null (hasJoined 가 false 일 수도 있다)
  game: BGGameState | null;
  hasJoined: boolean;
  toasts?: BGToast[];
  onJoin: (name: string, room: string) => void;
  onStart: () => void;
  onFillBots: () => void;
  onBack: () => void;
}

export function BangWaitingRoom({
  game,
  hasJoined,
  toasts = [],
  onJoin,
  onStart,
  onFillBots,
  onBack,
}: BangWaitingRoomProps) {
  const [name, setName] = useState(loadNickname);
  // 연타로 join 이 두 번 나가는 것을 막는다
  const [joining, setJoining] = useState(false);
  // 카드 22종 설명은 길어서 접어 둔다 (280px 에서도 화면이 무너지지 않게)
  const [cardsOpen, setCardsOpen] = useState(false);
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
    ? Array.from({ length: BG_MAX_PLAYERS }).filter((_, i) => seatOf(i)).length
    : 0;
  const hostSeat = game?.hostSeat ?? 0;
  const isHost = game !== null && game.yourSeat === hostSeat;
  const needMore = Math.max(0, BG_MIN_PLAYERS - filled);
  const setup = BG_ROLE_SETUP[filled] ?? '';

  return (
    <div className="bg-waiting">
      {toasts.length > 0 && (
        <div className="bg-waiting-toasts">
          {toasts.map((t) => (
            <div key={t.id} className="bg-waiting-toast">
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
      <div className="bg-waiting-container">
        <h1 className="bg-title">뱅!</h1>
        <p className="bg-subtitle">
          🤠 정체를 숨기고 사거리 안의 상대를 쏘세요 · 4~7인
        </p>

        {/* 역할 4종 — 색 + 아이콘 + 한글 이름 + 목표 */}
        <ul className="bg-role-legend">
          {BG_ROLES.map((r: BGRole) => (
            <li key={r} className={`bg-role-legend-item side-${r}`}>
              <span className="bg-role-legend-head">
                <span className={`bg-role-legend-name r-${r}`}>
                  {BG_ROLE_ICON[r]} {BG_ROLE_NAME[r]}
                </span>
              </span>
              <span className="bg-role-legend-desc">{BG_ROLE_GOAL[r]}</span>
            </li>
          ))}
        </ul>

        {!hasJoined ? (
          <form onSubmit={handleSubmit} className="bg-join-form">
            <div className="bg-form-group">
              <label htmlFor="bgPlayerName">플레이어 이름</label>
              <input
                type="text"
                id="bgPlayerName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="이름을 입력하세요"
                maxLength={20}
                required
              />
            </div>
            <RoomJoinControls join={roomJoin} tone="dark" idPrefix="bg" />
            <button
              type="submit"
              className="bg-primary-button"
              disabled={joining || !roomJoin.roomReady}
            >
              {joining ? '입장 중...' : '입장하기'}
            </button>
            <button type="button" className="bg-ghost-button" onClick={onBack}>
              게임 선택으로
            </button>
          </form>
        ) : !game ? (
          <p className="bg-waiting-hint">입장 중...</p>
        ) : (
          <div className="bg-seat-list-wrap">
            <RoomCodeBadge code={game.roomCode} tone="dark" />
            <ul className="bg-seat-list">
              {Array.from({ length: BG_MAX_PLAYERS }).map((_, seat) => {
                const p = seatOf(seat);
                return p ? (
                  <li key={seat} className="bg-seat-item">
                    <span className="bg-seat-item-name">
                      {seat === hostSeat && <span className="bg-star">⭐</span>}
                      {p.name}
                      {p.bot && ' 🤖'}
                      {seat === game.yourSeat && ' (나)'}
                    </span>
                    <span className={`bg-dot ${p.connected ? 'on' : 'off'}`} />
                  </li>
                ) : (
                  <li key={seat} className="bg-seat-item empty">
                    {seat + 1}번 좌석 — 대기 중...
                  </li>
                );
              })}
            </ul>

            <p className="bg-waiting-hint">
              {filled}/{BG_MAX_PLAYERS}명
              {needMore > 0
                ? ` · 시작까지 ${needMore}명 더 필요합니다`
                : ' · 호스트가 시작할 수 있습니다'}
              {setup && ` · 지금 인원 구성: ${setup}`}
            </p>

            <p className="bg-rule-hint">
              한 차례는 <b>① 다이너마이트·감옥 판정 → ② 카드 2장 뽑기 → ③ 카드
              사용 → ④ 손패를 체력 수만큼으로 줄이기</b> 순서입니다.{' '}
              <b>거리</b>가 핵심입니다 — 원탁에서 양방향 중 짧은 쪽이 기본
              거리이고(탈락자는 자리에서 빠집니다), 상대의 야생마는 +1, 내
              조준경은 −1 입니다. 무기 사거리 안이어야 <b>뱅!</b>을 쏠 수
              있고(기본 사거리 1), 한 차례에 뱅!은 1장만(볼캐닉은 무제한)
              냅니다.
            </p>

            <p className="bg-rule-hint">
              술통·감옥·다이너마이트는 덱 맨 위를 <b>뒤집어</b> 무늬(♠♥♦♣)와
              숫자로 판정합니다. 그래서 모든 카드에 무늬와 숫자가 함께
              표시됩니다.
            </p>

            <button
              type="button"
              className="bg-ghost-button bg-cards-toggle"
              onClick={() => setCardsOpen((v) => !v)}
              aria-expanded={cardsOpen}
            >
              {cardsOpen ? '▲ 카드 목록 접기' : '▼ 카드 22종 설명 보기'}
            </button>

            {cardsOpen && (
              <div className="bg-card-legend">
                <p className="bg-card-legend-head">갈색 — 즉시 사용</p>
                <ul className="bg-card-legend-list">
                  {BG_BROWN_KINDS.map((k) => (
                    <li key={k} className="bg-card-legend-item c-brown">
                      <span className="bg-card-legend-name">
                        {BG_CARD_INFO[k].icon} {BG_CARD_INFO[k].name}
                        <span className="bg-card-legend-count">
                          {BG_CARD_INFO[k].count}장
                        </span>
                      </span>
                      <span className="bg-card-legend-desc">
                        {BG_CARD_INFO[k].desc}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="bg-card-legend-head">파란색 — 장비</p>
                <ul className="bg-card-legend-list">
                  {BG_BLUE_KINDS.map((k) => (
                    <li key={k} className="bg-card-legend-item c-blue">
                      <span className="bg-card-legend-name">
                        {BG_CARD_INFO[k].icon} {BG_CARD_INFO[k].name}
                        <span className="bg-card-legend-count">
                          {BG_CARD_INFO[k].count}장
                        </span>
                      </span>
                      <span className="bg-card-legend-desc">
                        {BG_CARD_INFO[k].desc}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {isHost ? (
              <div className="bg-host-actions">
                <button
                  type="button"
                  className="bg-primary-button"
                  onClick={onStart}
                  disabled={filled < BG_MIN_PLAYERS}
                >
                  {filled < BG_MIN_PLAYERS
                    ? `${BG_MIN_PLAYERS}명 이상 모여야 합니다`
                    : '게임 시작'}
                </button>
                {filled < BG_BOT_FILL_TARGET && (
                  <button
                    type="button"
                    className="bg-ghost-button"
                    onClick={onFillBots}
                  >
                    🤖 봇으로 채우고 시작 ({BG_BOT_FILL_TARGET}인)
                  </button>
                )}
              </div>
            ) : (
              <p className="bg-waiting-hint">
                ⭐ {seatOf(hostSeat)?.name ?? '호스트'}님이 시작 버튼을 누르면
                게임이 시작됩니다
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
