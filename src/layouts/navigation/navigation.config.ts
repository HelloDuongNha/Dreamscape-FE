import type {
  NavigationContext,
  NavigationItem,
  NavigationModel,
} from './navigation.types'

const HOME: NavigationItem = {
  id: 'home',
  to: '/',
  labelKey: 'navigation.home',
  icon: 'home',
}

const ORACLE: NavigationItem = {
  id: 'oracle',
  to: '/oracle',
  labelKey: 'navigation.oracle',
  icon: 'oracle',
}

const MESSAGES: NavigationItem = {
  id: 'messages',
  to: '/messages',
  labelKey: 'navigation.messages',
  icon: 'messages',
}

const ACHIEVEMENTS: NavigationItem = {
  id: 'achievements',
  to: '/achievements',
  labelKey: 'navigation.achievements',
  icon: 'achievements',
}

const LIBRARY: NavigationItem = {
  id: 'library',
  to: '/library',
  labelKey: 'navigation.library',
  icon: 'library',
  activePrefixes: ['/library'],
}

const PROFILE: NavigationItem = {
  id: 'profile',
  to: '/profile',
  labelKey: 'navigation.profile',
  icon: 'profile',
  activePrefixes: ['/profile'],
}

const SETTINGS: NavigationItem = {
  id: 'settings',
  to: '/settings/account',
  labelKey: 'navigation.settings',
  icon: 'settings',
  activePrefixes: ['/settings'],
}

const MODERATION_SOURCES: NavigationItem = {
  id: 'moderation-sources',
  to: '/moderation/sources',
  labelKey: 'navigation.moderationSources',
  icon: 'moderation-sources',
  activePrefixes: ['/moderation/sources'],
}

const RULE_REVIEW: NavigationItem = {
  id: 'moderation-rule-candidates',
  to: '/moderation/rule-candidates',
  labelKey: 'navigation.ruleReview',
  icon: 'rule-review',
  activePrefixes: ['/moderation/rule-candidates'],
}

export function buildNavigationModel(context: NavigationContext): NavigationModel {
  const messages = withBadge(MESSAGES, context.unreadMessages)
  const desktopPrimary = [HOME, ORACLE, messages, ACHIEVEMENTS, LIBRARY]
  const mobilePrimary = [HOME, ORACLE, messages, LIBRARY]
  const mobileMoreGeneral = [PROFILE, ACHIEVEMENTS, SETTINGS]
  const mobileMoreAdmin = context.isAdmin ? [MODERATION_SOURCES, RULE_REVIEW] : []

  if (context.isAdmin) {
    desktopPrimary.push(...mobileMoreAdmin)
  }

  return {
    desktopPrimary,
    mobilePrimary,
    mobileMoreGeneral,
    mobileMoreAdmin,
  }
}

export function isNavigationItemActive(item: NavigationItem, routePath: string): boolean {
  if (item.to === '/') {
    return routePath === '/'
  }

  const prefixes = item.activePrefixes ?? [item.to]
  return prefixes.some((prefix) => routePath === prefix || routePath.startsWith(`${prefix}/`))
}

function withBadge(item: NavigationItem, count: number): NavigationItem {
  if (count <= 0) {
    return item
  }

  return { ...item, badge: count }
}
