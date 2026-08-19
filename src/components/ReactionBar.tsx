// 리액션 이모지 바 — 우하단 고정, 기본 접힘(😊) → 6종 펼침, 탭하면 발신 후 접힘.
// 게임·대기실 화면에서 표시하고, 관전자(yourSeat -1)에게는 셸에서 렌더하지 않는다.
import { useState } from 'react';
import './ReactionBar.css';

// 서버 화이트리스트와 1:1 — 구성이 바뀌면 서버 react 헬퍼와 함께 바꿔야 한다
export const REACTION_EMOJIS = ['👍', '👎', '😂', '😮', '🔥', '😭'] as const;

interface ReactionBarProps {
  onReact: (emoji: string) => void;
}

export function ReactionBar({ onReact }: ReactionBarProps) {
  const [open, setOpen] = useState(false);

  const handlePick = (emoji: string) => {
    onReact(emoji);
    setOpen(false);
  };

  return (
    <div className="reaction-bar">
      {open && (
        <div className="reaction-bar-panel">
          {REACTION_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className="reaction-bar-emoji"
              onClick={() => handlePick(emoji)}
              aria-label={`리액션 ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
      <button
        type="button"
        className={`reaction-bar-toggle ${open ? 'open' : ''}`}
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-label={open ? '리액션 닫기' : '리액션 보내기'}
      >
        {open ? '✕' : '😊'}
      </button>
    </div>
  );
}
