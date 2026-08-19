import type {
  TichuGameOver as TichuGameOverPayload,
  TichuGameState,
  TichuPlayer,
} from '../../types/tichu';
import { teamOfSeat } from '../../types/tichu';
import './TichuGameOver.css';

interface TichuGameOverProps {
  // 마지막 스냅샷 (phase: 'game_over') — 최종 점수·승리 팀의 1차 출처
  game: TichuGameState | null;
  // tc_game_over payload (있으면 보조 출처)
  gameOver: TichuGameOverPayload | null;
  onNewGame: () => void;
}

export function TichuGameOver({ game, gameOver, onNewGame }: TichuGameOverProps) {
  const winnerTeam = game?.winnerTeam || gameOver?.winnerTeam || '';
  const scores = game?.scores ?? gameOver?.scores ?? null;
  const players: TichuPlayer[] = game?.players ?? gameOver?.players ?? [];

  const teamNames = (team: '02' | '13') =>
    players
      .filter((p) => teamOfSeat(p.seat) === team)
      .map((p) => p.name)
      .join(' · ');

  // 관전(yourSeat -1)이면 어느 팀도 아니다 — '우리 팀' 강조 없음
  const myTeam =
    game && game.yourSeat >= 0 ? teamOfSeat(game.yourSeat) : null;
  const iWon = myTeam !== null && winnerTeam !== '' && myTeam === winnerTeam;

  return (
    <div className="tc-game-over">
      <div className="tc-game-over-panel">
        <h1 className="tc-game-over-title">
          {myTeam === null || winnerTeam === ''
            ? '게임 종료'
            : iWon
              ? '승리!'
              : '패배'}
        </h1>

        {winnerTeam !== '' && (
          <p className="tc-game-over-winner">
            <span
              className={`tc-game-over-team ${
                winnerTeam === '02' ? 'team02' : 'team13'
              }`}
            >
              {winnerTeam === '02' ? '0·2 팀' : '1·3 팀'}
            </span>{' '}
            {teamNames(winnerTeam) && `(${teamNames(winnerTeam)}) `}승리
          </p>
        )}

        {scores && (
          <div className="tc-final-scores">
            <div
              className={`tc-final-score team02 ${
                winnerTeam === '02' ? 'winner' : ''
              }`}
            >
              <span className="tc-final-team">0·2 팀</span>
              {teamNames('02') && (
                <span className="tc-final-names">{teamNames('02')}</span>
              )}
              <strong>{scores.team02}</strong>
            </div>
            <div
              className={`tc-final-score team13 ${
                winnerTeam === '13' ? 'winner' : ''
              }`}
            >
              <span className="tc-final-team">1·3 팀</span>
              {teamNames('13') && (
                <span className="tc-final-names">{teamNames('13')}</span>
              )}
              <strong>{scores.team13}</strong>
            </div>
          </div>
        )}

        <button type="button" className="tc-new-game-button" onClick={onNewGame}>
          새 게임 찾기
        </button>
      </div>
    </div>
  );
}
