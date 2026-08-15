import { useEffect, useState } from 'react'
import { GAME_IDS, GAMES } from '../config/games'
import type { GameId } from '../config/games'
import { StatsBar } from './StatsBar'
import { buildLobbyUrl } from '../utils/ws'
import './GameSelection.css'

interface GameSelectionProps {
  onSelectGame: (game: GameId) => void
}

export function GameSelection({ onSelectGame }: GameSelectionProps) {
  // 상대를 기다리는 사람이 있는 게임 — 15초마다 갱신 (실패하면 조용히 무시)
  const [waiting, setWaiting] = useState<string[]>([])

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

  return (
    <div className="game-selection">
      <div className="game-selection-container">
        <header className="game-selection-header">
          <span className="game-selection-eyebrow">두 사람을 위한 보드게임</span>
          <h1 className="game-selection-title">게임 선택</h1>
          <p className="game-selection-lead">함께 플레이할 게임을 골라주세요.</p>
        </header>

        <div className="game-cards">
          {GAME_IDS.map((id) => {
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

        <StatsBar />
      </div>
    </div>
  )
}
