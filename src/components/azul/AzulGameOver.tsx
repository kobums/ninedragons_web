import type {
  AZGameOverPayload,
  AZGameState,
  AZPlayerView,
} from '../../types/azul';
import {
  AZ_BONUS_COL,
  AZ_BONUS_COLOR,
  AZ_BONUS_ROW,
  azBonusBreakdown,
  azWall,
} from '../../types/azul';
import { AzWallGrid } from './AzulBoard';
import './AzulGameOver.css';

interface AzulGameOverProps {
  // 마지막 스냅샷 (phase 'game_over' — 아줄은 처음부터 전부 공개였다)
  game: AZGameState;
  // az_game_over 페이로드 (없으면 스냅샷 result 나 최고점으로 유추)
  result: AZGameOverPayload | null;
  // 사설 방 코드 — 있으면 같은 방 재대결 버튼을 보여준다 (공용 로비는 ''/생략)
  roomCode?: string;
  onFindNewGame: () => void;
}

// 승자 좌석들 — 페이로드 → 스냅샷 result → 최고점(동점이면 완성 가로줄 수) 순
function deriveWinnerSeats(
  players: AZPlayerView[],
  game: AZGameState,
  result: AZGameOverPayload | null,
): number[] {
  const fromPayload = result?.winnerSeats ?? [];
  if (fromPayload.length > 0) return fromPayload;
  const fromSnapshot = game.result?.winnerSeats ?? [];
  if (fromSnapshot.length > 0) return fromSnapshot;
  if (players.length === 0) return [];
  const best = Math.max(...players.map((p) => p.score));
  const topScorers = players.filter((p) => p.score === best);
  if (topScorers.length === 1) return topScorers.map((p) => p.seat);
  // 동점이면 완성한 가로줄이 많은 쪽, 그래도 같으면 공동 승
  const rowsOf = (p: AZPlayerView) => azBonusBreakdown(azWall(p)).rows;
  const bestRows = Math.max(...topScorers.map(rowsOf));
  return topScorers.filter((p) => rowsOf(p) === bestRows).map((p) => p.seat);
}

export function AzulGameOver({
  game,
  result,
  roomCode,
  onFindNewGame,
}: AzulGameOverProps) {
  const players = game.players ?? [];
  const winnerSeats = deriveWinnerSeats(players, game, result);
  const winnerNames =
    result?.winnerNames && result.winnerNames.length > 0
      ? result.winnerNames
      : game.result?.winnerNames && game.result.winnerNames.length > 0
        ? game.result.winnerNames
        : players.filter((p) => winnerSeats.includes(p.seat)).map((p) => p.name);
  const youWon = game.yourSeat >= 0 && winnerSeats.includes(game.yourSeat);

  // 점수 높은 순 (같으면 좌석 순) — 동점은 같은 순위로 묶는다
  const standings = [...players].sort(
    (a, b) => b.score - a.score || a.seat - b.seat,
  );
  const rankOf = (score: number) =>
    standings.filter((p) => p.score > score).length + 1;

  return (
    <div className="az-scope az-game-over">
      <div className="az-game-over-container">
        <span className="az-over-mark">🔷</span>
        <h1 className="az-over-title">
          {winnerNames.length > 0 ? winnerNames.join(' · ') : '?'}
          {winnerNames.length > 1 ? ' 공동 승리' : '님의 승리'}
        </h1>
        <p className="az-over-sub">
          {result?.message ??
            game.result?.message ??
            `벽의 가로줄이 완성되어 ${game.round}라운드로 끝났습니다`}
        </p>
        {game.yourSeat >= 0 && (
          <p className={`az-over-verdict ${youWon ? 'win' : 'lose'}`}>
            {youWon ? '🏆 승리했습니다!' : '아쉽게 패배했습니다'}
          </p>
        )}

        <p className="az-over-bonus-note">
          최종 보너스 — 완성 가로줄 {AZ_BONUS_ROW}점 · 세로줄 {AZ_BONUS_COL}점 ·
          같은 색 5장 {AZ_BONUS_COLOR}점 (아래 점수에 이미 포함)
        </p>

        <div className="az-over-list">
          {standings.map((p) => {
            const wall = azWall(p);
            const bonus = azBonusBreakdown(wall);
            const isWinner = winnerSeats.includes(p.seat);
            return (
              <div
                key={p.seat}
                className={`az-over-card ${isWinner ? 'winner' : ''}`}
              >
                <div className="az-over-card-head">
                  <span className="az-over-name">
                    <span className="az-over-rank">{rankOf(p.score)}</span>
                    {isWinner && '👑 '}
                    {p.name}
                    {p.seat === game.yourSeat && ' (나)'}
                    {p.bot && ' 🤖'}
                  </span>
                  <span className="az-over-score">{p.score}점</span>
                </div>
                <div className="az-over-card-body">
                  <AzWallGrid wall={wall} size="xs" />
                  <ul className="az-over-bonus">
                    <li>
                      가로줄 {bonus.rows}줄
                      <strong>+{bonus.rows * AZ_BONUS_ROW}</strong>
                    </li>
                    <li>
                      세로줄 {bonus.cols}줄
                      <strong>+{bonus.cols * AZ_BONUS_COL}</strong>
                    </li>
                    <li>
                      같은 색 완성 {bonus.colors}종
                      <strong>+{bonus.colors * AZ_BONUS_COLOR}</strong>
                    </li>
                    <li className="sum">
                      보너스 합<strong>+{bonus.total}</strong>
                    </li>
                  </ul>
                </div>
              </div>
            );
          })}
        </div>

        {roomCode && (
          // 전체 리로드 + ?room 프리필 — 같은 코드로 다시 join 하면 관대한
          // 생성으로 같은 코드의 새 대기실이 열린다 (기존 흐름 재사용)
          <button
            type="button"
            className="az-primary-button"
            onClick={() => {
              window.location.href = `${window.location.pathname}?room=${roomCode}`;
            }}
          >
            🔄 같은 방에서 재대결
          </button>
        )}
        <button
          type="button"
          className="az-primary-button"
          onClick={onFindNewGame}
        >
          새 게임 찾기
        </button>
      </div>
    </div>
  );
}
