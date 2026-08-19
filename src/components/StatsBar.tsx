import { useEffect, useState } from 'react';
import { GAMES } from '../config/games';
import type { GameId } from '../config/games';
import { buildStatsUrl } from '../utils/ws';
import './StatsBar.css';

interface StatsData {
  total: number;
  perGame: { game: string; count: number }[];
}

interface StatsBarProps {
  // 있으면 바 전체가 전적 페이지 진입 버튼이 된다 (표시는 기존 그대로)
  onOpen?: () => void;
}

// 게임 선택 화면 하단의 가벼운 전적 표시.
// 통계는 재미 요소 — 실패하면 조용히 숨긴다.
export function StatsBar({ onOpen }: StatsBarProps) {
  const [data, setData] = useState<StatsData | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(buildStatsUrl())
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!cancelled && json && json.total > 0) setData(json);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!data) return null;

  const top = data.perGame.slice(0, 3);
  const content = (
    <>
      <span className="stats-total">지금까지 {data.total.toLocaleString()}판</span>
      {top.length > 0 && (
        <span className="stats-top">
          인기:{' '}
          {top
            .map((g) => `${GAMES[g.game as GameId]?.title ?? g.game} ${g.count}판`)
            .join(' · ')}
        </span>
      )}
    </>
  );

  // 진입 탭 힌트 — 표시 내용은 그대로, 탭하면 전적 페이지로 간다
  if (onOpen) {
    return (
      <button type="button" className="stats-bar stats-bar-link" onClick={onOpen}>
        {content}
        <span className="stats-open-hint">전적 보기 ›</span>
      </button>
    );
  }

  return <div className="stats-bar">{content}</div>;
}
