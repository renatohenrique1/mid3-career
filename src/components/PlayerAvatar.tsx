import {
  AVATAR_OPTIONS,
  nameInitial,
} from '../data/profile'
import type { SeasonMedal } from '../data/ranking'
import type { AvatarId, User } from '../types'
import { MedalInsignia } from './MedalInsignia'

interface PlayerAvatarProps {
  user: Pick<User, 'name' | 'avatarId'> & { avatarUrl?: string | null }
  size?: 'sm' | 'md' | 'lg'
  className?: string
  medal?: SeasonMedal | null
}

export function PlayerAvatar({
  user,
  size = 'md',
  className = '',
  medal = null,
}: PlayerAvatarProps) {
  const option = AVATAR_OPTIONS.find((a) => a.id === user.avatarId)
  const photo = user.avatarUrl?.trim() || ''
  const isInitial = !photo && (user.avatarId === 'initial' || !option?.src)

  return (
    <span className={`player-avatar-wrap size-${size}`}>
      <span
        className={`player-avatar size-${size} ${isInitial ? 'is-initial' : ''} ${photo ? 'is-photo' : ''} ${className}`.trim()}
        aria-hidden
      >
        {photo ? (
          <img src={photo} alt="" />
        ) : isInitial ? (
          <span className="player-avatar-letter">{nameInitial(user.name)}</span>
        ) : (
          <img src={option!.src} alt="" />
        )}
      </span>
      {medal ? <MedalInsignia medal={medal} /> : null}
    </span>
  )
}

export function AvatarPicker({
  value,
  name,
  onChange,
}: {
  value: AvatarId
  name: string
  onChange: (id: AvatarId) => void
}) {
  return (
    <div className="avatar-picker" role="group" aria-label="Avatar">
      {AVATAR_OPTIONS.map((opt) => (
        <button
          key={opt.id}
          type="button"
          className={value === opt.id ? 'active' : ''}
          onClick={() => onChange(opt.id)}
          title={opt.label}
        >
          <PlayerAvatar
            user={{ name, avatarId: opt.id }}
            size="md"
          />
          <span>{opt.label}</span>
        </button>
      ))}
    </div>
  )
}
