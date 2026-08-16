import type { SFGameState, SFWinner } from '../../types/skyfall';
import { SF_ROLE_LABEL } from '../../types/skyfall';
import './SkyfallGameOver.css';

interface SkyfallGameOverProps {
  // 마지막 스냅샷 (phase 'game_over' — 전원 역할 공개 상태)
  game: SFGameState;
  winner: SFWinner;
  onFindNewGame: () => void;
}

// 단판 승부 결과 오버레이. 재대결 없음 — "새 게임 찾기"만 제공한다.
export function SkyfallGameOver({
  game,
  winner,
  onFindNewGame,
}: SkyfallGameOverProps) {
  const myRole = game.yourRole;
  const myFaction = myRole === 'mafia' ? 'mafia' : 'citizen';
  const youWon = myRole !== '' && winner !== '' && myFaction === winner;

  const title =
    winner === 'mafia' ? '🔪 마피아 승리' : winner === 'citizen' ? '🕯️ 시민 승리' : '게임 종료';

  return (
    <div className="sf-game-over">
      <div className="sf-game-over-container">
        <h1 className={`sf-over-title ${winner}`}>{title}</h1>
        {myRole !== '' && (
          <p className={`sf-over-verdict ${youWon ? 'win' : 'lose'}`}>
            {youWon ? '🏆 당신의 진영이 이겼습니다' : '당신의 진영이 졌습니다'} ·{' '}
            {game.dayNo}일차 종료
          </p>
        )}

        <ul className="sf-over-roster">
          {game.players.map((p) => (
            <li key={p.seat} className={`sf-over-row ${p.alive ? '' : 'dead'}`}>
              <span className="sf-over-name">
                {p.alive ? '' : '💀 '}
                {p.name}
                {p.seat === game.yourSeat && ' (나)'}
                {p.bot && ' 🤖'}
              </span>
              {p.role !== '' && (
                <span className={`sf-over-role role-${p.role}`}>
                  {SF_ROLE_LABEL[p.role]}
                </span>
              )}
            </li>
          ))}
        </ul>

        <button
          type="button"
          className="sf-primary-button"
          onClick={onFindNewGame}
        >
          새 게임 찾기
        </button>
      </div>
    </div>
  );
}
