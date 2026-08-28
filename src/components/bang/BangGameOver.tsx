import type {
  BGGameOverPayload,
  BGGameState,
  BGPlayerView,
  BGRole,
} from '../../types/bang';
import {
  BG_ROLES,
  BG_ROLE_GOAL,
  BG_ROLE_ICON,
  BG_ROLE_NAME,
  BG_WINNER_LABEL,
  bgCardInfo,
  bgCardLabel,
  bgCardName,
  bgRoleIcon,
  bgRoleName,
  bgSuitIsRed,
  bgCardFace,
} from '../../types/bang';
import './BangGameOver.css';

interface BangGameOverProps {
  // 마지막 스냅샷 (phase 'game_over')
  game: BGGameState;
  // bg_game_over 페이로드 — 신호+승자 보조 (없으면 스냅샷 result 로 그린다)
  result: BGGameOverPayload | null;
  // 사설 방 코드 — 있으면 같은 방 재대결 버튼을 보여준다 (공용 로비는 ''/생략)
  roomCode?: string;
  onFindNewGame: () => void;
}

// 살아남은 사람 먼저, 그다음 좌석 순 (원탁 순서를 유지한다)
function rank(a: BGPlayerView, b: BGPlayerView): number {
  if (a.alive !== b.alive) return a.alive ? -1 : 1;
  return a.seat - b.seat;
}

export function BangGameOver({
  game,
  result,
  roomCode,
  onFindNewGame,
}: BangGameOverProps) {
  const players = [...(game.players ?? [])].sort(rank);
  const snap = game.result ?? null;
  const winner = snap?.winner ?? result?.winner ?? '';
  const winnerSeats = snap?.winnerSeats ?? result?.winnerSeats ?? [];
  const winnerNames = snap?.winnerNames ?? result?.winnerNames ?? [];
  const message = snap?.message ?? result?.message ?? '';

  const isWinner = (seat: number) => winnerSeats.includes(seat);
  const youWon = game.yourSeat >= 0 && isWinner(game.yourSeat);
  const isSpectator = game.yourSeat < 0;

  const title =
    BG_WINNER_LABEL[winner] ??
    (winnerNames.length > 0 ? `🏆 ${winnerNames.join(' · ')} 승리` : '게임 종료');

  // 종료 시점의 진영별 생존 수 — 왜 그 진영이 이겼는지 한 줄로 읽힌다
  const countOf = (role: BGRole) =>
    players.filter((p) => p.role === role).length;
  const aliveOf = (role: BGRole) =>
    players.filter((p) => p.role === role && p.alive).length;

  return (
    <div className="bg-game-over">
      <div className="bg-game-over-container">
        <span className="bg-over-mark">🤠</span>
        <h1 className="bg-over-title">{title}</h1>
        <p className="bg-over-sub">
          {message ||
            '보안관이 쓰러지면 마지막 1인이 배신자일 때 배신자가, 아니면 무법자가 이깁니다'}
        </p>
        {!isSpectator && winnerSeats.length > 0 && (
          <p className={`bg-over-verdict ${youWon ? 'win' : 'lose'}`}>
            {youWon ? '🏆 당신이 이겼습니다' : '당신이 졌습니다'}
          </p>
        )}
        {!isSpectator && game.yourRole && (
          <p className="bg-over-myrole">
            내 역할은 <b className={`r-${game.yourRole}`}>
              {bgRoleIcon(game.yourRole)} {bgRoleName(game.yourRole)}
            </b>{' '}
            였습니다 — {BG_ROLE_GOAL[game.yourRole as BGRole] ?? ''}
          </p>
        )}

        {/* 진영 요약 */}
        <div className="bg-over-sides">
          {BG_ROLES.map((r) => {
            const total = countOf(r);
            if (total === 0) return null;
            return (
              <span key={r} className={`bg-over-side r-${r}`}>
                {BG_ROLE_ICON[r]} {BG_ROLE_NAME[r]} {aliveOf(r)}/{total} 생존
              </span>
            );
          })}
        </div>

        {/* 전원 역할 공개 */}
        <div className="bg-over-list">
          {players.map((p) => (
            <div
              key={p.seat}
              className={[
                'bg-over-row',
                isWinner(p.seat) ? 'winner' : '',
                !p.alive ? 'dead' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <span className="bg-over-row-head">
                <span className="bg-over-row-name">
                  {p.name}
                  {p.seat === game.yourSeat && ' (나)'}
                  {p.bot && ' 🤖'}
                </span>
                <span className={`bg-over-row-role r-${p.role ?? ''}`}>
                  {p.role
                    ? `${bgRoleIcon(p.role)} ${bgRoleName(p.role)}`
                    : '🎴 역할 비공개'}
                </span>
              </span>
              <span className="bg-over-row-stats">
                {p.alive ? `❤ 체력 ${p.hp}/${p.maxHp} · 생존` : '💀 탈락'}
                {isWinner(p.seat) && ' · 🏆 승리'}
              </span>
              <span className="bg-over-row-equip">
                {(p.equipment ?? []).map((card) => (
                  <span
                    key={card.id}
                    className={`bg-over-card c-${bgCardInfo(card.kind).color}`}
                    title={bgCardLabel(card)}
                  >
                    <span
                      className={`bg-over-face ${
                        bgSuitIsRed(card.suit) ? 'red' : 'black'
                      }`}
                    >
                      {bgCardFace(card)}
                    </span>
                    {bgCardInfo(card.kind).icon} {bgCardName(card.kind)}
                  </span>
                ))}
              </span>
            </div>
          ))}
        </div>

        <p className="bg-over-legend">
          ⭐ 보안관·부관은 무법자와 배신자를 모두 없애야 이깁니다 · 🐺 무법자는
          보안관을 쓰러뜨리면 이깁니다 · 🃏 배신자는 마지막까지 혼자 살아남아야
          이깁니다
        </p>

        {roomCode && (
          // 전체 리로드 + ?room 프리필 — 같은 코드로 다시 join 하면 관대한
          // 생성으로 같은 코드의 새 대기실이 열린다 (기존 흐름 재사용)
          <button
            type="button"
            className="bg-primary-button"
            onClick={() => {
              window.location.href = `${window.location.pathname}?room=${roomCode}`;
            }}
          >
            🔄 같은 방에서 재대결
          </button>
        )}
        <button
          type="button"
          className="bg-primary-button"
          onClick={onFindNewGame}
        >
          새 게임 찾기
        </button>
      </div>
    </div>
  );
}
