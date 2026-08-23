import type { SBGameOverPayload, SBGameState } from '../../types/saboteur';
import {
  SB_GOALS,
  SB_GOAL_LABEL,
  SB_ROLE_ICON,
  SB_ROLE_LABEL,
} from '../../types/saboteur';
import './SaboteurGameOver.css';

interface SaboteurGameOverProps {
  // 마지막 스냅샷 (phase 'game_over' — 전원 역할 공개 상태)
  game: SBGameState;
  // sb_game_over 페이로드 — 신호+승자 보조 (없으면 스냅샷 result 로 그린다)
  result: SBGameOverPayload | null;
  // 사설 방 코드 — 있으면 같은 방 재대결 버튼을 보여준다 (공용 로비는 ''/생략)
  roomCode?: string;
  onFindNewGame: () => void;
}

// 단판 승부 결과 오버레이 — 사설 방이면 같은 방 재대결, 아니면 "새 게임 찾기"만.
// (원작 3라운드·금덩이 분배는 생략한 1라운드 규칙이다)
export function SaboteurGameOver({
  game,
  result,
  roomCode,
  onFindNewGame,
}: SaboteurGameOverProps) {
  const players = game.players ?? [];
  const board = game.board ?? [];
  const snap = game.result ?? null;
  const winner = snap?.winner ?? result?.winner ?? null;
  const goldIndex = snap?.goldIndex ?? result?.goldIndex ?? -1;
  const myRole = game.yourRole ?? '';

  const title =
    winner === 'miner'
      ? '⛏ 광부 승리'
      : winner === 'saboteur'
        ? '💣 파괴꾼 승리'
        : '게임 종료';

  const youWon =
    myRole !== '' && winner !== null && winner === myRole;

  const message =
    snap?.message ??
    result?.message ??
    (winner === 'miner'
      ? '금덩이까지 길이 이어졌습니다'
      : '아무도 금에 닿지 못한 채 카드가 떨어졌습니다');

  const pathCount = board.filter((t) => t.kind === 'path').length;

  return (
    <div className="sb-scope sb-game-over">
      <div className="sb-game-over-container">
        <h1 className={`sb-over-title ${winner ?? 'none'}`}>{title}</h1>
        <p className="sb-over-message">{message}</p>
        {myRole !== '' && winner !== null && (
          <p className={`sb-over-verdict ${youWon ? 'win' : 'lose'}`}>
            {youWon ? '🏆 당신이 이겼습니다' : '당신이 졌습니다'}
          </p>
        )}

        {/* 금덩이 위치 공개 */}
        <div className="sb-over-goals">
          {SB_GOALS.map((g, i) => (
            <span
              key={i}
              className={`sb-over-goal ${i === goldIndex ? 'gold' : 'rock'}`}
            >
              <span className="sb-over-goal-face">
                {i === goldIndex ? '💰' : '🪨'}
              </span>
              <span className="sb-over-goal-label">
                {SB_GOAL_LABEL[i]}
                <br />
                {g.col + 1}열 {g.row + 1}행
              </span>
            </span>
          ))}
        </div>
        <p className="sb-over-stat">놓인 길 타일 {pathCount}장</p>

        {/* 전원 역할 공개 */}
        <ul className="sb-over-roster">
          {players.map((p) => {
            const role = p.role ?? '';
            return (
              <li key={p.seat} className="sb-over-row">
                <span className="sb-over-name">
                  {p.name}
                  {p.seat === game.yourSeat && ' (나)'}
                  {p.bot && ' 🤖'}
                </span>
                {role !== '' && (
                  <span className={`sb-over-role role-${role}`}>
                    {SB_ROLE_ICON[role]} {SB_ROLE_LABEL[role]}
                  </span>
                )}
              </li>
            );
          })}
        </ul>

        {roomCode && (
          // 전체 리로드 + ?room 프리필 — 같은 코드로 다시 join 하면 관대한
          // 생성으로 같은 코드의 새 대기실이 열린다 (기존 흐름 재사용)
          <button
            type="button"
            className="sb-primary-button"
            onClick={() => {
              window.location.href = `${window.location.pathname}?room=${roomCode}`;
            }}
          >
            🔄 같은 방에서 재대결
          </button>
        )}
        <button
          type="button"
          className="sb-primary-button"
          onClick={onFindNewGame}
        >
          새 게임 찾기
        </button>
      </div>
    </div>
  );
}
