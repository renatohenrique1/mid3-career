import type { PairFixture } from '../data/ranking'

interface TournamentFixturesProps {
  fixtures: PairFixture[]
  currentUserId?: string
}

export function TournamentFixtures({
  fixtures,
  currentUserId,
}: TournamentFixturesProps) {
  const remainingTotal = fixtures.reduce((sum, f) => sum + f.remaining, 0)
  const done = remainingTotal === 0

  return (
    <section className="panel fixtures-panel">
      <div className="panel-head">
        <h2>Confrontos</h2>
        <p>
          {done
            ? 'Todos os confrontos do round-robin foram jogados.'
            : `Faltam ${remainingTotal} set${remainingTotal === 1 ? '' : 's'} no total.`}
        </p>
      </div>

      <ul className="fixtures-list">
        {fixtures.map((fixture) => {
          const involvesYou =
            fixture.playerAId === currentUserId ||
            fixture.playerBId === currentUserId
          const complete = fixture.remaining === 0

          return (
            <li
              key={`${fixture.playerAId}-${fixture.playerBId}`}
              className={`fixture-row${complete ? ' is-done' : ''}${
                involvesYou ? ' involves-you' : ''
              }`}
            >
              <div className="fixture-pair">
                <strong>
                  {fixture.playerAName}
                  <span className="fixture-vs"> vs </span>
                  {fixture.playerBName}
                </strong>
                <span className="fixture-meta">
                  {fixture.played}/{fixture.target} set
                  {fixture.target === 1 ? '' : 's'}
                </span>
              </div>
              <span className={`fixture-status${complete ? ' done' : ''}`}>
                {complete
                  ? 'Completo'
                  : `Faltam ${fixture.remaining}`}
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
