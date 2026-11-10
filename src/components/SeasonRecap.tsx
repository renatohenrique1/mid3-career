import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { buildSeasonRecap, type PointsTimeline } from '../data/seasonRecap'
import type { AppData } from '../types'

function joinCast(names: string[]) {
  if (names.length <= 1) return names[0] ?? ''
  if (names.length === 2) return `${names[0]} e ${names[1]}`
  return `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`
}

function slideClass(active: boolean, extra = '') {
  return `recap-slide${extra ? ` ${extra}` : ''}${active ? ' is-active' : ''}`
}

function PointsOverTime({
  timeline,
  active,
}: {
  timeline: PointsTimeline
  active: boolean
}) {
  const width = 320
  const height = 210
  const padL = 30
  const padR = 8
  const padT = 12
  const padB = 22
  const lineRefs = useRef<Array<SVGPolylineElement | null>>([])
  const [lengths, setLengths] = useState<number[]>([])

  useLayoutEffect(() => {
    setLengths(lineRefs.current.map((node) => node?.getTotalLength() ?? 0))
  }, [timeline])
  const max = Math.max(...timeline.series.flatMap((series) => series.values), 1)
  const steps = Math.max(...timeline.series.map((series) => series.values.length), 2)
  const xAt = (index: number) =>
    padL + (index / (steps - 1)) * (width - padL - padR)
  const yAt = (value: number) =>
    padT + (1 - value / max) * (height - padT - padB)
  const yTicks = [max, Math.round(max / 2), 0]

  return (
    <figure className={`recap-time${active ? ' is-live' : ''}`}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Pontos acumulados ao longo da temporada">
        {yTicks.map((tick) => (
          <g key={tick}>
            <line
              x1={padL}
              x2={width - padR}
              y1={yAt(tick)}
              y2={yAt(tick)}
              className="recap-time-grid"
            />
            <text x={0} y={yAt(tick) + 3} className="recap-time-axis">
              {tick}
            </text>
          </g>
        ))}
        {timeline.ticks.map((tick) => (
          <text
            key={`${tick.index}-${tick.label}`}
            x={xAt(tick.index)}
            y={height - 2}
            textAnchor={tick.index === 0 ? 'start' : 'middle'}
            className="recap-time-axis"
          >
            {tick.label}
          </text>
        ))}
        {timeline.series.map((series, seriesIndex) => {
          const length = lengths[seriesIndex] ?? 0
          return (
            <polyline
              key={series.name}
              ref={(node) => {
                lineRefs.current[seriesIndex] = node
              }}
              className={`recap-line recap-line-${seriesIndex}${active && length > 0 ? ' is-drawn' : ''}`}
              points={series.values
                .map((value, index) => `${xAt(index).toFixed(1)},${yAt(value).toFixed(1)}`)
                .join(' ')}
              style={
                length > 0
                  ? ({
                      ['--len' as string]: length,
                      animationDelay: `${seriesIndex * 0.12}s`,
                    } as CSSProperties)
                  : undefined
              }
            />
          )
        })}
      </svg>
      <figcaption className="recap-time-legend">
        {timeline.series.map((series, seriesIndex) => (
          <span key={series.name}>
            <i className={`recap-line-${seriesIndex}`} />
            {series.short}
          </span>
        ))}
      </figcaption>
    </figure>
  )
}

interface SeasonRecapProps {
  data: AppData
  onClose: () => void
}

export function SeasonRecap({ data, onClose }: SeasonRecapProps) {
  const story = buildSeasonRecap(data)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)
  const slideCount = story ? 10 : 0

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    function onScroll() {
      const height = el?.clientHeight || 1
      setIndex(Math.round((el?.scrollTop ?? 0) / height))
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [story])

  if (!story) return null

  function goTo(next: number) {
    const el = scrollerRef.current
    if (!el) return
    el.scrollTo({ top: next * el.clientHeight, behavior: 'smooth' })
  }

  return createPortal(
    <div className="recap" ref={scrollerRef}>
      <button type="button" className="recap-close" onClick={onClose}>
        Fechar
      </button>
      <div className="recap-dots" aria-hidden>
        {Array.from({ length: slideCount }, (_, dot) => (
          <button
            key={dot}
            type="button"
            className={dot === index ? 'active' : ''}
            onClick={() => goTo(dot)}
          />
        ))}
      </div>

      <section className={slideClass(index === 0, 'recap-cover')}>
        <img className="recap-logo" src="/logo-mid3.png" alt="" width={72} height={72} />
        <p className="recap-kicker">MID3 Career · retrospectiva</p>
        <h2 className="recap-figure recap-title">
          Temporada <span>2026</span>
        </h2>
        <p className="recap-copy">{story.rangeLabel}</p>
        <ul className="recap-cover-stats" aria-label="Resumo da temporada">
          <li>
            <strong>{story.sets}</strong>
            <span>sets</span>
          </li>
          <li>
            <strong>{story.games}</strong>
            <span>games</span>
          </li>
          <li>
            <strong>{story.minutesLabel}</strong>
            <span>de quadra</span>
          </li>
          <li>
            <strong>{story.playDays}</strong>
            <span>dias de jogo</span>
          </li>
        </ul>
        <p className="recap-cast">{joinCast(story.cast)}</p>
        <p className="recap-hint">Deslize para ver</p>
      </section>

      <section className={slideClass(index === 1)}>
        <p className="recap-kicker">Tempo de quadra</p>
        <h2 className="recap-figure">{story.minutesLabel}</h2>
        {story.tubeEstimate != null ? (
          <div className="recap-voice">
            <p>Vocês tiveram esse tempo juntos em quadra.</p>
            <p>
              Isso dá pelo menos <strong>{story.tubeEstimate} tubos</strong> de
              bola.
            </p>
            <p>
              Por outro lado, é apenas <strong>uma semana</strong> de treino
              para um profissional.
            </p>
          </div>
        ) : null}
      </section>

      <section className={slideClass(index === 2)}>
        <p className="recap-kicker">Mês da temporada</p>
        <h2 className="recap-figure recap-figure-word">{story.peakLabel}</h2>
        <div className="recap-months" aria-label="Sets por mês">
          {story.months.map((month) => (
            <div key={month.key} className="recap-month">
              <span>{month.label}</span>
              <span className="recap-month-track">
                <span
                  className={month.count === story.peakCount ? 'is-peak' : ''}
                  style={{
                    ['--fill' as string]: `${story.peakCount === 0 ? 0 : (month.count / story.peakCount) * 100}%`,
                  }}
                />
              </span>
              <span>{month.count}</span>
            </div>
          ))}
        </div>
        <p className="recap-copy">
          {story.peakCount} sets. No resto da temporada: {story.restNote}.
        </p>
      </section>

      <section className={slideClass(index === 3)}>
        <p className="recap-kicker">O set típico</p>
        <div className="recap-durations" aria-label="Duração dos sets">
          {[
            {
              label: 'Goleada',
              minutes: story.blowoutMinutes,
              note: `${story.blowoutCount} sets`,
              tone: '',
            },
            {
              label: 'Típico',
              minutes: story.medianMinutes,
              note: `${story.sets - story.missingDuration} com tempo`,
              tone: 'is-typical',
            },
            {
              label: 'Apertado',
              minutes: story.closeMinutes,
              note: `${story.closeCount} sets`,
              tone: '',
            },
          ]
            .filter((item) => item.minutes != null)
            .map((item) => (
              <div key={item.label} className={`recap-duration ${item.tone}`}>
                <span className="recap-duration-plot">
                  <span
                    className="recap-duration-bar"
                    style={{
                      ['--h' as string]: `${Math.round(((item.minutes ?? 0) / 70) * 136)}px`,
                    }}
                  />
                </span>
                <strong>{item.minutes}</strong>
                <em>{item.label}</em>
                <span className="recap-duration-note">{item.note}</span>
              </div>
            ))}
        </div>
        <div className="recap-edge recap-set-facts">
          <div>
            <span>Placar moda</span>
            <strong>{story.modeScore}</strong>
            <em>
              {story.modeCount} {story.modeCount === 1 ? 'set' : 'sets'}
            </em>
          </div>
          {story.meanMinutesLabel ? (
            <div>
              <span>Tempo médio</span>
              <strong>{story.meanMinutesLabel}</strong>
              <em>min</em>
            </div>
          ) : null}
        </div>
        <p className="recap-copy">
          Cada número é a mediana, em minutos. Goleada é diferença de 4 games ou
          mais. Apertado é diferença de até 2 e dura o dobro.
          {story.missingDuration > 0
            ? ` ${story.missingDuration} sets ficaram sem o tempo lançado.`
            : ''}
        </p>
      </section>

      <section className={slideClass(index === 4, 'recap-points')}>
        <p className="recap-kicker">Quem pontuou</p>
        <PointsOverTime timeline={story.timeline} active={index === 4} />
        {story.edge ? (
          <div className="recap-edge">
            <div>
              <span>Maior pontuação</span>
              <strong>{story.edge.leaderShort}</strong>
              <em>
                {story.edge.leaderPoints} pts · {story.edge.leaderWins} sets
              </em>
            </div>
            <div>
              <span>Melhor performance</span>
              <strong>{story.edge.rivalShort}</strong>
              <em>{story.edge.rivalNote}</em>
            </div>
          </div>
        ) : null}
        <p className="recap-copy">
          {story.edge
            ? `${story.edge.leaderShort} soma pontos no volume. ${story.edge.rivalShort} teve a melhor performance contra os dois.`
            : 'Pontos acumulados a cada set, no critério clássico.'}
        </p>
      </section>

      <section className={slideClass(index === 5)}>
        <p className="recap-kicker">A dupla da temporada</p>
        <div className="recap-matchup">
          <p className="recap-matchup-name">{story.topPair.leftName}</p>
          <p className="recap-matchup-score">
            <span>{story.topPair.leftWins}</span>
            <span aria-hidden>–</span>
            <span>{story.topPair.rightWins}</span>
          </p>
          <p className="recap-matchup-name recap-matchup-away">
            {story.topPair.rightName}
          </p>
        </div>
        <p className="recap-copy">{story.topPair.sets} sets juntos</p>
        {story.otherPairs.length > 0 ? (
          <ul className="recap-other-pairs">
            {story.otherPairs.map((pair) => (
              <li key={pair.label}>
                {pair.leftName} {pair.leftWins}–{pair.rightWins} {pair.rightName}
                <span> · {pair.sets} sets</span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className={slideClass(index === 6)}>
        <p className="recap-kicker">A casa</p>
        <h2 className="recap-figure recap-figure-word">{story.topVenue}</h2>
        <ul className="recap-venues" aria-label="Sets por local">
          {story.venues.map((venue) => (
            <li key={venue.label} className="recap-venue">
              <span className="recap-venue-name">{venue.label}</span>
              <span className="recap-venue-count">{venue.count}</span>
              <span className="recap-venue-track">
                <span
                  className={venue.count === story.topVenueCount ? 'is-lead' : ''}
                  style={{
                    ['--fill' as string]: `${story.topVenueCount === 0 ? 0 : (venue.count / story.topVenueCount) * 100}%`,
                  }}
                />
              </span>
            </li>
          ))}
        </ul>
        <p className="recap-copy">
          {story.topVenueCount} dos {story.sets} sets. {story.surfaceNote}{' '}
          {story.outingNote}
        </p>
      </section>

      <section className={slideClass(index === 7)}>
        <h2 className="recap-figure recap-figure-word">O que vem agora?</h2>
      </section>

      <section className={slideClass(index === 8, 'recap-finale-logo')}>
        <img className="finals-mark" src="/logo-finals.png" alt="MID3 Finals 2026" />
      </section>

      <section className={slideClass(index === 9, 'recap-finale')}>
        <h2 className="recap-figure recap-figure-word recap-finale-title">Os melhores levarão</h2>
        <ol className="finals-podium" aria-label="Insígnias da Finals">
          <li className="podium-slot is-silver">
            <img src="/logo-finals-silver.png" alt="Prata" />
            <span className="podium-step" aria-hidden />
          </li>
          <li className="podium-slot is-gold">
            <img src="/logo-finals-gold.png" alt="Ouro" />
            <span className="podium-step" aria-hidden />
          </li>
          <li className="podium-slot is-bronze">
            <img src="/logo-finals-bronze.png" alt="Bronze" />
            <span className="podium-step" aria-hidden />
          </li>
        </ol>
        <p className="recap-copy">
          O formato da Finals ainda vai ser decidido. Essa será a
          recompensa e ficará no perfil para sempre.
        </p>
      </section>
    </div>,
    document.body,
  )
}

export function SeasonPreview() {
  const [data, setData] = useState<AppData | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    fetch('/season-preview.json')
      .then((response) => {
        if (!response.ok) throw new Error('missing')
        return response.json() as Promise<AppData>
      })
      .then(setData)
      .catch(() => setFailed(true))
  }, [])

  return (
    <div className="app">
      <div className="atmosphere" aria-hidden />
      {data ? (
        <SeasonRecap data={data} onClose={() => window.history.back()} />
      ) : (
        <p className="recap-loading">{failed ? 'Sem dados da temporada.' : 'Carregando…'}</p>
      )}
    </div>
  )
}
