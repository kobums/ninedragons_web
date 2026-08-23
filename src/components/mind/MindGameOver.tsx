import type { MIGameOverPayload, MIGameState } from '../../types/mind';
import './MindGameOver.css';

interface MindGameOverProps {
  // 마지막 스냅샷 (phase 'game_over')
  game: MIGameState;
  // mi_game_over 페이로드 — 신호+결과 보조 (없으면 스냅샷 result 로 그린다)
  result: MIGameOverPayload | null;
  // 사설 방 코드 — 있으면 같은 방 재대결 버튼을 보여준다 (공용 로비는 ''/생략)
  roomCode?: string;
  onFindNewGame: () => void;
}

// 협력 게임이라 승패는 전원 공동이다 — 몇 라운드까지 갔는지가 기록.
export function MindGameOver({
  game,
  result,
  roomCode,
  onFindNewGame,
}: MindGameOverProps) {
  const players = game.players ?? [];
  const snap = game.result ?? null;

  const cleared = snap?.cleared ?? result?.cleared ?? false;
  const maxRound = game.maxRound > 0 ? game.maxRound : game.round;
  const reachedRound = snap?.round ?? result?.round ?? game.round;
  // 실패라면 그 라운드에서 멈춘 것이므로 직전 라운드까지가 클리어 기록
  const clearedCount = cleared
    ? maxRound
    : Math.max(0, Math.min(maxRound, reachedRound - 1));

  const title = cleared ? '🌕 마음이 통했습니다' : '💔 생명이 다했습니다';
  const message =
    snap?.message ??
    result?.message ??
    (cleared
      ? `${maxRound}라운드까지 한마디 없이 맞춰냈습니다`
      : `${reachedRound}라운드에서 멈췄습니다`);

  const pct = maxRound > 0 ? (clearedCount / maxRound) * 100 : 0;

  return (
    <div className="mi-scope mi-game-over">
      <div className="mi-game-over-container">
        <h1 className={`mi-over-title ${cleared ? 'cleared' : 'failed'}`}>
          {title}
        </h1>
        <p className="mi-over-message">{message}</p>

        {/* 기록 — 클리어한 라운드 수 */}
        <div className="mi-over-score">
          <span className="mi-over-score-value">
            {clearedCount}
            <span className="mi-over-score-max"> / {maxRound}</span>
          </span>
          <span className="mi-over-score-label">클리어한 라운드</span>
          <div className="mi-over-track">
            <div
              className={`mi-over-fill ${cleared ? 'cleared' : ''}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          {!cleared && (
            <span className="mi-over-reach">
              {reachedRound}라운드에서 멈췄습니다
            </span>
          )}
        </div>

        {/* 남은 자원 */}
        <div className="mi-over-meters">
          <span className="mi-over-meter life">❤️ 남은 생명 {game.lives}</span>
          <span className="mi-over-meter star">⭐ 남은 수리검 {game.stars}</span>
        </div>

        {/* 함께한 사람들 — 협력 게임이라 순위가 없다 */}
        <ul className="mi-over-roster">
          {players.map((p) => (
            <li key={p.seat} className="mi-over-row">
              <span className="mi-over-name">
                {p.name}
                {p.seat === game.yourSeat && ' (나)'}
                {p.bot && ' 🤖'}
              </span>
              <span className="mi-over-tag">
                {p.handCount === 0 ? '전부 냄' : `${p.handCount}장 남음`}
              </span>
            </li>
          ))}
        </ul>

        {roomCode && (
          // 전체 리로드 + ?room 프리필 — 같은 코드로 다시 join 하면 관대한
          // 생성으로 같은 코드의 새 대기실이 열린다 (기존 흐름 재사용)
          <button
            type="button"
            className="mi-primary-button"
            onClick={() => {
              window.location.href = `${window.location.pathname}?room=${roomCode}`;
            }}
          >
            🔄 같은 방에서 재도전
          </button>
        )}
        <button
          type="button"
          className="mi-primary-button"
          onClick={onFindNewGame}
        >
          새 게임 찾기
        </button>
      </div>
    </div>
  );
}
