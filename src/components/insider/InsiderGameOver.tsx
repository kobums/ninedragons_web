import type { IDGameOverPayload, IDGameState } from '../../types/insider';
import { ID_ROLE_ICON, ID_ROLE_LABEL } from '../../types/insider';
import './InsiderGameOver.css';

interface InsiderGameOverProps {
  // 마지막 스냅샷 (phase 'game_over' — 전원 역할·제시어 공개 상태)
  game: IDGameState;
  // id_game_over 페이로드 — 신호+승자 보조 (없으면 스냅샷 result 로 그린다)
  result: IDGameOverPayload | null;
  // 사설 방 코드 — 있으면 같은 방 재대결 버튼을 보여준다 (공용 로비는 ''/생략)
  roomCode?: string;
  onFindNewGame: () => void;
}

// 단판 승부 결과 오버레이 — 사설 방이면 같은 방 재대결, 아니면 "새 게임 찾기"만.
export function InsiderGameOver({
  game,
  result,
  roomCode,
  onFindNewGame,
}: InsiderGameOverProps) {
  const players = game.players ?? [];
  const snap = game.result ?? null;
  const winner = snap?.winner ?? result?.winner ?? 'none';
  const myRole = game.yourRole;

  const title =
    winner === 'citizens'
      ? '🙌 일반인·마스터 승리'
      : winner === 'insider'
        ? '🕵 인사이더 승리'
        : '⏳ 전원 패배';

  // none(정답 못 맞힘)은 인사이더 포함 전원 패배
  const youWon =
    myRole !== '' &&
    winner !== 'none' &&
    (winner === 'insider') === (myRole === 'insider');

  const message =
    snap?.message ??
    result?.message ??
    (winner === 'citizens'
      ? '인사이더를 찾아냈습니다!'
      : winner === 'insider'
        ? '인사이더가 정체를 숨기는 데 성공했습니다'
        : '시간 안에 정답을 맞히지 못했습니다');

  const nameOf = (seat: number) =>
    players.find((p) => p.seat === seat)?.name ?? '?';

  return (
    <div className="id-scope id-game-over">
      <div className="id-game-over-container">
        <h1 className={`id-over-title ${winner}`}>{title}</h1>
        <p className="id-over-message">{message}</p>
        {myRole !== '' && winner !== 'none' && (
          <p className={`id-over-verdict ${youWon ? 'win' : 'lose'}`}>
            {youWon ? '🏆 당신이 이겼습니다' : '당신이 졌습니다'}
          </p>
        )}

        {/* 제시어 공개 */}
        {game.word && (
          <div className="id-over-word">
            <span className="id-over-word-label">테마</span>
            <span className="id-over-word-value">{game.word}</span>
          </div>
        )}

        {snap && snap.topSeat >= 0 && (
          <p className="id-over-top">
            최다 득표 — <strong>{nameOf(snap.topSeat)}</strong>
            {snap.insiderSeat >= 0 &&
              (snap.topSeat === snap.insiderSeat
                ? ' (인사이더였습니다)'
                : ' (인사이더가 아니었습니다)')}
          </p>
        )}

        {/* 전원 역할 공개 */}
        <ul className="id-over-roster">
          {players.map((p) => {
            const role = p.role ?? '';
            return (
              <li key={p.seat} className="id-over-row">
                <span className="id-over-name">
                  {p.name}
                  {p.seat === game.yourSeat && ' (나)'}
                  {p.bot && ' 🤖'}
                </span>
                <span className="id-over-tags">
                  {(p.votes ?? 0) > 0 && (
                    <span className="id-over-votes">{p.votes}표</span>
                  )}
                  {role !== '' && (
                    <span className={`id-over-role role-${role}`}>
                      {ID_ROLE_ICON[role]} {ID_ROLE_LABEL[role]}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>

        {roomCode && (
          // 전체 리로드 + ?room 프리필 — 같은 코드로 다시 join 하면 관대한
          // 생성으로 같은 코드의 새 대기실이 열린다 (기존 흐름 재사용)
          <button
            type="button"
            className="id-primary-button"
            onClick={() => {
              window.location.href = `${window.location.pathname}?room=${roomCode}`;
            }}
          >
            🔄 같은 방에서 재대결
          </button>
        )}
        <button
          type="button"
          className="id-primary-button"
          onClick={onFindNewGame}
        >
          새 게임 찾기
        </button>
      </div>
    </div>
  );
}
