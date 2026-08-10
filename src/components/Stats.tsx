import { useMemo, useState } from 'react'
import {
  computeAnalytics,
  type ChartSlice,
  type PlayerBar,
  type RankingTimeline,
  type RivalryChart,
} from '../data/analytics'
import type { AppData } from '../types'

interface StatsProps {
  data: AppData
}

function DonutChart({ slices }: { slices: ChartSlice[] }) {
  const total = slices.reduce((sum, s) => sum + s.value, 0)
  if (total === 0) {
    return (
      <svg viewBox="0 0 100 100" className="stats-donut" aria-hidden>
        <circle
          cx="50"
          cy="50"
          r="34"
          fill="none"
          stroke="var(--line)"
          strokeWidth="14"
        />
      </svg>
    )
  }

  const r = 34
  const c = 2 * Math.PI * r
  let offset = 0

  return (
    <svg viewBox="0 0 100 100" className="stats-donut" aria-hidden>
      <circle
        cx="50"
        cy="50"
        r={r}
        fill="none"
        stroke="var(--bg)"
        strokeWidth="14"
      />
      {slices
        .filter((s) => s.value > 0)
        .map((slice) => {
          const length = (slice.value / total) * c
          const el = (
            <circle
              key={slice.id}
              cx="50"
              cy="50"
              r={r}
              fill="none"
              stroke={slice.color ?? 'var(--accent)'}
              strokeWidth="14"
              strokeDasharray={`${length} ${c - length}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 50 50)"
            />
          )
          offset += length
          return el
        })}
      <text
        x="50"
        y="48"
        textAnchor="middle"
        className="stats-donut-value"
      >
        {total}
      </text>
      <text
        x="50"
        y="60"
        textAnchor="middle"
        className="stats-donut-label"
      >
        sets
      </text>
    </svg>
  )
}

function HBarList({
  items,
}: {
  items: Array<{
    id: string
    label: string
    value: number
    share: number
    color?: string
  }>
}) {
  const max = Math.max(...items.map((i) => i.value), 1)
  return (
    <ul className="stats-hbar-list">
      {items.map((item) => (
        <li key={item.id}>
          <div className="stats-bar-label">
            <strong>{item.label}</strong>
            <span>
              {item.value} · {Math.round(item.share * 100)}%
            </span>
          </div>
          <div className="stats-bar-track">
            <span
              className="stats-bar-fill"
              style={{
                width: `${Math.max((item.value / max) * 100, item.value ? 4 : 0)}%`,
                background: item.color ?? 'var(--accent)',
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}

function VBarChart({ slices }: { slices: ChartSlice[] }) {
  const max = Math.max(...slices.map((s) => s.value), 1)
  return (
    <div className="stats-vbar" role="img" aria-label="Distribuição de placares">
      {slices.map((slice) => (
        <div key={slice.id} className="stats-vbar-col">
          <span className="stats-vbar-value">{slice.value}</span>
          <div className="stats-vbar-track">
            <span
              style={{
                height: `${Math.max((slice.value / max) * 100, slice.value ? 8 : 0)}%`,
              }}
            />
          </div>
          <span className="stats-vbar-label">{slice.label}</span>
        </div>
      ))}
    </div>
  )
}

function PlayerWinsChart({ players }: { players: PlayerBar[] }) {
  const max = Math.max(...players.map((p) => p.wins), 1)
  return (
    <ul className="stats-hbar-list">
      {players.map((player) => (
        <li key={player.playerId}>
          <div className="stats-bar-label">
            <strong>{player.name}</strong>
            <span>
              {player.wins}V · {player.losses}D · {player.points} pts
            </span>
          </div>
          <div className="stats-bar-track">
            <span
              className="stats-bar-fill"
              style={{
                width: `${Math.max((player.wins / max) * 100, player.wins ? 4 : 0)}%`,
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}

function RivalryChartView({ rivalry }: { rivalry: RivalryChart }) {
  const total = Math.max(rivalry.winsA + rivalry.winsB, 1)
  const shareA = (rivalry.winsA / total) * 100
  const shareB = (rivalry.winsB / total) * 100
  return (
    <div className="stats-rivalry">
      <div className="stats-rivalry-names">
        <strong>{rivalry.playerAName}</strong>
        <span>{rivalry.played} sets</span>
        <strong>{rivalry.playerBName}</strong>
      </div>
      <div className="stats-rivalry-track" aria-hidden>
        <span style={{ width: `${shareA}%` }} />
        <span style={{ width: `${shareB}%` }} />
      </div>
      <div className="stats-rivalry-score">
        <span>{rivalry.winsA}</span>
        <span>—</span>
        <span>{rivalry.winsB}</span>
      </div>
    </div>
  )
}

function RankingLineChart({ timeline }: { timeline: RankingTimeline }) {
  const { dates, series } = timeline
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  if (dates.length === 0 || series.length === 0) {
    return <p className="empty">Sem evolução de ranking ainda.</p>
  }

  const width = 640
  const height = 220
  const padL = 36
  const padR = 16
  const padT = 16
  const padB = 36
  const plotW = width - padL - padR
  const plotH = height - padT - padB
  const maxPoints = Math.max(...series.flatMap((s) => s.values), 1)
  const n = dates.length
  const xAt = (i: number) =>
    padL + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW)
  const yAt = (v: number) => padT + plotH - (v / maxPoints) * plotH

  const yTicks = [0, Math.round(maxPoints / 2), maxPoints].filter(
    (v, i, arr) => arr.indexOf(v) === i,
  )

  const labelIndexes =
    n <= 6
      ? dates.map((_, i) => i)
      : [0, Math.floor((n - 1) / 2), n - 1].filter(
          (v, i, arr) => arr.indexOf(v) === i,
        )

  function indexFromClientX(
    clientX: number,
    svg: SVGSVGElement,
  ): number {
    const rect = svg.getBoundingClientRect()
    const localX = ((clientX - rect.left) / rect.width) * width
    const clamped = Math.min(width - padR, Math.max(padL, localX))
    if (n === 1) return 0
    const t = (clamped - padL) / plotW
    return Math.round(t * (n - 1))
  }

  function handlePointer(
    e: React.PointerEvent<SVGSVGElement>,
  ) {
    const idx = indexFromClientX(e.clientX, e.currentTarget)
    setActiveIndex(idx)
  }

  const active = activeIndex !== null ? activeIndex : null
  const tooltipLeft =
    active === null ? 0 : (xAt(active) / width) * 100

  return (
    <div className="stats-line-wrap">
      <div className="stats-line-stage">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="stats-line-chart"
          role="img"
          aria-label="Evolução do ranking por data. Passe o cursor ou toque para ver detalhes."
          onPointerMove={handlePointer}
          onPointerDown={handlePointer}
          onPointerLeave={(e) => {
            if (e.pointerType === 'mouse') setActiveIndex(null)
          }}
          onPointerCancel={() => setActiveIndex(null)}
        >
          {yTicks.map((tick) => (
            <g key={tick}>
              <line
                x1={padL}
                x2={width - padR}
                y1={yAt(tick)}
                y2={yAt(tick)}
                className="stats-line-grid"
              />
              <text
                x={padL - 8}
                y={yAt(tick) + 4}
                textAnchor="end"
                className="stats-line-axis"
              >
                {tick}
              </text>
            </g>
          ))}

          {series.map((s) => {
            const d = s.values
              .map((v, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i)} ${yAt(v)}`)
              .join(' ')
            return (
              <g key={s.playerId}>
                <path d={d} fill="none" stroke={s.color} strokeWidth="2.5" />
                {s.values.map((v, i) => (
                  <circle
                    key={`${s.playerId}-${i}`}
                    cx={xAt(i)}
                    cy={yAt(v)}
                    r={active === i ? 4.5 : 3.2}
                    fill={s.color}
                    className={active === i ? 'is-active' : undefined}
                  />
                ))}
              </g>
            )
          })}

          {active !== null ? (
            <line
              x1={xAt(active)}
              x2={xAt(active)}
              y1={padT}
              y2={padT + plotH}
              className="stats-line-cursor"
            />
          ) : null}

          {labelIndexes.map((i) => (
            <text
              key={`${dates[i]}-${i}`}
              x={xAt(i)}
              y={height - 10}
              textAnchor="middle"
              className="stats-line-axis"
            >
              {dates[i]}
            </text>
          ))}

          {/* hit area for easier touch */}
          <rect
            x={padL}
            y={padT}
            width={plotW}
            height={plotH}
            fill="transparent"
            className="stats-line-hit"
          />
        </svg>

        {active !== null ? (
          <div
            className={`stats-line-tooltip${tooltipLeft > 70 ? ' is-left' : ''}`}
            style={{ left: `${tooltipLeft}%` }}
            role="status"
          >
            <strong>{dates[active]}</strong>
            <ul>
              {[...series]
                .sort(
                  (a, b) =>
                    (b.values[active] ?? 0) - (a.values[active] ?? 0),
                )
                .map((s) => (
                  <li key={s.playerId}>
                    <span
                      className="stats-legend-swatch"
                      style={{ background: s.color }}
                    />
                    <span>{s.name}</span>
                    <em>{s.values[active] ?? 0} pts</em>
                  </li>
                ))}
            </ul>
          </div>
        ) : (
          <p className="stats-line-hint">Toque ou passe o cursor para ver a data</p>
        )}
      </div>

      <ul className="stats-line-legend">
        {series.map((s) => (
          <li key={s.playerId}>
            <span
              className="stats-legend-swatch"
              style={{ background: s.color }}
            />
            <strong>{s.name}</strong>
            <span>{s.values[s.values.length - 1] ?? 0} pts</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function Stats({ data }: StatsProps) {
  const analytics = useMemo(() => computeAnalytics(data), [data])
  const empty = analytics.totalSets === 0

  return (
    <section className="stats-home">
      <header className="sets-hero sets-hero-compact">
        <h2>Estatísticas</h2>
        <p>Gráficos do grupo: ranking, placares, locais e rivalidades.</p>
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

      {empty ? (
        <div className="panel">
          <p className="empty">
            Ainda sem sets. Registre partidas para liberar os gráficos.
          </p>
        </div>
      ) : (
        <div className="stats-grid">
          <article className="panel stats-chart-card stats-chart-wide">
            <div className="panel-head">
              <h2>Ranking</h2>
              <p>pontos acumulados por data</p>
            </div>
            <RankingLineChart timeline={analytics.rankingTimeline} />
          </article>

          <article className="panel stats-chart-card">
            <div className="panel-head">
              <h2>Superfície</h2>
              <p>rápida × saibro</p>
            </div>
            <div className="stats-donut-wrap">
              <DonutChart slices={analytics.surfaces} />
              <ul className="stats-legend">
                {analytics.surfaces.map((s) => (
                  <li key={s.id}>
                    <span
                      className="stats-legend-swatch"
                      style={{ background: s.color }}
                    />
                    <strong>{s.label}</strong>
                    <span>
                      {s.value} · {Math.round(s.share * 100)}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </article>

          <article className="panel stats-chart-card">
            <div className="panel-head">
              <h2>Vitórias</h2>
              <p>sets vencidos por jogador</p>
            </div>
            {analytics.players.length === 0 ? (
              <p className="empty">Sem vitórias ainda.</p>
            ) : (
              <PlayerWinsChart players={analytics.players} />
            )}
          </article>

          <article className="panel stats-chart-card stats-chart-wide">
            <div className="panel-head">
              <h2>Placares</h2>
              <p>frequência dos resultados</p>
            </div>
            {analytics.scoreLines.length === 0 ? (
              <p className="empty">Sem placares.</p>
            ) : (
              <VBarChart slices={analytics.scoreLines} />
            )}
          </article>

          {analytics.venues.length > 0 ? (
            <article className="panel stats-chart-card">
              <div className="panel-head">
                <h2>Locais</h2>
                <p>onde o grupo joga</p>
              </div>
              <HBarList items={analytics.venues} />
            </article>
          ) : null}

          {analytics.rivalry ? (
            <article className="panel stats-chart-card">
              <div className="panel-head">
                <h2>Rivalidade</h2>
                <p>duelo mais jogado</p>
              </div>
              <RivalryChartView rivalry={analytics.rivalry} />
            </article>
          ) : null}
        </div>
      )}
    </section>
  )
}
