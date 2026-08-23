import type {
  RFFaction,
  RFGameOverPayload,
  RFGameState,
} from '../../types/reformation';
import { RF_FACTIONS, RF_ROLES, rfFactionMeta } from '../../types/reformation';
import './ReformationGameOver.css';

interface ReformationGameOverProps {
  // 마지막 스냅샷 (phase 'game_over')
  game: RFGameState;
  // rf_game_over 페이로드 — 승자 보조 (없으면 스냅샷 result 나 생존자로 유도)
  gameOver: RFGameOverPayload | null;
  // 사설 방 코드 — 있으면 같은 방 재대결 버튼을 보여준다 (공용 로비는 ''/생략)
  roomCode?: string;
  onFindNewGame: () => void;
}

// 승부 결과 오버레이 — 진영 승리(여러 명 동시)와 최후 1인 승리를 모두 그린다.
export function ReformationGameOver({
  game,
  gameOver,
  roomCode,
  onFindNewGame,
}: ReformationGameOverProps) {
  const players = game.players ?? [];
  // 스냅샷 result 우선, 없으면 game_over 페이로드
  const result = game.result ?? gameOver ?? null;
  const survivors = players.filter((p) => p.alive);

  // 진영 승리 판정 — 서버 result.winner 우선, 없으면 생존자 진영으로 유도
  const declared = result?.winner;
  const derivedFaction: RFFaction | null =
    survivors.length > 1 &&
    survivors.every((p) => p.faction === survivors[0].faction)
      ? survivors[0].faction
      : null;
  const winnerFaction: RFFaction | null =
    declared === 'loyalist' || declared === 'reformist'
      ? declared
      : declared === 'seat'
        ? null
        : derivedFaction;
  const factionMeta = winnerFaction ? RF_FACTIONS[winnerFaction] : null;

  // 승자 좌석: 페이로드 → 진영 생존자 → 최후 생존자 순으로 유도
  const winnerSeats =
    result?.winnerSeats && result.winnerSeats.length > 0
      ? result.winnerSeats
      : winnerFaction
        ? players
            .filter((p) => p.alive && p.faction === winnerFaction)
            .map((p) => p.seat)
        : survivors.map((p) => p.seat);

  const winners = players.filter((p) => winnerSeats.includes(p.seat));
  const winnerNames =
    result?.winnerNames && result.winnerNames.length > 0
      ? result.winnerNames
      : winners.map((w) => w.name);

  const isSpectator = game.yourSeat < 0;
  const youWon = !isSpectator && winnerSeats.includes(game.yourSeat);
  const soloWin = !winnerFaction && winnerSeats.length === 1;

  // 생존 → 남은 카드 → 칩 순으로 정렬한 최종 순위표
  const roster = [...players].sort(
    (a, b) =>
      Number(b.alive) - Number(a.alive) ||
      b.cardCount - a.cardCount ||
      b.coins - a.coins,
  );

  const title = factionMeta
    ? `${factionMeta.icon} ${factionMeta.name} 진영 승리`
    : winnerNames.length > 0
      ? `${winnerNames.join(', ')} 승리`
      : '게임 종료';

  const verdict = youWon
    ? factionMeta
      ? `${factionMeta.icon} ${factionMeta.name}가 궁정을 장악했습니다 — 진영 전원 승리`
      : '👑 최후의 1인으로 살아남았습니다'
    : (result?.message ?? '다음 개혁에서 설욕하세요');

  return (
    <div className="rf-game-over">
      <div className="rf-game-over-container">
        <span className="rf-over-icon">
          {factionMeta ? factionMeta.icon : youWon ? '👑' : '⚖️'}
        </span>
        <h1 className="rf-over-title">{title}</h1>

        {/* 승리 형태를 명시 — 진영 동시 승리 / 최후 1인 */}
        <p
          className={`rf-over-mode ${winnerFaction ? `f-${winnerFaction}` : 'solo'}`}
        >
          {factionMeta
            ? `살아남은 전원이 ${factionMeta.name} — ${winnerNames.length}명 동시 승리`
            : soloWin
              ? '최후의 1인 승리'
              : '게임 종료'}
        </p>

        {winnerNames.length > 0 && (
          <p className="rf-over-winners">🏆 {winnerNames.join(' · ')}</p>
        )}

        {!isSpectator && (
          <p className={`rf-over-verdict ${youWon ? 'win' : 'lose'}`}>
            {verdict}
          </p>
        )}

        {result?.message && youWon && (
          <p className="rf-over-note">{result.message}</p>
        )}

        <ul className="rf-over-roster">
          {roster.map((p, i) => {
            const lostRoles = p.lostRoles ?? [];
            const meta = rfFactionMeta(p.faction);
            return (
              <li
                key={p.seat}
                className={[
                  'rf-over-row',
                  `f-${p.faction}`,
                  p.alive ? '' : 'dead',
                  winnerSeats.includes(p.seat) ? 'winner' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <span className="rf-over-name">
                  <span className="rf-over-rank">{i + 1}위</span>
                  {winnerSeats.includes(p.seat) ? '👑 ' : p.alive ? '' : '☠️ '}
                  {p.name}
                  {p.seat === game.yourSeat && ' (나)'}
                  {p.bot && ' 🤖'}
                </span>
                <span className="rf-over-info">
                  {meta && (
                    <span className={`rf-faction ${p.faction}`}>
                      <span aria-hidden="true">{meta.icon}</span>
                      {meta.short}
                    </span>
                  )}
                  {lostRoles.length > 0 && (
                    <span className="rf-over-lost">
                      {lostRoles.map((r) => RF_ROLES[r]?.name ?? r).join('·')}
                    </span>
                  )}
                  <span className="rf-over-coins">🪙 {p.coins}</span>
                </span>
              </li>
            );
          })}
        </ul>

        {roomCode && (
          // 전체 리로드 + ?room 프리필 — 같은 코드로 다시 join 하면 관대한
          // 생성으로 같은 코드의 새 대기실이 열린다 (다인 게임 공통 흐름)
          <button
            type="button"
            className="rf-primary-button"
            onClick={() => {
              window.location.href = `${window.location.pathname}?room=${roomCode}`;
            }}
          >
            🔄 같은 방에서 재대결
          </button>
        )}
        <button
          type="button"
          className="rf-primary-button"
          onClick={onFindNewGame}
        >
          새 게임 찾기
        </button>
      </div>
    </div>
  );
}
