import { useState } from 'react';
import type { CNGameState, CNPlayerView, CNTeam } from '../../types/codenames';
import {
  CN_BOT_FILL_TARGET,
  CN_MAX_PLAYERS,
  CN_MIN_PLAYERS,
  CN_TEAM_LABEL,
  CN_TEAM_MARK,
  cnPreviewTeams,
} from '../../types/codenames';
import type { CNToast } from '../../hooks/useCodenamesGameState';
import {
  RoomCodeBadge,
  RoomJoinControls,
  useRoomJoin,
} from '../RoomCodeControls';
import { loadNickname, saveNickname } from '../../utils/nickname';
import './CodenamesWaitingRoom.css';

interface CodenamesWaitingRoomProps {
  // 입장 전이면 null (hasJoined 가 false 일 수도 있다)
  game: CNGameState | null;
  hasJoined: boolean;
  toasts?: CNToast[];
  onJoin: (name: string, room: string) => void;
  onStart: () => void;
  onFillBots: () => void;
  onBack: () => void;
}

export function CodenamesWaitingRoom({
  game,
  hasJoined,
  toasts = [],
  onJoin,
  onStart,
  onFillBots,
  onBack,
}: CodenamesWaitingRoomProps) {
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

  const players = game?.players ?? [];
  const filled = players.length;
  const hostSeat = game?.hostSeat ?? 0;
  const isHost = game !== null && game.yourSeat === hostSeat;
  const needMore = Math.max(0, CN_MIN_PLAYERS - filled);
  // 팀·역할 미리보기 — 실제 배정은 서버가 시작 시 확정한다
  const preview = cnPreviewTeams(players);

  const renderTeam = (team: CNTeam, members: CNPlayerView[]) => {
    const spymasterSeat = preview.spymasterSeat(members);
    return (
      <div className={`cn-team-panel ${team}`}>
        <h2 className="cn-team-panel-title">
          {CN_TEAM_MARK[team]} {CN_TEAM_LABEL[team]}
        </h2>
        {members.length === 0 ? (
          <p className="cn-team-empty">입장을 기다리는 중...</p>
        ) : (
          <ul className="cn-team-list">
            {members.map((p) => (
              <li key={p.seat} className="cn-team-member">
                <span className="cn-member-name">
                  {p.seat === hostSeat && <span className="cn-crown">👑</span>}
                  {p.name}
                  {p.bot && ' 🤖'}
                  {p.seat === game?.yourSeat && ' (나)'}
                </span>
                <span className="cn-member-side">
                  <span
                    className={`cn-role-chip ${p.seat === spymasterSeat ? 'spymaster' : ''}`}
                  >
                    {p.seat === spymasterSeat ? '🕵️ 스파이마스터' : '요원'}
                  </span>
                  <span className={`cn-dot ${p.connected ? 'on' : 'off'}`} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };

  return (
    <div className="cn-waiting">
      {toasts.length > 0 && (
        <div className="cn-toasts">
          {toasts.map((t) => (
            <div key={t.id} className="cn-toast">
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
      <div className="cn-waiting-container">
        <h1 className="cn-title">코드네임</h1>
        <p className="cn-subtitle">팀 대항 단어 추리 · 4~8인 (짝수 권장)</p>

        {!hasJoined ? (
          <form onSubmit={handleSubmit} className="cn-join-form">
            <div className="cn-form-group">
              <label htmlFor="cnPlayerName">플레이어 이름</label>
              <input
                type="text"
                id="cnPlayerName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="이름을 입력하세요"
                maxLength={20}
                required
              />
            </div>
            <RoomJoinControls join={roomJoin} tone="dark" idPrefix="cn" />
            <button
              type="submit"
              className="cn-primary-button"
              disabled={joining || !roomJoin.roomReady}
            >
              {joining ? '입장 중...' : '입장하기'}
            </button>
            <button type="button" className="cn-ghost-button" onClick={onBack}>
              게임 선택으로
            </button>
          </form>
        ) : !game ? (
          <p className="cn-waiting-hint">입장 중...</p>
        ) : (
          <div className="cn-lobby">
            <RoomCodeBadge code={game.roomCode} tone="dark" />

            <div className="cn-team-preview">
              {renderTeam('red', preview.red)}
              {renderTeam('blue', preview.blue)}
            </div>
            <p className="cn-preview-note">
              입장 순서대로 적·청 번갈아 배정 — 팀의 첫 사람이 스파이마스터가
              됩니다
            </p>

            <p className="cn-waiting-hint">
              {filled}/{CN_MAX_PLAYERS}명
              {needMore > 0
                ? ` · 시작까지 ${needMore}명 더 필요합니다`
                : ' · 호스트가 시작할 수 있습니다'}
            </p>

            {isHost ? (
              <div className="cn-host-actions">
                <button
                  type="button"
                  className="cn-primary-button"
                  onClick={onStart}
                  disabled={filled < CN_MIN_PLAYERS}
                >
                  게임 시작
                </button>
                {filled < CN_BOT_FILL_TARGET && (
                  <button
                    type="button"
                    className="cn-ghost-button"
                    onClick={onFillBots}
                  >
                    🤖 봇으로 채우기 ({CN_BOT_FILL_TARGET}인)
                  </button>
                )}
              </div>
            ) : (
              <p className="cn-waiting-hint">
                👑 {players.find((p) => p.seat === hostSeat)?.name ?? '호스트'}
                님이 시작을 결정합니다
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
