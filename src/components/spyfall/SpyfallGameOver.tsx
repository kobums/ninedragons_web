import type { SPGameState } from '../../types/spyfall';
import { SP_REASON_LABEL } from '../../types/spyfall';
import './SpyfallGameOver.css';

interface SpyfallGameOverProps {
  // 마지막 스냅샷 (phase 'game_over' — result 로 스파이·장소 공개)
  game: SPGameState;
  // 사설 방 코드 — 있으면 같은 방 재대결 버튼을 보여준다 (공용 로비는 ''/생략)
  roomCode?: string;
  onFindNewGame: () => void;
}

// 단판 승부 결과 오버레이 — 사설 방이면 같은 방 재대결, 아니면 "새 게임 찾기"만.
export function SpyfallGameOver({ game, roomCode, onFindNewGame }: SpyfallGameOverProps) {
  const result = game.result ?? null;
  const winner = result?.winner ?? null;
  const youWon =
    winner !== null && (game.isSpy ? winner === 'spy' : winner === 'citizen');

  const nameOf = (seat: number) =>
    game.players.find((p) => p.seat === seat)?.name ?? '?';

  const title =
    winner === 'spy'
      ? '🕵️ 스파이 승리'
      : winner === 'citizen'
        ? '🏛️ 시민팀 승리'
        : '게임 종료';

  // 사유 보조 설명 — 추리·최다 득표 디테일
  const reasonDetail = (() => {
    if (!result) return '';
    switch (result.reason) {
      case 'guess_right':
      case 'guess_wrong':
        return result.guessedLocation
          ? `추리한 답: ${result.guessedLocation}`
          : '';
      case 'vote_caught':
        return '';
      case 'vote_missed':
        return result.topSeat >= 0
          ? `최다 득표: ${nameOf(result.topSeat)}`
          : '표가 갈려 아무도 검거되지 않았습니다';
    }
  })();

  return (
    <div className="sp-game-over">
      <div className="sp-game-over-container">
        <h1 className={`sp-over-title ${winner ?? ''}`}>{title}</h1>
        {winner !== null && (
          <p className={`sp-over-verdict ${youWon ? 'win' : 'lose'}`}>
            {youWon ? '🏆 당신이 이겼습니다' : '당신이 졌습니다'}
          </p>
        )}

        {result && (
          <div className="sp-over-dossier">
            <div className="sp-over-fact">
              <span className="sp-over-fact-label">스파이</span>
              <span className="sp-over-fact-value spy">
                🕵️ {nameOf(result.spySeat)}
              </span>
            </div>
            <div className="sp-over-fact">
              <span className="sp-over-fact-label">정답 ({result.category || '장소'})</span>
              <span className="sp-over-fact-value location">
                {result.location}
              </span>
            </div>
            <p className="sp-over-reason">
              {SP_REASON_LABEL[result.reason]}
              {reasonDetail && (
                <span className="sp-over-reason-detail"> · {reasonDetail}</span>
              )}
            </p>
          </div>
        )}

        <ul className="sp-over-roster">
          {game.players.map((p) => (
            <li key={p.seat} className="sp-over-row">
              <span className="sp-over-name">
                {p.name}
                {p.seat === game.yourSeat && ' (나)'}
                {p.bot && ' 🤖'}
              </span>
              {result && p.seat === result.spySeat && (
                <span className="sp-over-spy-chip">🕵️ 스파이</span>
              )}
            </li>
          ))}
        </ul>

        {roomCode && (
          // 전체 리로드 + ?room 프리필 — 같은 코드로 다시 join 하면 관대한
          // 생성으로 같은 코드의 새 대기실이 열린다 (기존 흐름 재사용)
          <button
            type="button"
            className="sp-primary-button"
            onClick={() => {
              window.location.href = `${window.location.pathname}?room=${roomCode}`;
            }}
          >
            🔄 같은 방에서 재대결
          </button>
        )}
        <button
          type="button"
          className="sp-primary-button"
          onClick={onFindNewGame}
        >
          새 게임 찾기
        </button>
      </div>
    </div>
  );
}
