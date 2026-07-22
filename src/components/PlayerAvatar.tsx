import {
  AVATAR_OPTIONS,
  nameInitial,
} from '../data/profile'
import type { AvatarId, User } from '../types'

interface PlayerAvatarProps {
  user: Pick<User, 'name' | 'avatarId'>
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function PlayerAvatar({
  user,
  size = 'md',
  className = '',
}: PlayerAvatarProps) {
  const option = AVATAR_OPTIONS.find((a) => a.id === user.avatarId)
  const isInitial =
    user.avatarId === 'initial' || !option?.src

  return (
    <span
      className={`player-avatar size-${size} ${isInitial ? 'is-initial' : ''} ${className}`.trim()}
      aria-hidden
    >
      {isInitial ? (
        <span className="player-avatar-letter">{nameInitial(user.name)}</span>
      ) : (
        <img src={option!.src} alt="" />
      )}
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
