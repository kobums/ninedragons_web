import { useEffect, useMemo, useState } from 'react'
import { GAME_CATEGORIES, GAME_IDS, GAMES } from '../config/games'
import type { GameCategory, GameId } from '../config/games'
import { StatsBar } from './StatsBar'
import { buildLobbyUrl } from '../utils/ws'
import './GameSelection.css'

interface GameSelectionProps {
  onSelectGame: (game: GameId) => void
  onOpenRecords: () => void
}

// 인원 필터 선택지 — 2인부터 10인까지. '상관없음'이 기본이다.
const PLAYER_CHOICES = [2, 3, 4, 5, 6, 7, 8, 9, 10]

// 검색어 정규화 — 공백을 지우고 소문자로. "노 땡스"로도 "노 땡스!"가 잡힌다.
const normalize = (s: string) => s.replace(/\s+/g, '').toLowerCase()

export function GameSelection({ onSelectGame, onOpenRecords }: GameSelectionProps) {
  // 상대를 기다리는 사람이 있는 게임 — 15초마다 갱신 (실패하면 조용히 무시)
  const [waiting, setWaiting] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<GameCategory | null>(null)
  const [players, setPlayers] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = () =>
      fetch(buildLobbyUrl())
        .then((res) => (res.ok ? res.json() : null))
        .then((json) => {
          if (!cancelled && json) setWaiting(json.waiting ?? [])
        })
        .catch(() => {})
    load()
    const timer = setInterval(load, 15000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [])

  const visible = useMemo(() => {
    const q = normalize(query)
    return GAME_IDS.filter((id) => {
      const game = GAMES[id]
      if (category && !game.categories.includes(category)) return false
      // 그 인원으로 실제 플레이 가능한 게임만
      if (players && (players < game.minPlayers || players > game.maxPlayers))
        return false
      if (!q) return true
      // 제목·설명·태그·카테고리를 통째로 훑는다 ("주사위"로도 찾힌다)
      const haystack = normalize(
        [game.title, game.description, game.tag, game.categories.join(' ')].join(' ')
      )
      return haystack.includes(q)
    })
  }, [query, category, players])

  const filtered = query !== '' || category !== null || players !== null
  const resetFilters = () => {
    setQuery('')
    setCategory(null)
    setPlayers(null)
  }

  return (
    <div className="game-selection">
      <div className="game-selection-container">
        <header className="game-selection-header">
          <span className="game-selection-eyebrow">
            함께 즐기는 보드게임 {GAME_IDS.length}종
          </span>
          <h1 className="game-selection-title">게임 선택</h1>
          <p className="game-selection-lead">
            검색하거나 갈래·인원으로 좁혀서 골라보세요.
          </p>
        </header>

        <div className="game-filters">
          <div className="game-search">
            <span className="game-search-icon" aria-hidden="true">
              🔍
            </span>
            <input
              type="search"
              className="game-search-input"
              placeholder="게임 이름이나 갈래로 검색"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="게임 검색"
            />
            {query !== '' && (
              <button
                type="button"
                className="game-search-clear"
                onClick={() => setQuery('')}
                aria-label="검색어 지우기"
              >
                ✕
              </button>
            )}
          </div>

          <div className="game-chip-row" role="group" aria-label="갈래 필터">
            <button
              type="button"
              className={`game-chip ${category === null ? 'on' : ''}`}
              onClick={() => setCategory(null)}
            >
              전체
            </button>
            {GAME_CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                className={`game-chip ${category === c ? 'on' : ''}`}
                onClick={() => setCategory(category === c ? null : c)}
              >
                {c}
              </button>
            ))}
          </div>

          <div className="game-chip-row" role="group" aria-label="인원 필터">
            <span className="game-chip-label">인원</span>
            <button
              type="button"
              className={`game-chip small ${players === null ? 'on' : ''}`}
              onClick={() => setPlayers(null)}
            >
              상관없음
            </button>
            {PLAYER_CHOICES.map((n) => (
              <button
                key={n}
                type="button"
                className={`game-chip small ${players === n ? 'on' : ''}`}
                onClick={() => setPlayers(players === n ? null : n)}
              >
                {n}인
              </button>
            ))}
          </div>

          {filtered && (
            <div className="game-filter-summary">
              <span>
                {visible.length}종 / 전체 {GAME_IDS.length}종
              </span>
              <button type="button" className="game-filter-reset" onClick={resetFilters}>
                필터 초기화
              </button>
            </div>
          )}
        </div>

        {visible.length === 0 ? (
          <div className="game-empty">
            <p className="game-empty-title">조건에 맞는 게임이 없습니다.</p>
            <p className="game-empty-hint">
              검색어를 줄이거나 인원 조건을 풀어보세요.
            </p>
            <button type="button" className="game-filter-reset" onClick={resetFilters}>
              필터 초기화
            </button>
          </div>
        ) : (
          <div className="game-cards">
            {visible.map((id) => {
              const game = GAMES[id]
              return (
                <button
                  key={id}
                  type="button"
                  className={`game-card ${game.cardTheme}`}
                  onClick={() => onSelectGame(id)}
                >
                  <div className="game-card-content">
                    {waiting.includes(id) && (
                      <span className="game-card-waiting">👤 상대 대기 중!</span>
                    )}
                    <span className="game-card-tag">{game.tag}</span>
                    <h2>{game.title}</h2>
                    <p className="game-description">{game.description}</p>
                    <div className="game-meta">
                      <span>{game.players}</span>
                      <span>{game.duration}</span>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        <StatsBar onOpen={onOpenRecords} />
      </div>
    </div>
  )
}
