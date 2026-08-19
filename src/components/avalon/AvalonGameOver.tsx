import type { AVGameState, AVWinner } from '../../types/avalon';
import { AV_ROLE_LABEL, isEvilRole } from '../../types/avalon';
import './AvalonGameOver.css';

interface AvalonGameOverProps {
  // 마지막 스냅샷 (phase 'game_over' — 전원 역할 공개 상태)
  game: AVGameState;
  winner: AVWinner;
  // 서버가 실어준 승리 사유 (없으면 스냅샷에서 유추)
  reason?: string;
  onFindNewGame: () => void;
}

// 스냅샷에서 승리 사유를 유추 — 서버 reason 이 있으면 그쪽이 우선
function deriveReason(game: AVGameState, winner: AVWinner): string {
  const evilWins = game.results.filter((r) => r === 'evil').length;
  if (winner === 'evil') {
    if (game.assassinTarget >= 0 && evilWins < 3) return '멀린 암살 성공';
    if (evilWins >= 3) return '원정 3회 실패';
    return '원정대 5회 연속 부결';
  }
  if (winner === 'good') {
    return game.assassinTarget >= 0 ? '원정 3승 · 암살 실패' : '원정 3회 성공';
  }
  return '';
}

// 단판 승부 결과 오버레이. 재대결 없음 — "새 게임 찾기"만 제공한다.
export function AvalonGameOver({
  game,
  winner,
  reason,
  onFindNewGame,
}: AvalonGameOverProps) {
  const myRole = game.yourRole;
  const myFaction = isEvilRole(myRole) ? 'evil' : 'good';
  const youWon = myRole !== '' && winner !== '' && myFaction === winner;
  const why = reason || deriveReason(game, winner);

  const title =
    winner === 'good'
      ? '🛡️ 선의 세력 승리'
      : winner === 'evil'
        ? '🌑 악의 세력 승리'
        : '게임 종료';

  return (
    <div className="av-game-over">
      <div className="av-game-over-container">
        <h1 className={`av-over-title ${winner}`}>{title}</h1>
        {why && <p className="av-over-reason">{why}</p>}
        {myRole !== '' && (
          <p className={`av-over-verdict ${youWon ? 'win' : 'lose'}`}>
            {youWon ? '🏆 당신의 진영이 이겼습니다' : '당신의 진영이 졌습니다'}
          </p>
        )}

        {/* 원정 결과 미니 트랙 */}
        <div className="av-over-track">
          {game.questSizes.map((size, i) => {
            const result = game.results[i];
            return (
              <span
                key={i}
                className={`av-over-circle ${result ?? 'unplayed'}`}
              >
                {result === 'good' ? '✓' : result === 'evil' ? '✕' : size}
              </span>
            );
          })}
        </div>

        <ul className="av-over-roster">
          {game.players.map((p) => (
            <li key={p.seat} className="av-over-row">
              <span className="av-over-name">
                {p.name}
                {p.seat === game.yourSeat && ' (나)'}
                {p.bot && ' 🤖'}
                {p.seat === game.assassinTarget && (
                  <span className="av-over-target">🗡️ 암살 대상</span>
                )}
              </span>
              {p.role !== '' && (
                <span
                  className={`av-over-role role-${p.role} ${
                    isEvilRole(p.role) ? 'evil' : 'good'
                  }`}
                >
                  {AV_ROLE_LABEL[p.role]}
                </span>
              )}
            </li>
          ))}
        </ul>

        <button
          type="button"
          className="av-primary-button"
          onClick={onFindNewGame}
        >
          새 게임 찾기
        </button>
      </div>
    </div>
  );
}
