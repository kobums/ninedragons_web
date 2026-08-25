import { useState } from 'react';
import { useRematchCountdown } from '../../hooks/useRematchCountdown';
import type { OmokGameOver as OmokGameOverPayload, OmokGameState } from '../../types/omok';
import { OmokGrid } from './OmokBoard';
import './OmokGameOver.css';

const REASON_LABEL: Record<OmokGameOverPayload['reason'], string> = {
  five: '오목 완성',
  draw: '판이 가득 참 (225수 소진)',
  forfeit: '상대 이탈',
};

interface OmokGameOverProps {
  result: OmokGameOverPayload;
  // 마지막 국면 — 승리 5목 하이라이트를 보드째 보여준다
  game: OmokGameState | null;
  onPlayAgain: () => void;
  rematchOffered: boolean;
  onRematch: () => void;
}

export function OmokGameOver({
  result,
  game,
  onPlayAgain,
  rematchOffered,
  onRematch,
}: OmokGameOverProps) {
  const [requested, setRequested] = useState(false);
  // 서버의 재대결 창(60초)에 맞춘 남은 시간
  const { secondsLeft, expired } = useRematchCountdown();

  const isDraw = result.winner === '';
  const youWon = !isDraw && game !== null && result.winner === game.yourColor;

  return (
    <div className="omok-game-over">
      <div className="omok-over-layout">
        {game && (
          <OmokGrid
            board={game.board}
            lastMove={game.lastMove}
            winLine={result.line}
            canPlay={false}
          />
        )}

        <div className="omok-over-container">
          <h1 className="omok-over-title">
            {isDraw ? '무승부' : youWon ? '🏆 승리!' : '패배...'}
          </h1>
          <p className="omok-over-reason">
            {isDraw ? (
              REASON_LABEL.draw
            ) : (
              <>
                <strong>{result.winnerName}</strong>님 승리 — {REASON_LABEL[result.reason]}
              </>
            )}
          </p>

          {rematchOffered && !requested && !expired && (
            <p className="omok-rematch-offer">상대가 재대결을 원합니다!</p>
          )}
          <button
            type="button"
            className="omok-action-button"
            disabled={requested || expired}
            onClick={() => {
              setRequested(true);
              onRematch();
            }}
          >
            {expired
              ? '재대결 시간 만료'
              : requested
                ? '상대 수락 대기 중...'
                : rematchOffered
                  ? '🔁 재대결 수락'
                  : '🔁 재대결 신청'}
          </button>
          {!expired && (
            <p className="omok-rematch-countdown">재대결 가능 시간 {secondsLeft}초</p>
          )}
          <button type="button" className="omok-secondary-button" onClick={onPlayAgain}>
            새 게임 찾기
          </button>
        </div>
      </div>
    </div>
  );
}
