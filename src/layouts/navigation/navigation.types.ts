export type NavigationIconName =
  | 'home'
  | 'oracle'
  | 'messages'
  | 'achievements'
  | 'library'
  | 'moderation-sources'
  | 'rule-review'
  | 'profile'
  | 'settings'
  | 'logout'
  | 'more'

export interface NavigationItem {
  id: string
  to: string
  labelKey: string
  icon: NavigationIconName
  activePrefixes?: string[]
  badge?: number
}

export interface NavigationModel {
  desktopPrimary: NavigationItem[]
  mobilePrimary: NavigationItem[]
  mobileMoreGeneral: NavigationItem[]
  mobileMoreAdmin: NavigationItem[]
}

export interface NavigationContext {
  isAdmin: boolean
  unreadMessages: number
}
