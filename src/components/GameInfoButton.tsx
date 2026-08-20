import { useState } from 'react';
import { GAMES } from '../config/games';
import type { GameId } from '../config/games';
import './GameInfoButton.css';

interface GameInfoButtonProps {
  game: GameId;
}

// 모든 게임 화면 우상단에 떠 있는 ⓘ 버튼. 누르면 룰 요약 팝업이 열린다.
export function GameInfoButton({ game }: GameInfoButtonProps) {
  const [open, setOpen] = useState(false);
  const meta = GAMES[game];

  return (
    <>
      <button
        type="button"
        className="game-info-fab"
        aria-label="게임 방법 보기"
        onClick={() => setOpen(true)}
      >
        i
      </button>

      {open && (
        <div className="game-info-overlay" onClick={() => setOpen(false)}>
          <div
            className={`game-info-modal ${meta.mood}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="game-info-header">
              <div>
                <span className="game-info-eyebrow">How to Play</span>
                <h2>{meta.title}</h2>
              </div>
              <button
                type="button"
                className="game-info-close"
                aria-label="닫기"
                onClick={() => setOpen(false)}
              >
                ×
              </button>
            </div>
            <div className="game-info-body">
              {meta.rules.map((section, i) => (
                <section key={i}>
                  {section.heading && <h3>{section.heading}</h3>}
                  <ul>
                    {section.items.map((item, j) => (
                      <li key={j}>{item}</li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
