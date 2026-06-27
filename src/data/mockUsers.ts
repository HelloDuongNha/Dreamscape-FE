export interface User {
  _id:            string
  username:       string   // e.g. "@helloduongnha"
  display_name:   string
  avatar:         string   // URL — empty string falls back to initials
  bio:            string
  follower_count: number
  followers?:     string[]
  following?:     string[]
  isPrivateAccount?: boolean
  dmPrivacy?:     'everyone' | 'following' | 'friends'
  followersPrivacy?: 'everyone' | 'following' | 'only_me'
  followingPrivacy?: 'everyone' | 'following' | 'only_me'
  followersList?: User[]
  followingList?: User[]
  createdAt?:     string
  streakCount?:   number
  highestStreak?: number
  rankPoints?:    number
  currentRank?:   string
  dailyTasks?: {
    likeOtherPost: boolean;
    commentOtherPost: boolean;
    createPost: boolean;
    lastResetDate: string;
  };
  achievements?:   string[]
  timeOnlineToday?: number
  lastActiveDate?:  string
  lastHeartbeatAt?: string
}

export const CURRENT_USER_ID = 'u-001'

export const mockUsers: User[] = [
  {
    _id:            'u-001',
    username:       '@helloduongnha',
    display_name:   'Nguyễn Hà',
    avatar:         '',
    bio:            'Explorer of the subconscious realm.',
    follower_count: 142,
  },
  {
    _id:            'u-002',
    username:       '@lyra.voss',
    display_name:   'Lyra Voss',
    avatar:         '',
    bio:            'Dream archivist & night wanderer.',
    follower_count: 391,
  },
  {
    _id:            'u-003',
    username:       '@zephyr.hale',
    display_name:   'Zephyr Hale',
    avatar:         '',
    bio:            'Finding portals in crystal labyrinths.',
    follower_count:  87,
  },
  {
    _id:            'u-004',
    username:       '@aria.kael',
    display_name:   'Aria Kael',
    avatar:         '',
    bio:            'The Oracle speaks in symbols.',
    follower_count: 256,
  },
]

/** Returns initials (up to 2 chars) for a display name */
export function getInitials(name: string): string {
  const trimmed = (name ?? '').trim()
  if (!trimmed) return '?'
  const parts = trimmed.split(/\s+/).filter(w => w.length > 0)
  if (parts.length === 0) return '?'
  return parts
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

/** Deterministic muted avatar background from user id */
const AVATAR_BG = ['#1e3a5f', '#2c1f4a', '#1a3d2e', '#3d1f1f', '#2e2a14']
export function getAvatarBg(id: string): string {
  const n = id.split('').reduce((s, c) => s + c.charCodeAt(0), 0)
  return AVATAR_BG[n % AVATAR_BG.length]
}
