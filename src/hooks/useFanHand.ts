import { useLayoutEffect, useRef } from 'react';

// 손패 부채(수평 겹침) 레이아웃 — 컨테이너 폭과 장수에 맞춰 카드 겹침 폭을
// 실측 계산해, 몇 장이든 항상 1열을 보장한다.
//
// 사용법: 반환된 ref 를 손패 컨테이너에 달고, 컨테이너 CSS 에
//   .hand > *:not(:first-child) { margin-left: var(--fan-ml, 6px); }
// 규칙을 추가한다. 공간이 넉넉하면 +6px 간격(펼침), 모자라면 음수
// 마진(겹침)이 된다. 카드 판독은 좌상단 모서리 인덱스가 담당한다.
export function useFanHand(count: number) {
  const ref = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const compute = () => {
      const first = el.children[0] as HTMLElement | undefined;
      if (!first || count <= 1) {
        el.style.setProperty('--fan-ml', '6px');
        return;
      }
      const cardW = first.offsetWidth;
      // 여유 버퍼 8px — 문양 구분 마진 등 자잘한 추가 폭 흡수
      const avail = el.clientWidth - 8;
      const spacing = Math.min(cardW + 6, (avail - cardW) / (count - 1));
      el.style.setProperty(
        '--fan-ml',
        `${Math.round((spacing - cardW) * 10) / 10}px`,
      );
    };

    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [count]);

  return ref;
}
