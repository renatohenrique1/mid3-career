import { useId } from 'react'
import {
  seasonMedalLabel,
  type SeasonMedal,
} from '../data/ranking'

const TONE = {
  gold: { face: '#f5d76e', rim: '#a97812', ink: '#6a480c' },
  silver: { face: '#ececf1', rim: '#8d8d98', ink: '#3f3f46' },
  bronze: { face: '#e0a36a', rim: '#8a5a32', ink: '#5c3a1e' },
} as const

export function MedalInsignia({ medal }: { medal: SeasonMedal }) {
  const tone = TONE[medal]
  const label = `${seasonMedalLabel(medal)} · 2026`
  return (
    <span className={`medal-insignia medal-insignia-${medal}`} title={label}>
      <svg viewBox="0 0 32 32" aria-hidden>
        <circle cx="16" cy="16" r="15" fill={tone.rim} />
        <circle cx="16" cy="16" r="11.5" fill={tone.face} />
        <path
          d="M16 8.4 L17.8 13.2 L22.8 13.6 L18.9 16.8 L20.1 21.8 L16 19.1 L11.9 21.8 L13.1 16.8 L9.2 13.6 L14.2 13.2 Z"
          fill={tone.ink}
        />
      </svg>
      <span className="sr-only">{label}</span>
    </span>
  )
}

const MEDAL_FACE = {
  gold: ['#fff6c8', '#f5d76e', '#e0b83a', '#9a6810'],
  silver: ['#ffffff', '#ececf1', '#c5c5ce', '#8a8a96'],
  bronze: ['#ffe4c8', '#e0a36a', '#c4844a', '#8a5428'],
} as const

const MEDAL_RIM = {
  gold: ['#fff1b0', '#c99216', '#7a520c'],
  silver: ['#ffffff', '#b4b4be', '#6a6a74'],
  bronze: ['#f3c9a2', '#a86b3a', '#6a3e1c'],
} as const

const MEDAL_RIBBON = {
  gold: ['#f97316', '#9a3412', '#c2410c'],
  silver: ['#d8d8e0', '#6d6d78', '#9a9aa6'],
  bronze: ['#e08a4a', '#7a3e16', '#b56832'],
} as const

const MEDAL_INK = {
  gold: '#6a480c',
  silver: '#3a3a42',
  bronze: '#5c3a1e',
} as const

const MEDAL_RING = {
  gold: '#fff8dc',
  silver: '#ffffff',
  bronze: '#ffe4c8',
} as const

export function SeasonMedalArt({
  medal,
  className,
}: {
  medal: SeasonMedal
  className?: string
}) {
  const gradientId = useId().replace(/:/g, '')
  const face = `${gradientId}-face`
  const rim = `${gradientId}-rim`
  const ribbon = `${gradientId}-ribbon`
  const [faceA, faceB, faceC, faceD] = MEDAL_FACE[medal]
  const [rimA, rimB, rimC] = MEDAL_RIM[medal]
  const [ribbonA, ribbonB, ribbonC] = MEDAL_RIBBON[medal]
  return (
    <svg className={className} viewBox="0 0 200 268" aria-hidden>
      <defs>
        <linearGradient id={face} x1="0.2" y1="0" x2="0.85" y2="1">
          <stop offset="0" stopColor={faceA} />
          <stop offset="0.42" stopColor={faceB} />
          <stop offset="0.72" stopColor={faceC} />
          <stop offset="1" stopColor={faceD} />
        </linearGradient>
        <linearGradient id={rim} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={rimA} />
          <stop offset="0.5" stopColor={rimB} />
          <stop offset="1" stopColor={rimC} />
        </linearGradient>
        <linearGradient id={ribbon} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={ribbonA} />
          <stop offset="1" stopColor={ribbonB} />
        </linearGradient>
      </defs>
      <rect x="78" y="4" width="44" height="42" rx="7" fill={`url(#${ribbon})`} />
      <path d="M72 128 L40 236 L96 188 Z" fill={`url(#${ribbon})`} />
      <path d="M128 128 L160 236 L104 188 Z" fill={ribbonC} />
      <circle cx="100" cy="112" r="76" fill={`url(#${rim})`} />
      <circle cx="100" cy="112" r="62" fill={`url(#${face})`} />
      <circle
        cx="100"
        cy="112"
        r="48"
        fill="none"
        stroke={MEDAL_RING[medal]}
        strokeWidth="2"
        opacity="0.75"
      />
      <path
        d="M100 74 L105.4 89 L121 90.6 L109.2 101.2 L112.6 116.6 L100 108.6 L87.4 116.6 L90.8 101.2 L79 90.6 L94.6 89 Z"
        fill={MEDAL_INK[medal]}
        opacity="0.9"
      />
      <text
        x="100"
        y="146"
        textAnchor="middle"
        fill={MEDAL_INK[medal]}
        fontFamily="Sora, sans-serif"
        fontSize="18"
        fontWeight="700"
        letterSpacing="1.4"
      >
        2026
      </text>
    </svg>
  )
}

export function ProfileMedals({ medal }: { medal: SeasonMedal }) {
  return (
    <div className="profile-medals">
      <p className="tourney-kicker">Medalhas</p>
      <div className="profile-medal">
        <SeasonMedalArt
          medal={medal}
          className={`profile-medal-art tone-${medal}`}
        />
        <div>
          <strong className={`player-medal player-medal-${medal}`}>
            {seasonMedalLabel(medal)}
          </strong>
          <span>Temporada 2026</span>
        </div>
      </div>
    </div>
  )
}
