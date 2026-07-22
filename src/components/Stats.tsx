import { useMemo } from 'react'
import { computeAnalytics } from '../data/analytics'
import type { AppData } from '../types'

interface StatsProps {
  data: AppData
}

export function Stats({ data }: StatsProps) {
  const analytics = useMemo(() => computeAnalytics(data), [data])

  return (
    <section className="stats-home">
      <header className="sets-hero">
        <p className="tourney-kicker">Leitura automática</p>
        <h2>Estatísticas</h2>
        <p>
          Análise gerada a partir dos sets, superfícies, placares e
          rivalidades do grupo.
        </p>
      </header>

      <div className="tourney-stats" aria-label="Números gerais">
        <div>
          <strong>{analytics.totalSets}</strong>
          <span>sets</span>
        </div>
        <div>
          <strong>
            {analytics.avgGamesPerSet
              ? analytics.avgGamesPerSet.toFixed(1)
              : '0'}
          </strong>
          <span>games/set</span>
        </div>
        <div>
          <strong>{analytics.tightSets}</strong>
          <span>apertados</span>
        </div>
      </div>

      <div className="stats-split panel">
        <div className="panel-head">
          <h2>Onde se joga</h2>
          <p>volume por superfície e contexto</p>
        </div>
        <div className="stats-bars">
          {analytics.surfaces.map((s) => (
            <div key={s.surface} className="stats-bar-row">
              <div className="stats-bar-label">
                <strong>{s.label}</strong>
                <span>
                  {s.played} · {Math.round(s.share * 100)}%
                </span>
              </div>
              <div className="stats-bar-track">
                <span
                  className={`stats-bar-fill ${s.surface}`}
                  style={{ width: `${Math.max(s.share * 100, s.played ? 4 : 0)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
        <p className="stats-context">
          {analytics.tournamentSets} em torneio · {analytics.casualSets}{' '}
          avulsos · {analytics.blowouts} goleadas
        </p>
      </div>

      <div className="tourney-section-head">
        <h3>Insights</h3>
        <span>{analytics.insights.length} leituras</span>
      </div>

      <ul className="insight-list">
        {analytics.insights.map((insight) => (
          <li
            key={insight.id}
            className={`insight-card panel accent-${insight.accent}`}
          >
            <span className="insight-topic">{insight.topic}</span>
            <strong>{insight.headline}</strong>
            <p>{insight.detail}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
