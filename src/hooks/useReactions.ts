import { useEffect, useRef, useState } from 'react';
import type { ReactionPop } from '../components/ReactionOverlay';

// 모든 게임 메시지가 만족하는 최소 형태 — 각 게임의 {P}Message 가 그대로 들어온다
interface WireMessage {
  type: string;
  payload?: unknown;
}

// 동시 표시 최대 개수 / 팝 수명(ms) — ReactionOverlay.css 애니메이션과 맞춘다
const MAX_POPS = 3;
const POP_MS = 1800;

// {prefix}_event 중 kind === 'react' 만 골라 팝 목록으로 만든다.
// 각 게임 훅의 토스트 경로에서는 react 를 걸러내고(TOAST_SKIP),
// 셸이 이 훅으로 lastMessage 를 직접 감시해 ReactionOverlay 에 공급한다.
export function useReactions(
  lastMessage: WireMessage | null,
  eventType: string,
): ReactionPop[] {
  const [pops, setPops] = useState<ReactionPop[]>([]);
  const idRef = useRef(0);

  useEffect(() => {
    if (!lastMessage || lastMessage.type !== eventType) return;
    const event = lastMessage.payload as
      | { kind?: string; seat?: number; name?: string; message?: string }
      | undefined;
    if (event?.kind !== 'react' || !event.message) return;

    idRef.current += 1;
    const id = idRef.current;
    const pop: ReactionPop = { id, name: event.name ?? '', emoji: event.message };
    setPops((prev) => [...prev.slice(-(MAX_POPS - 1)), pop]);
    setTimeout(() => {
      setPops((prev) => prev.filter((p) => p.id !== id));
    }, POP_MS);
  }, [lastMessage, eventType]);

  return pops;
}
