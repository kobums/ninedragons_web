import type { LVGameOverPayload, LVGameState } from '../../types/loveletter';
import './LoveLetterGameOver.css';

interface LoveLetterGameOverProps {
  // 마지막 스냅샷 (phase 'game_over' — 토큰 현황 포함)
  game: LVGameState;
  // lv_game_over 페이로드 (없으면 스냅샷에서 승자를 유추)
  result: LVGameOverPayload | null;
  // 사설 방 코드 — 있으면 같은 방 재대결 버튼을 보여준다 (공용 로비는 ''/생략)
  roomCode?: string;
  onFindNewGame: () => void;
}

// 승자 좌석 — 서버 페이로드 우선, 없으면 목표 토큰 도달자 → 최다 토큰으로 유추
function deriveWinnerSeat(game: LVGameState, result: LVGameOverPayload | null): number {
  if (result?.winnerSeat !== undefined && result.winnerSeat >= 0) {
    return result.winnerSeat;
  }
  const players = game.players ?? [];
  const reached = players.find((p) => p.tokens >= game.targetTokens);
  if (reached) return reached.seat;
  let best = -1;
  let bestTokens = -1;
  for (const p of players) {
    if (p.tokens > bestTokens) {
      best = p.seat;
      bestTokens = p.tokens;
    }
  }
  return best;
}

// 단판 승부 결과 화면 — 사설 방이면 같은 방 재대결, 아니면 "새 게임 찾기"만.
export function LoveLetterGameOver({
  game,
  result,
  roomCode,
  onFindNewGame,
}: LoveLetterGameOverProps) {
  const players = game.players ?? [];
  const winnerSeat = deriveWinnerSeat(game, result);
  const winner = players.find((p) => p.seat === winnerSeat);
  const winnerName = result?.winnerName || winner?.name || '?';
  const youWon = game.yourSeat >= 0 && winnerSeat === game.yourSeat;

  // 토큰 많은 순 정렬 (같으면 좌석 순)
  const standings = [...players].sort(
    (a, b) => b.tokens - a.tokens || a.seat - b.seat,
  );

  return (
    <div className="lv-game-over">
      <div className="lv-game-over-container">
        <span className="lv-over-mark">💌</span>
        <h1 className="lv-over-title">
          {winnerName}님이 마음을 얻었습니다
        </h1>
        <p className="lv-over-sub">
          목표 ❤️ {game.targetTokens}개 달성 · 게임 종료
        </p>
        {game.yourSeat >= 0 && (
          <p className={`lv-over-verdict ${youWon ? 'win' : 'lose'}`}>
            {youWon ? '🏆 승리했습니다!' : '아쉽게 패배했습니다'}
          </p>
        )}

        <ul className="lv-over-roster">
          {standings.map((p) => (
            <li
              key={p.seat}
              className={`lv-over-row ${p.seat === winnerSeat ? 'winner' : ''}`}
            >
              <span className="lv-over-name">
                {p.seat === winnerSeat && '👑 '}
                {p.name}
                {p.seat === game.yourSeat && ' (나)'}
                {p.bot && ' 🤖'}
              </span>
              <span className="lv-over-tokens">❤️ {p.tokens}</span>
            </li>
          ))}
        </ul>

        {roomCode && (
          // 전체 리로드 + ?room 프리필 — 같은 코드로 다시 join 하면 관대한
          // 생성으로 같은 코드의 새 대기실이 열린다 (기존 흐름 재사용)
          <button
            type="button"
            className="lv-primary-button"
            onClick={() => {
              window.location.href = `${window.location.pathname}?room=${roomCode}`;
            }}
          >
            🔄 같은 방에서 재대결
          </button>
        )}
        <button
          type="button"
          className="lv-primary-button"
          onClick={onFindNewGame}
        >
          새 게임 찾기
        </button>
      </div>
    </div>
  );
}
