import { useEffect, useState } from 'react';
import { GAMES } from '../../config/games';
import type { GameId } from '../../config/games';
import { fetchStats, formatDuration, formatRelativeTime, winRate } from './stats';
import type { MatchRecord, PlayerDetail, PlayerRow, StatsResponse } from './stats';
import './RecordsPage.css';

// 레지스트리에 없는 game 키는 그대로 표기 (구버전 기록 호환)
const gameTitle = (game: string): string => GAMES[game as GameId]?.title ?? game;

type RecordsTab = 'summary' | 'recent' | 'players';

const TAB_LABEL: Record<RecordsTab, string> = {
  summary: '종합',
  recent: '최근 경기',
  players: '플레이어',
};

interface RecordsPageProps {
  onBack: () => void;
}

// 전적 페이지 — 종합·최근 경기·플레이어 3탭. 통계는 재미 요소이므로
// 로딩·실패 시에도 조용한 안내 문구만 보여준다.
export function RecordsPage({ onBack }: RecordsPageProps) {
  const [tab, setTab] = useState<RecordsTab>('summary');
  const [data, setData] = useState<StatsResponse | null>(null);
  const [failed, setFailed] = useState(false);

  // 플레이어 상세 — 이름 선택 시 ?player= 로 재조회한다
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [detail, setDetail] = useState<PlayerDetail | null>(null);
  const [detailFailed, setDetailFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchStats()
      .then((json) => {
        if (cancelled) return;
        if (json) setData(json);
        else setFailed(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedPlayer) return;
    let cancelled = false;
    setDetail(null);
    setDetailFailed(false);
    fetchStats(selectedPlayer)
      .then((json) => {
        if (cancelled) return;
        if (json?.playerDetail) setDetail(json.playerDetail);
        else setDetailFailed(true);
      })
      .catch(() => {
        if (!cancelled) setDetailFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedPlayer]);

  return (
    <div className="records-page">
      <div className="records-container">
        <header className="records-header">
          <button type="button" className="rec-back-button" onClick={onBack}>
            ‹ 게임 선택
          </button>
          <span className="records-eyebrow">Match History</span>
          <h1 className="records-title">전적</h1>
        </header>

        <nav className="rec-tabs">
          {(Object.keys(TAB_LABEL) as RecordsTab[]).map((t) => (
            <button
              key={t}
              type="button"
              className={`rec-tab ${tab === t ? 'active' : ''}`}
              onClick={() => setTab(t)}
            >
              {TAB_LABEL[t]}
            </button>
          ))}
        </nav>

        {failed ? (
          <p className="rec-empty">전적을 불러오지 못했습니다.</p>
        ) : !data ? (
          <p className="rec-empty">전적을 불러오는 중…</p>
        ) : (
          <>
            {tab === 'summary' && <SummaryTab data={data} />}
            {tab === 'recent' && (
              <section className="rec-section">
                <MatchList records={data.recent} empty="아직 기록된 경기가 없습니다." />
              </section>
            )}
            {tab === 'players' &&
              (selectedPlayer ? (
                <PlayerDetailView
                  name={selectedPlayer}
                  detail={detail}
                  failed={detailFailed}
                  onBackToList={() => setSelectedPlayer(null)}
                />
              ) : (
                <PlayersTab players={data.players} onSelect={setSelectedPlayer} />
              ))}
          </>
        )}
      </div>
    </div>
  );
}

// ---------- 종합 ----------

function SummaryTab({ data }: { data: StatsResponse }) {
  const max = Math.max(1, ...data.perGame.map((g) => g.count));
  return (
    <section className="rec-section">
      <div className="rec-total">
        <span className="rec-total-number">{data.total.toLocaleString()}</span>
        <span className="rec-total-label">지금까지 플레이된 판수</span>
      </div>

      {data.perGame.length > 0 && (
        <div className="rec-bars">
          {data.perGame.map((g) => (
            <div key={g.game} className="rec-bar-row">
              <span className="rec-bar-name">{gameTitle(g.game)}</span>
              <div className="rec-bar-track">
                <div
                  className="rec-bar-fill"
                  style={{ width: `${Math.max(2, (g.count / max) * 100)}%` }}
                />
              </div>
              <span className="rec-bar-count">{g.count}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ---------- 경기 리스트 (최근 탭 · 플레이어 상세 공용) ----------

function MatchList({ records, empty }: { records: MatchRecord[]; empty: string }) {
  if (records.length === 0) return <p className="rec-empty">{empty}</p>;
  return (
    <ul className="rec-matches">
      {records.map((r, i) => (
        <li key={`${r.playedAt}-${i}`} className="rec-match">
          <div className="rec-match-top">
            <span className="rec-match-game">{gameTitle(r.game)}</span>
            {r.bot && <span className="rec-match-bot">🤖 봇전</span>}
            <span className="rec-match-time">{formatRelativeTime(r.playedAt)}</span>
          </div>
          <p className="rec-match-players">{r.players}</p>
          <div className="rec-match-bottom">
            <span className="rec-match-winner">
              {r.winner ? (
                <>
                  승자 <strong>{r.winner}</strong>
                </>
              ) : (
                '무승부'
              )}
            </span>
            <span className="rec-match-duration">{formatDuration(r.durationSec)}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

// ---------- 플레이어 ----------

function PlayersTab({
  players,
  onSelect,
}: {
  players?: PlayerRow[];
  onSelect: (name: string) => void;
}) {
  const [query, setQuery] = useState('');

  if (!players || players.length === 0) {
    return <p className="rec-empty">아직 플레이어 집계가 없습니다.</p>;
  }

  const q = query.trim();
  const filtered = q ? players.filter((p) => p.name.includes(q)) : players;

  return (
    <section className="rec-section">
      <form
        className="rec-search"
        onSubmit={(e) => {
          e.preventDefault();
          if (q) onSelect(q);
        }}
      >
        <input
          className="rec-search-input"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="닉네임 검색 (엔터 = 상세 조회)"
          maxLength={20}
        />
      </form>

      <div className="rec-player-table">
        <div className="rec-player-row rec-player-head">
          <span className="rec-player-name">이름</span>
          <span>판수</span>
          <span>승</span>
          <span>승률</span>
        </div>
        {filtered.map((p) => (
          <button
            key={p.name}
            type="button"
            className="rec-player-row"
            onClick={() => onSelect(p.name)}
          >
            <span className="rec-player-name">{p.name}</span>
            <span>{p.plays}</span>
            <span>{p.wins}</span>
            <span>{winRate(p)}%</span>
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="rec-empty">
            목록에 없는 닉네임입니다 — 엔터로 직접 조회할 수 있습니다.
          </p>
        )}
      </div>
    </section>
  );
}

function PlayerDetailView({
  name,
  detail,
  failed,
  onBackToList,
}: {
  name: string;
  detail: PlayerDetail | null;
  failed: boolean;
  onBackToList: () => void;
}) {
  return (
    <section className="rec-section">
      <button type="button" className="rec-list-back" onClick={onBackToList}>
        ‹ 플레이어 목록
      </button>
      <h2 className="rec-player-title">{name}</h2>

      {failed ? (
        <p className="rec-empty">전적을 불러오지 못했습니다.</p>
      ) : !detail ? (
        <p className="rec-empty">전적을 불러오는 중…</p>
      ) : detail.plays === 0 ? (
        <p className="rec-empty">아직 기록이 없는 닉네임입니다.</p>
      ) : (
        <>
          <div className="rec-player-summary">
            <div className="rec-stat">
              <strong>{detail.plays}</strong>
              <span>판</span>
            </div>
            <div className="rec-stat">
              <strong>{detail.wins}</strong>
              <span>승</span>
            </div>
            <div className="rec-stat">
              <strong>{detail.draws}</strong>
              <span>무</span>
            </div>
            <div className="rec-stat">
              <strong>{winRate(detail)}%</strong>
              <span>승률</span>
            </div>
          </div>

          {detail.perGame.length > 0 && (
            <>
              <h3 className="rec-subhead">게임별 성적</h3>
              <div className="rec-pergame">
                {detail.perGame.map((g) => (
                  <div key={g.game} className="rec-pergame-row">
                    <span className="rec-pergame-name">{gameTitle(g.game)}</span>
                    <span className="rec-pergame-count">
                      {g.plays}판 <strong>{g.wins}승</strong>
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          <h3 className="rec-subhead">최근 경기</h3>
          <MatchList records={detail.recent} empty="최근 경기가 없습니다." />
        </>
      )}
    </section>
  );
}
