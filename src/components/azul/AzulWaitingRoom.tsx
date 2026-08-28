import { useState } from 'react';
import type { AZGameState } from '../../types/azul';
import {
  AZ_BOT_FILL_TARGET,
  AZ_COLORS,
  AZ_COLOR_LABEL,
  AZ_MAX_PLAYERS,
  AZ_MIN_PLAYERS,
} from '../../types/azul';
import type { AZToast } from '../../hooks/useAzulGameState';
import { AzTile } from './AzulBoard';
import {
  RoomCodeBadge,
  RoomJoinControls,
  useRoomJoin,
} from '../RoomCodeControls';
import { loadNickname, saveNickname } from '../../utils/nickname';
import './AzulWaitingRoom.css';

interface AzulWaitingRoomProps {
  // 입장 전이면 null (hasJoined 가 false 일 수도 있다)
  game: AZGameState | null;
  hasJoined: boolean;
  toasts?: AZToast[];
  onJoin: (name: string, room: string) => void;
  onStart: () => void;
  onFillBots: () => void;
  onBack: () => void;
}

export function AzulWaitingRoom({
  game,
  hasJoined,
  toasts = [],
  onJoin,
  onStart,
  onFillBots,
  onBack,
}: AzulWaitingRoomProps) {
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
    ? Array.from({ length: AZ_MAX_PLAYERS }).filter((_, i) => seatOf(i)).length
    : 0;
  const hostSeat = game?.hostSeat ?? 0;
  const isHost = game !== null && game.yourSeat === hostSeat;

  return (
    <div className="az-scope az-waiting">
      {toasts.length > 0 && (
        <div className="az-waiting-toasts">
          {toasts.map((t) => (
            <div key={t.id} className="az-waiting-toast">
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
      <div className="az-waiting-container">
        <h1 className="az-title">아줄</h1>
        <p className="az-subtitle">
          🔷 타일을 골라 벽을 채우는 아줄레주 장식 · {AZ_MIN_PLAYERS}~
          {AZ_MAX_PLAYERS}인
        </p>

        {!hasJoined ? (
          <form onSubmit={handleSubmit} className="az-join-form">
            <div className="az-form-group">
              <label htmlFor="azPlayerName">플레이어 이름</label>
              <input
                type="text"
                id="azPlayerName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="이름을 입력하세요"
                maxLength={20}
                required
              />
            </div>
            <RoomJoinControls join={roomJoin} idPrefix="az" />
            <button
              type="submit"
              className="az-primary-button"
              disabled={joining || !roomJoin.roomReady}
            >
              {joining ? '입장 중...' : '입장하기'}
            </button>
            <button type="button" className="az-ghost-button" onClick={onBack}>
              게임 선택으로
            </button>
          </form>
        ) : !game ? (
          <p className="az-waiting-hint">입장 중...</p>
        ) : (
          <div className="az-seat-list-wrap">
            <RoomCodeBadge code={game.roomCode} />

            {/* 규칙 요약 — 라운드 3단계와 "바닥 라인" 감점을 먼저 못 박는다 */}
            <div className="az-rule-card">
              <p className="az-rule-line">
                라운드는 <strong>공장 수주 → 벽 타일 붙이기 → 라운드 준비</strong>
                 순서로 돕니다
              </p>
              <p className="az-rule-line muted">
                차례에 <strong>진열대</strong> 하나에서 같은 색을 전부 가져오거나
                (나머지는 <strong>중앙</strong>으로) <strong>중앙</strong>에서
                같은 색을 전부 가져와 <strong>패턴 라인</strong> 한 줄에 놓습니다.
              </p>
              <p className="az-rule-line muted">
                줄이 넘치면 넘친 만큼 <strong>바닥 라인</strong>으로 가고 감점입니다
                (−1 −1 −2 −2 −2 −3 −3). 중앙에서 처음 가져간 사람은
                <strong> 선 플레이어 마커</strong>를 함께 받습니다.
              </p>
              <p className="az-rule-line muted">
                꽉 찬 패턴 라인은 <strong>벽</strong>으로 올라가 인접 타일만큼
                점수가 됩니다. 벽의 가로줄 하나가 완성되면 그 라운드로 끝나고,
                가로줄 2점 · 세로줄 7점 · 같은 색 5장 10점을 더합니다.
              </p>
            </div>

            {/* 색 범례 — 색약 대비로 색마다 무늬 기호가 다르다 */}
            <div className="az-legend">
              {AZ_COLORS.map((color) => (
                <span key={color} className="az-legend-item">
                  <AzTile tile={color} size="sm" />
                  <span className="az-legend-label">
                    {AZ_COLOR_LABEL[color]}
                  </span>
                </span>
              ))}
            </div>

            <ul className="az-seat-list">
              {Array.from({ length: AZ_MAX_PLAYERS }).map((_, seat) => {
                const p = seatOf(seat);
                return p ? (
                  <li key={seat} className="az-seat-item">
                    <span className="az-seat-item-name">
                      {seat === hostSeat && <span className="az-crown">👑</span>}
                      {p.name}
                      {p.bot && ' 🤖'}
                      {seat === game.yourSeat && ' (나)'}
                    </span>
                    <span className={`az-dot ${p.connected ? 'on' : 'off'}`} />
                  </li>
                ) : (
                  <li key={seat} className="az-seat-item empty">
                    {seat + 1}번 좌석 — 대기 중...
                  </li>
                );
              })}
            </ul>

            <p className="az-waiting-hint">
              {filled}/{AZ_MAX_PLAYERS}명
              {filled < AZ_MIN_PLAYERS
                ? ` · ${AZ_MIN_PLAYERS}명부터 시작할 수 있습니다`
                : ' · 시작할 수 있습니다'}
            </p>

            {isHost ? (
              <div className="az-host-actions">
                <button
                  type="button"
                  className="az-primary-button"
                  onClick={onStart}
                  disabled={filled < AZ_MIN_PLAYERS}
                >
                  게임 시작
                </button>
                {filled < AZ_BOT_FILL_TARGET && (
                  <button
                    type="button"
                    className="az-ghost-button"
                    onClick={onFillBots}
                  >
                    🤖 봇으로 {AZ_BOT_FILL_TARGET}명 채우고 시작
                  </button>
                )}
              </div>
            ) : (
              <p className="az-waiting-hint">
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
