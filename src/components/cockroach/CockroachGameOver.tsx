import type {
  CRGameOverPayload,
  CRGameState,
} from '../../types/cockroach';
import { crLoseReasonText } from '../../types/cockroach';
import { CRDisplayGrid } from './CockroachBoard';
import './CockroachGameOver.css';

interface CockroachGameOverProps {
  // 마지막 스냅샷 (phase 'game_over' — loserSeat/loseReason 포함)
  game: CRGameState;
  // cr_game_over 페이로드 (없으면 스냅샷에서 패자를 읽는다)
  result: CRGameOverPayload | null;
  // 사설 방 코드 — 있으면 같은 방 재대결 버튼을 보여준다 (공용 로비는 ''/생략)
  roomCode?: string;
  onFindNewGame: () => void;
}

// 패자 1인 · 나머지 전원 승리 — 패자를 강조해 그린다.
export function CockroachGameOver({
  game,
  result,
  roomCode,
  onFindNewGame,
}: CockroachGameOverProps) {
  const players = game.players ?? [];

  // 패자 — 스냅샷 우선, 없으면(-1) 페이로드 보조
  const loserSeat =
    game.loserSeat >= 0 ? game.loserSeat : (result?.loserSeat ?? -1);
  const loser = players.find((p) => p.seat === loserSeat);
  const loserName = loser?.name ?? result?.loserName ?? '?';

  const reasonLabel = crLoseReasonText(
    game.loseReason ?? result?.loseReason,
  );
  const reasonSentence =
    reasonLabel === '같은 동물 4장'
      ? '진열에 같은 동물 4장이 모여 패배했습니다'
      : reasonLabel === '손패 소진'
        ? '차례인데 건넬 손패가 없어 패배했습니다'
        : reasonLabel
          ? `패배 사유: ${reasonLabel}`
          : '';

  const winners = players.filter((p) => p.seat !== loserSeat);
  const youLost = game.yourSeat >= 0 && game.yourSeat === loserSeat;

  // 패자를 맨 위에 — 이 게임의 결과는 "누가 졌는가" 하나다
  const ordered = [
    ...players.filter((p) => p.seat === loserSeat),
    ...players.filter((p) => p.seat !== loserSeat),
  ];

  return (
    <div className="cr-game-over">
      <div className="cr-game-over-container">
        <span className="cr-over-mark">🪳</span>
        <h1 className="cr-over-title">{loserName}님의 패배</h1>
        {reasonLabel && (
          <span className="cr-over-reason-badge">{reasonLabel}</span>
        )}
        <p className="cr-over-sub">
          {result?.message ?? reasonSentence ?? ''}
          {winners.length > 0 &&
            ` — 나머지 ${winners.length}명 전원 승리`}
        </p>
        {game.yourSeat >= 0 && (
          <p className={`cr-over-verdict ${youLost ? 'lose' : 'win'}`}>
            {youLost
              ? '💥 내가 패배했습니다…'
              : '🏆 승리했습니다!'}
          </p>
        )}

        {/* 최종 진열 — 패자 강조, 전원 공개 */}
        <ul className="cr-over-list">
          {ordered.map((p) => {
            const isLoser = p.seat === loserSeat;
            return (
              <li
                key={p.seat}
                className={`cr-over-row ${isLoser ? 'loser' : ''}`}
              >
                <div className="cr-over-row-head">
                  <span className="cr-over-name">
                    {isLoser ? '💥 ' : '👑 '}
                    {p.name}
                    {p.seat === game.yourSeat && ' (나)'}
                    {p.bot && ' 🤖'}
                  </span>
                  <span className="cr-over-handcount">
                    손패 {p.handCount}장
                  </span>
                </div>
                <CRDisplayGrid display={p.display ?? {}} />
              </li>
            );
          })}
        </ul>

        {roomCode && (
          // 전체 리로드 + ?room 프리필 — 같은 코드로 다시 join 하면 관대한
          // 생성으로 같은 코드의 새 대기실이 열린다 (기존 흐름 재사용)
          <button
            type="button"
            className="cr-primary-button"
            onClick={() => {
              window.location.href = `${window.location.pathname}?room=${roomCode}`;
            }}
          >
            🔄 같은 방에서 재대결
          </button>
        )}
        <button
          type="button"
          className="cr-primary-button"
          onClick={onFindNewGame}
        >
          새 게임 찾기
        </button>
      </div>
    </div>
  );
}
