import type { EKGameOverPayload, EKGameState } from '../../types/kittens';
import './KittensGameOver.css';

interface KittensGameOverProps {
  // 마지막 스냅샷 (phase 'game_over')
  game: EKGameState;
  // ek_game_over 페이로드 — 승자 보조 (없으면 스냅샷에서 유도)
  gameOver: EKGameOverPayload | null;
  // 사설 방 코드 — 있으면 같은 방 재대결 버튼을 보여준다 (공용 로비는 ''/생략)
  roomCode?: string;
  onFindNewGame: () => void;
}

// 최후 생존자 화면 — 폭탄이 인원보다 1장 적으니 승자는 언제나 한 명이다.
export function KittensGameOver({
  game,
  gameOver,
  roomCode,
  onFindNewGame,
}: KittensGameOverProps) {
  const players = game.players ?? [];

  // 승자 좌석: 페이로드 → 스냅샷 result → 최후 생존자 순으로 찾는다
  const survivors = players.filter((p) => p.alive).map((p) => p.seat);
  const winnerSeat =
    gameOver?.winnerSeat ??
    game.result?.winnerSeat ??
    (survivors.length === 1 ? survivors[0] : -1);
  const winnerName =
    gameOver?.winnerName ||
    game.result?.winnerName ||
    players.find((p) => p.seat === winnerSeat)?.name ||
    '';

  const isSpectator = game.yourSeat < 0;
  const youWon = !isSpectator && winnerSeat >= 0 && winnerSeat === game.yourSeat;

  // 생존자 먼저, 그다음 손패가 많이 남은 순 — 탈락 순서 정보는 계약에 없다
  const roster = [...players].sort(
    (a, b) => Number(b.alive) - Number(a.alive) || b.handCount - a.handCount,
  );

  return (
    <div className="ek-game-over">
      <div className="ek-game-over-container">
        <span className="ek-over-mark" aria-hidden="true">
          {youWon ? '🏆' : '💣'}
        </span>
        <h1 className="ek-over-title">
          {winnerName ? `${winnerName}님의 승리` : '게임 종료'}
        </h1>
        <p className="ek-over-sub">
          {gameOver?.message ??
            game.result?.message ??
            '폭탄을 피해 마지막까지 살아남았습니다'}
        </p>
        {!isSpectator && (
          <p className={`ek-over-verdict ${youWon ? 'win' : 'lose'}`}>
            {youWon
              ? '🏆 마지막 생존자는 당신입니다!'
              : '💥 아쉽게 폭탄에 무너졌습니다'}
          </p>
        )}

        <ul className="ek-over-roster">
          {roster.map((p) => (
            <li
              key={p.seat}
              className={[
                'ek-over-row',
                p.alive ? '' : 'dead',
                p.seat === winnerSeat ? 'winner' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <span className="ek-over-name">
                {p.seat === winnerSeat ? '👑 ' : p.alive ? '' : '💀 '}
                {p.name}
                {p.seat === game.yourSeat && ' (나)'}
                {p.bot && ' 🤖'}
              </span>
              <span className="ek-over-info">
                {p.alive ? `🃏 ${p.handCount}장` : '탈락'}
              </span>
            </li>
          ))}
        </ul>

        {roomCode && (
          // 전체 리로드 + ?room 프리필 — 같은 코드로 다시 join 하면 관대한
          // 생성으로 같은 코드의 새 대기실이 열린다 (다인 게임 공통 흐름)
          <button
            type="button"
            className="ek-primary-button"
            onClick={() => {
              window.location.href = `${window.location.pathname}?room=${roomCode}`;
            }}
          >
            🔄 같은 방에서 재대결
          </button>
        )}
        <button
          type="button"
          className="ek-primary-button"
          onClick={onFindNewGame}
        >
          새 게임 찾기
        </button>
      </div>
    </div>
  );
}
