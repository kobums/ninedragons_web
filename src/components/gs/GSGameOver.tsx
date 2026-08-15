import { useState } from 'react';
import { useRematchCountdown } from '../../hooks/useRematchCountdown';
import type { GSGameOver as GSGameOverPayload, GSSide } from '../../types/geister';
import './GSGameOver.css';

const REASON_LABEL: Record<GSGameOverPayload['reason'], string> = {
  escape: '좋은 유령 탈출',
  captured_all_good: '좋은 유령을 모두 잡음',
  fed_all_evil: '나쁜 유령을 모두 먹임',
};

interface GSGameOverProps {
  result: GSGameOverPayload;
  yourSide: GSSide | null;
  onPlayAgain: () => void;
  rematchOffered: boolean;
  onRematch: () => void;
}

export function GSGameOver({
  result,
  yourSide,
  onPlayAgain,
  rematchOffered,
  onRematch,
}: GSGameOverProps) {
  const [requested, setRequested] = useState(false);
  // 서버의 재대결 창(60초)에 맞춘 남은 시간
  const { secondsLeft, expired } = useRematchCountdown();

  const youWon = yourSide !== null && result.winner === yourSide;

  return (
    <div className="gs-game-over">
      <div className="gs-over-container">
        <h1 className="gs-over-title">{youWon ? '🏆 승리!' : '패배...'}</h1>
        <p className="gs-over-reason">
          <strong>{result.winnerName}</strong>님 승리 — {REASON_LABEL[result.reason]}
        </p>

        <div className="gs-over-summary">
          {(['south', 'north'] as GSSide[]).map((side) => (
            <div key={side} className="gs-over-side">
              <span className="gs-over-side-label">
                {side === yourSide ? '나' : '상대'}
              </span>
              <div className="gs-over-ghosts">
                {result.ghosts
                  .filter((g) => g.side === side)
                  .map((g) => (
                    <span
                      key={g.id}
                      className={[
                        'gs-over-ghost',
                        g.good ? 'good' : 'evil',
                        g.captured ? 'captured' : '',
                        g.escaped ? 'escaped' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      👻
                    </span>
                  ))}
              </div>
            </div>
          ))}
        </div>

        {rematchOffered && !requested && !expired && (
          <p className="gs-rematch-offer">상대가 재대결을 원합니다!</p>
        )}
        <button
          type="button"
          className="gs-action-button"
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
          <p className="gs-rematch-countdown">재대결 가능 시간 {secondsLeft}초</p>
        )}
        <button type="button" className="gs-secondary-button" onClick={onPlayAgain}>
          새 게임 찾기
        </button>
      </div>
    </div>
  );
}
