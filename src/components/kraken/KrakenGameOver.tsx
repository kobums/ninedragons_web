import type {
  KRGameOverPayload,
  KRGameState,
  KRReason,
} from '../../types/kraken';
import {
  KR_CARD_ICON,
  KR_ROLE_ICON,
  KR_ROLE_LABEL,
  KR_TOTAL_ROUNDS,
} from '../../types/kraken';
import './KrakenGameOver.css';

interface KrakenGameOverProps {
  // 마지막 스냅샷 (phase 'game_over' — 전원 역할 공개 상태)
  game: KRGameState;
  // kr_game_over 페이로드 — 신호+승자 보조 (없으면 스냅샷 result 로 그린다)
  result: KRGameOverPayload | null;
  // 사설 방 코드 — 있으면 같은 방 재대결 버튼을 보여준다 (공용 로비는 ''/생략)
  roomCode?: string;
  onFindNewGame: () => void;
}

const REASON_TEXT: Record<KRReason, string> = {
  kraken: '🐙 크라켄이 열렸습니다',
  all_treasure: '💎 보물을 전부 찾아냈습니다',
  timeout: `⏳ ${KR_TOTAL_ROUNDS}라운드가 모두 끝났습니다`,
};

// 단판 승부 결과 오버레이 — 사설 방이면 같은 방 재대결, 아니면 "새 게임 찾기"만.
export function KrakenGameOver({
  game,
  result,
  roomCode,
  onFindNewGame,
}: KrakenGameOverProps) {
  const players = game.players ?? [];
  const snap = game.result ?? null;
  const winner = snap?.winner ?? result?.winner ?? null;
  const reason = snap?.reason ?? result?.reason ?? null;
  const myRole = game.yourRole ?? '';
  const found = game.found ?? { treasure: 0, treasureTotal: 0, kraken: 0 };

  const title =
    winner === 'expedition'
      ? '🗺 탐험대 승리'
      : winner === 'skeleton'
        ? '💀 해골 승리'
        : '게임 종료';

  const youWon =
    myRole !== '' && winner !== null && (winner === 'skeleton') === (myRole === 'skeleton');

  const message =
    snap?.message ??
    result?.message ??
    (reason ? REASON_TEXT[reason] : '게임이 종료되었습니다');

  return (
    <div className="kr-scope kr-game-over">
      <div className="kr-game-over-container">
        <h1 className={`kr-over-title ${winner ?? 'none'}`}>{title}</h1>
        <p className="kr-over-message">{message}</p>
        {reason && snap?.message && (
          <p className="kr-over-reason">{REASON_TEXT[reason]}</p>
        )}
        {myRole !== '' && winner !== null && (
          <p className={`kr-over-verdict ${youWon ? 'win' : 'lose'}`}>
            {youWon ? '🏆 당신이 이겼습니다' : '당신이 졌습니다'}
          </p>
        )}

        {/* 최종 공개 진척 */}
        <div className="kr-over-found">
          <span className="kr-over-found-item">
            {KR_CARD_ICON.treasure} 보물 {found.treasure}/{found.treasureTotal}
          </span>
          <span className="kr-over-found-item">
            {KR_CARD_ICON.kraken} 크라켄{' '}
            {found.kraken > 0 ? '공개됨' : '끝까지 숨겨짐'}
          </span>
          <span className="kr-over-found-item">
            라운드 {Math.min(game.round, KR_TOTAL_ROUNDS)}/{KR_TOTAL_ROUNDS}
          </span>
        </div>

        {/* 전원 역할 공개 */}
        <ul className="kr-over-roster">
          {players.map((p) => {
            const role = p.role ?? '';
            return (
              <li key={p.seat} className="kr-over-row">
                <span className="kr-over-name">
                  {p.name}
                  {p.seat === game.yourSeat && ' (나)'}
                  {p.bot && ' 🤖'}
                </span>
                {role !== '' && (
                  <span className={`kr-over-role role-${role}`}>
                    {KR_ROLE_ICON[role]} {KR_ROLE_LABEL[role]}
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
            className="kr-primary-button"
            onClick={() => {
              window.location.href = `${window.location.pathname}?room=${roomCode}`;
            }}
          >
            🔄 같은 방에서 재대결
          </button>
        )}
        <button
          type="button"
          className="kr-primary-button"
          onClick={onFindNewGame}
        >
          새 게임 찾기
        </button>
      </div>
    </div>
  );
}
