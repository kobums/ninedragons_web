import { useEffect, useState } from 'react';
import { GAMES } from '../config/games';
import type { GameId } from '../config/games';
import { buildStatsUrl } from '../utils/ws';
import './StatsBar.css';

interface StatsData {
  total: number;
  perGame: { game: string; count: number }[];
}

// 게임 선택 화면 하단의 가벼운 전적 표시.
// 통계는 재미 요소 — 실패하면 조용히 숨긴다.
export function StatsBar() {
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
  return (
    <div className="stats-bar">
      <span className="stats-total">지금까지 {data.total.toLocaleString()}판</span>
      {top.length > 0 && (
        <span className="stats-top">
          인기:{' '}
          {top
            .map((g) => `${GAMES[g.game as GameId]?.title ?? g.game} ${g.count}판`)
            .join(' · ')}
        </span>
      )}
    </div>
  );
}
