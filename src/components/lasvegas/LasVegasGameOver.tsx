import type { VGGameOverPayload, VGGameState } from '../../types/lasvegas';
import { vgMoney } from '../../types/lasvegas';
import './LasVegasGameOver.css';

interface LasVegasGameOverProps {
  // 마지막 스냅샷 (phase 'game_over' — 최종 총액 포함)
  game: VGGameState;
  // vg_game_over 페이로드 (없으면 스냅샷에서 승자를 유추)
  result: VGGameOverPayload | null;
  // 사설 방 코드 — 있으면 같은 방 재대결 버튼을 보여준다 (공용 로비는 ''/생략)
  roomCode?: string;
  onFindNewGame: () => void;
}

// 승자 좌석들 — 스냅샷 winnerSeats 우선, 다음 페이로드, 없으면 최고 총액(동점 공동 승)
function deriveWinnerSeats(
  game: VGGameState,
  result: VGGameOverPayload | null,
): number[] {
  const fromState = game.winnerSeats ?? [];
  if (fromState.length > 0) return fromState;
  const fromResult = result?.winnerSeats ?? [];
  if (fromResult.length > 0) return fromResult;

  const players = game.players ?? [];
  if (players.length === 0) return [];
  const best = Math.max(...players.map((p) => p.cash));
  return players.filter((p) => p.cash === best).map((p) => p.seat);
}

// 최종 총액 순위 화면 — 사설 방이면 같은 방 재대결, 아니면 "새 게임 찾기"만.
export function LasVegasGameOver({
  game,
  result,
  roomCode,
  onFindNewGame,
}: LasVegasGameOverProps) {
  const players = game.players ?? [];
  const winnerSeats = deriveWinnerSeats(game, result);
  const winners = players.filter((p) => winnerSeats.includes(p.seat));
  const winnerNames = winners.map((p) => p.name).join(', ') || '?';
  const youWon = game.yourSeat >= 0 && winnerSeats.includes(game.yourSeat);

  // 총액 많은 순 정렬 (같으면 좌석 순), 동액은 같은 순위
  const standings = [...players].sort(
    (a, b) => b.cash - a.cash || a.seat - b.seat,
  );
  const rankOf = (cash: number) =>
    standings.findIndex((p) => p.cash === cash) + 1;

  return (
    <div className="vg-game-over">
      <div className="vg-game-over-container">
        <span className="vg-over-mark">🎰</span>
        <h1 className="vg-over-title">
          {winnerNames}
          {winners.length > 1 ? ' 공동 우승!' : '님의 우승!'}
        </h1>
        <p className="vg-over-sub">4라운드 종료 · 최종 총액</p>
        {game.yourSeat >= 0 && (
          <p className={`vg-over-verdict ${youWon ? 'win' : 'lose'}`}>
            {youWon ? '🏆 승리했습니다!' : '아쉽게 패배했습니다'}
          </p>
        )}

        <ul className="vg-over-roster">
          {standings.map((p) => {
            const isWinner = winnerSeats.includes(p.seat);
            return (
              <li
                key={p.seat}
                className={`vg-over-row ${isWinner ? 'winner' : ''}`}
              >
                <span className="vg-over-rank">{rankOf(p.cash)}위</span>
                <span className="vg-over-name">
                  {isWinner && '👑 '}
                  {p.name}
                  {p.seat === game.yourSeat && ' (나)'}
                  {p.bot && ' 🤖'}
                </span>
                <span className="vg-over-cash">{vgMoney(p.cash)}</span>
              </li>
            );
          })}
        </ul>

        {roomCode && (
          // 전체 리로드 + ?room 프리필 — 같은 코드로 다시 join 하면 관대한
          // 생성으로 같은 코드의 새 대기실이 열린다 (기존 흐름 재사용)
          <button
            type="button"
            className="vg-primary-button"
            onClick={() => {
              window.location.href = `${window.location.pathname}?room=${roomCode}`;
            }}
          >
            🔄 같은 방에서 재대결
          </button>
        )}
        <button
          type="button"
          className="vg-primary-button"
          onClick={onFindNewGame}
        >
          새 게임 찾기
        </button>
      </div>
    </div>
  );
}
