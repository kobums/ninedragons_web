import type { SKGameOverPayload, SKGameState } from '../../types/skull';
import { SK_WIN_POINTS } from '../../types/skull';
import './SkullGameOver.css';

interface SkullGameOverProps {
  // 마지막 스냅샷 (phase 'game_over')
  game: SKGameState;
  // sk_game_over 페이로드 — 승자 좌석 보조 (없으면 스냅샷에서 유도)
  gameOver: SKGameOverPayload | null;
  // 사설 방 코드 — 있으면 같은 방 재대결 버튼을 보여준다 (공용 로비는 ''/생략)
  roomCode?: string;
  onFindNewGame: () => void;
}

// 승부 결과 오버레이 — 사설 방이면 같은 방 재대결, 아니면 "새 게임 찾기"만.
export function SkullGameOver({
  game,
  gameOver,
  roomCode,
  onFindNewGame,
}: SkullGameOverProps) {
  const players = game.players ?? [];
  const alive = players.filter((p) => p.alive);

  // 승자 좌석: 페이로드 우선 → 2점 선취자 → 1인 생존자 순으로 유도
  const winnerSeat =
    typeof gameOver?.winnerSeat === 'number' && gameOver.winnerSeat >= 0
      ? gameOver.winnerSeat
      : (players.find((p) => p.points >= SK_WIN_POINTS)?.seat ??
        (alive.length === 1 ? alive[0].seat : -1));
  const winner = players.find((p) => p.seat === winnerSeat);

  const isSpectator = game.yourSeat < 0;
  const youWon = !isSpectator && winnerSeat >= 0 && winnerSeat === game.yourSeat;

  // 점수 → 생존 순으로 정렬한 최종 순위표
  const roster = [...players].sort(
    (a, b) => b.points - a.points || Number(b.alive) - Number(a.alive),
  );

  return (
    <div className="sk-game-over">
      <div className="sk-game-over-container">
        <span className="sk-over-icon">{youWon ? '🌹' : '💀'}</span>
        <h1 className="sk-over-title">
          {winner ? `${winner.name} 승리` : '게임 종료'}
        </h1>
        {!isSpectator && (
          <p className={`sk-over-verdict ${youWon ? 'win' : 'lose'}`}>
            {youWon
              ? '🏆 장미의 주인은 당신입니다'
              : gameOver?.message ?? '다음 판에서 설욕하세요'}
          </p>
        )}

        <ul className="sk-over-roster">
          {roster.map((p) => (
            <li
              key={p.seat}
              className={[
                'sk-over-row',
                p.alive ? '' : 'dead',
                p.seat === winnerSeat ? 'winner' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <span className="sk-over-name">
                {p.seat === winnerSeat ? '🏆 ' : p.alive ? '' : '💀 '}
                {p.name}
                {p.seat === game.yourSeat && ' (나)'}
                {p.bot && ' 🤖'}
              </span>
              <span className="sk-over-points">
                {Array.from({ length: SK_WIN_POINTS }).map((_, i) => (
                  <span
                    key={i}
                    className={`sk-over-point ${i < p.points ? 'won' : ''}`}
                  >
                    🌹
                  </span>
                ))}
              </span>
            </li>
          ))}
        </ul>

        {roomCode && (
          // 전체 리로드 + ?room 프리필 — 같은 코드로 다시 join 하면 관대한
          // 생성으로 같은 코드의 새 대기실이 열린다 (다인 게임 공통 흐름)
          <button
            type="button"
            className="sk-primary-button"
            onClick={() => {
              window.location.href = `${window.location.pathname}?room=${roomCode}`;
            }}
          >
            🔄 같은 방에서 재대결
          </button>
        )}
        <button
          type="button"
          className="sk-primary-button"
          onClick={onFindNewGame}
        >
          새 게임 찾기
        </button>
      </div>
    </div>
  );
}
