// 리액션 팝 오버레이 — react 이벤트({kind:'react', seat, name, message:이모지})를
// 셸이 useReactions 훅으로 모아 넘기면 화면 중앙 상단에 "이름 + 큰 이모지"를
// 1.8초 팝 애니메이션으로 띄운다 (최대 3개 동시 스택 — 훅이 관리).
import './ReactionOverlay.css';

export interface ReactionPop {
  id: number;
  name: string;
  emoji: string;
}

interface ReactionOverlayProps {
  pops: ReactionPop[];
}

export function ReactionOverlay({ pops }: ReactionOverlayProps) {
  if (pops.length === 0) return null;

  return (
    <div className="reaction-overlay" aria-live="polite">
      {pops.map((pop) => (
        <div key={pop.id} className="reaction-pop">
          <span className="reaction-pop-emoji">{pop.emoji}</span>
          {pop.name && <span className="reaction-pop-name">{pop.name}</span>}
        </div>
      ))}
    </div>
  );
}
