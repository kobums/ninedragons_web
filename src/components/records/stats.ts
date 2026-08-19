// /records 페이지 전용 — /stats 응답 타입과 fetch·표기 유틸.
// total/perGame/recent 는 기존 서버 응답 그대로(StatsBar 와 동일 경로),
// players/playerDetail 은 /stats 확장 계약 — 구버전 서버는 생략하므로
// 옵셔널로 받고 없으면 조용히 안내만 한다.
import { buildStatsUrl } from '../../utils/ws';

export interface StatsGameCount {
  game: string;
  count: number;
}

// 서버 MatchRecord 와 동일 (JSONL 한 줄 = 한 판)
export interface MatchRecord {
  game: string;
  // 참가자 표시용 원문 ("A vs B" 또는 쉼표 구분) — 파싱은 서버 몫
  players: string;
  // 승자 닉네임 (팀전은 복수 표기 가능), '' = 무승부
  winner: string;
  reason: string;
  durationSec: number;
  bot: boolean;
  // ISO 8601
  playedAt: string;
}

export interface PlayerRow {
  name: string;
  plays: number;
  wins: number;
  draws: number;
}

export interface PlayerGameAgg {
  game: string;
  plays: number;
  wins: number;
}

export interface PlayerDetail extends PlayerRow {
  perGame: PlayerGameAgg[];
  recent: MatchRecord[];
}

export interface StatsResponse {
  total: number;
  perGame: StatsGameCount[];
  recent: MatchRecord[];
  // 사람 닉네임만, 판수순 상위 50 (확장 서버)
  players?: PlayerRow[];
  // ?player=NAME 조회 시에만 (없는 닉네임이면 plays 0)
  playerDetail?: PlayerDetail;
}

export async function fetchStats(player?: string): Promise<StatsResponse | null> {
  const url = player
    ? `${buildStatsUrl()}?player=${encodeURIComponent(player)}`
    : buildStatsUrl();
  const res = await fetch(url);
  if (!res.ok) return null;
  return (await res.json()) as StatsResponse;
}

export function winRate(p: { plays: number; wins: number }): number {
  return p.plays > 0 ? Math.round((p.wins / p.plays) * 100) : 0;
}

export function formatDuration(sec: number): string {
  if (sec < 60) return `${sec}초`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s > 0 ? `${m}분 ${s}초` : `${m}분`;
}

// "N분 전 / N시간 전 / M.D" 상대 표기
export function formatRelativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const diffMin = Math.floor((Date.now() - t) / 60000);
  if (diffMin < 1) return '방금 전';
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;
  const d = new Date(t);
  return `${d.getMonth() + 1}.${d.getDate()}`;
}
