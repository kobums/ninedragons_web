import type {
  CTGameOverPayload,
  CTGameState,
  CTPlayerView,
  CTResultRow,
} from '../../types/citadels';
import {
  CT_BONUS_COMPLETE,
  CT_BONUS_FIRST,
  CT_BONUS_RAINBOW,
  CT_CITY_GOAL,
  CT_COLORS,
  ctBuiltValue,
  ctColorLabel,
  ctHasAllColors,
} from '../../types/citadels';
import { CitadelsSwatch } from './CitadelsBoard';
import './CitadelsGameOver.css';

interface CitadelsGameOverProps {
  // 마지막 스냅샷 (phase 'game_over')
  game: CTGameState;
  // ct_game_over 페이로드 — 신호+승자 보조 (없으면 스냅샷 result 로 그린다)
  result: CTGameOverPayload | null;
  // 사설 방 코드 — 있으면 같은 방 재대결 버튼을 보여준다 (공용 로비는 ''/생략)
  roomCode?: string;
  onFindNewGame: () => void;
}

// 승점 내림차순 → 동점이면 건물 수가 많은 쪽이 앞 (공식 타이브레이크)
function rank(a: CTPlayerView, b: CTPlayerView): number {
  if (b.score !== a.score) return b.score - a.score;
  return (b.built ?? []).length - (a.built ?? []).length;
}

export function CitadelsGameOver({
  game,
  result,
  roomCode,
  onFindNewGame,
}: CitadelsGameOverProps) {
  const players = [...(game.players ?? [])].sort(rank);
  const snap = game.result ?? null;
  const winnerSeats = snap?.winnerSeats ?? result?.winnerSeats ?? [];
  const winnerNames = snap?.winnerNames ?? result?.winnerNames ?? [];
  const rows: CTResultRow[] = snap?.rows ?? result?.rows ?? [];
  const message = snap?.message ?? result?.message ?? '';

  const isWinner = (seat: number) => winnerSeats.includes(seat);
  const youWon = game.yourSeat >= 0 && isWinner(game.yourSeat);
  const isSpectator = game.yourSeat < 0;

  // 서버가 보낸 점수 내역 문구 — 없으면 화면에서 조립한다
  const detailOf = (p: CTPlayerView): string => {
    const row = rows.find((r) => r.seat === p.seat);
    if (row?.detail) return row.detail;
    const parts = [`건물값 ${ctBuiltValue(p.built)}`];
    if (ctHasAllColors(p.built)) parts.push(`다섯 색 +${CT_BONUS_RAINBOW}`);
    if ((p.built ?? []).length >= CT_CITY_GOAL) {
      parts.push(
        isWinner(p.seat)
          ? `먼저 완성 +${CT_BONUS_FIRST}`
          : `완성 +${CT_BONUS_COMPLETE}`,
      );
    }
    return parts.join(' · ');
  };

  const scoreOf = (p: CTPlayerView): number =>
    rows.find((r) => r.seat === p.seat)?.score ?? p.score;

  const title =
    winnerNames.length > 1
      ? `🤝 공동 승리 — ${winnerNames.join(' · ')}`
      : winnerNames.length === 1
        ? `🏆 ${winnerNames[0]} 승리`
        : '게임 종료';

  return (
    <div className="ct-game-over">
      <div className="ct-game-over-container">
        <span className="ct-over-mark">🏰</span>
        <h1 className="ct-over-title">{title}</h1>
        <p className="ct-over-sub">
          {message ||
            `건물 ${CT_CITY_GOAL}채 완성으로 마지막 라운드까지 진행하고 끝났습니다`}
        </p>
        {!isSpectator && winnerSeats.length > 0 && (
          <p className={`ct-over-verdict ${youWon ? 'win' : 'lose'}`}>
            {youWon ? '🏆 당신이 이겼습니다' : '당신이 졌습니다'}
          </p>
        )}

        {/* 승점 순위 — 동점은 건물 수가 많은 쪽이 앞선다 */}
        <div className="ct-over-table-wrap">
          <table className="ct-over-table">
            <thead>
              <tr>
                <th className="left">순위</th>
                <th className="left">이름</th>
                <th>승점</th>
                <th>건물</th>
                <th>금화</th>
              </tr>
            </thead>
            <tbody>
              {players.map((p, i) => (
                <tr
                  key={p.seat}
                  className={isWinner(p.seat) ? 'winner' : undefined}
                >
                  <td className="left ct-over-place">{i + 1}위</td>
                  <td className="left">
                    <span className="ct-over-name">
                      {p.name}
                      {p.seat === game.yourSeat && ' (나)'}
                      {p.bot && ' 🤖'}
                    </span>
                  </td>
                  <td className="ct-over-score">{scoreOf(p)}</td>
                  <td>
                    {(p.built ?? []).length}/{CT_CITY_GOAL}
                  </td>
                  <td>{p.gold}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 점수 내역 — 건물값 합 + 보너스 3종이 어떻게 붙었는지 */}
        <div className="ct-over-details">
          {players.map((p) => (
            <div key={p.seat} className="ct-over-detail-row">
              <span className="ct-over-detail-name">{p.name}</span>
              <span className="ct-over-detail-text">{detailOf(p)}</span>
              <span className="ct-over-detail-colors">
                {CT_COLORS.map((c) => {
                  const count = (p.built ?? []).filter(
                    (b) => b.color === c,
                  ).length;
                  return (
                    <span
                      key={c}
                      className={`ct-over-color ${count > 0 ? 'have' : 'none'}`}
                      title={`${ctColorLabel(c)} ${count}채`}
                    >
                      <CitadelsSwatch color={c} size={13} />
                      <span>{count}</span>
                    </span>
                  );
                })}
              </span>
            </div>
          ))}
        </div>

        <p className="ct-over-legend">
          승점 = 건물값 합 + {CT_CITY_GOAL}채 먼저 완성 {CT_BONUS_FIRST} +{' '}
          {CT_CITY_GOAL}채 완성(1등 외) {CT_BONUS_COMPLETE} + 다섯 색 모두 갖춤{' '}
          {CT_BONUS_RAINBOW}
        </p>

        {roomCode && (
          // 전체 리로드 + ?room 프리필 — 같은 코드로 다시 join 하면 관대한
          // 생성으로 같은 코드의 새 대기실이 열린다 (기존 흐름 재사용)
          <button
            type="button"
            className="ct-primary-button"
            onClick={() => {
              window.location.href = `${window.location.pathname}?room=${roomCode}`;
            }}
          >
            🔄 같은 방에서 재대결
          </button>
        )}
        <button
          type="button"
          className="ct-primary-button"
          onClick={onFindNewGame}
        >
          새 게임 찾기
        </button>
      </div>
    </div>
  );
}
