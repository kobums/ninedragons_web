import type {
  CCGameOverPayload,
  CCGameState,
  CCPlayerView,
} from '../../types/ciaociao';
import { CC_WIN_CROSSED } from '../../types/ciaociao';
import './CiaoCiaoGameOver.css';

interface CiaoCiaoGameOverProps {
  // 마지막 스냅샷 (phase 'game_over')
  game: CCGameState;
  // cc_game_over 페이로드 (없으면 스냅샷에서 승자를 유추)
  result: CCGameOverPayload | null;
  // 사설 방 코드 — 있으면 같은 방 재대결 버튼을 보여준다 (공용 로비는 ''/생략)
  roomCode?: string;
  onFindNewGame: () => void;
}

// 승자 좌석들 — 서버 페이로드 우선, 없으면 통과 수 최다(동점 공동)로 유추
function deriveWinnerSeats(
  players: CCPlayerView[],
  result: CCGameOverPayload | null,
): number[] {
  if (result?.winnerSeats && result.winnerSeats.length > 0) {
    return result.winnerSeats;
  }
  if (players.length === 0) return [];
  const best = Math.max(...players.map((p) => p.crossed));
  return players.filter((p) => p.crossed === best).map((p) => p.seat);
}

// 종료 화면 — 통과 순위 표 + 같은 방 재대결
export function CiaoCiaoGameOver({
  game,
  result,
  roomCode,
  onFindNewGame,
}: CiaoCiaoGameOverProps) {
  const players = game.players ?? [];
  const winnerSeats = deriveWinnerSeats(players, result);
  const winnerNames =
    result?.winners && result.winners.length > 0
      ? result.winners
      : players.filter((p) => winnerSeats.includes(p.seat)).map((p) => p.name);
  const youWon = game.yourSeat >= 0 && winnerSeats.includes(game.yourSeat);

  // 통과 순위 — 통과 많은 순, 같으면 남은 말 많은 순, 같으면 좌석 순
  const standings = [...players].sort(
    (a, b) =>
      b.crossed - a.crossed ||
      b.pawnsLeft +
        (b.onBridge ?? []).length -
        (a.pawnsLeft + (a.onBridge ?? []).length) ||
      a.seat - b.seat,
  );

  return (
    <div className="cc-game-over">
      <div className="cc-game-over-container">
        <span className="cc-over-mark">🌉</span>
        <h1 className="cc-over-title">
          {winnerNames.length > 0 ? winnerNames.join(' · ') : '?'}
          {winnerNames.length > 1 ? ' 공동 승리' : '님의 승리'}
        </h1>
        <p className="cc-over-sub">
          {result?.message ??
            `말 ${CC_WIN_CROSSED}개를 먼저 다리 너머로 통과시켰습니다`}
        </p>
        {game.yourSeat >= 0 && (
          <p className={`cc-over-verdict ${youWon ? 'win' : 'lose'}`}>
            {youWon ? '🏆 승리했습니다!' : '아쉽게 패배했습니다'}
          </p>
        )}

        {/* 통과 순위 표 */}
        <div className="cc-over-table-wrap">
          <table className="cc-over-table">
            <thead>
              <tr>
                <th className="left">플레이어</th>
                <th>통과 🏁</th>
                <th>남은 말</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((p) => {
                const isWinner = winnerSeats.includes(p.seat);
                const remaining = p.pawnsLeft + (p.onBridge ?? []).length;
                return (
                  <tr key={p.seat} className={isWinner ? 'winner' : undefined}>
                    <td className="left">
                      <span className="cc-over-name">
                        <span
                          className={`cc-pawn cc-seat-color-${p.seat % 4}`}
                          aria-hidden="true"
                        />
                        {isWinner && '👑 '}
                        {p.name}
                        {p.seat === game.yourSeat && ' (나)'}
                        {p.bot && ' 🤖'}
                      </span>
                    </td>
                    <td className="cc-over-crossed">
                      {p.crossed}/{CC_WIN_CROSSED}
                    </td>
                    <td>{p.alive ? remaining : '💨 탈락'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {roomCode && (
          // 전체 리로드 + ?room 프리필 — 같은 코드로 다시 join 하면 관대한
          // 생성으로 같은 코드의 새 대기실이 열린다 (기존 흐름 재사용)
          <button
            type="button"
            className="cc-primary-button"
            onClick={() => {
              window.location.href = `${window.location.pathname}?room=${roomCode}`;
            }}
          >
            🔄 같은 방에서 재대결
          </button>
        )}
        <button
          type="button"
          className="cc-primary-button"
          onClick={onFindNewGame}
        >
          새 게임 찾기
        </button>
      </div>
    </div>
  );
}
