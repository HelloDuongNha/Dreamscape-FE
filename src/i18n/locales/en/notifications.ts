/** English — notification dropdown shell strings
 *  (identical key set to vi/notifications.ts) */
export default {
  buttonLabel: 'Notifications',
  title: 'Notifications',
  markAllRead: 'Mark all as read',
  loading: 'Loading...',
  empty: 'No notifications yet',
  loadError: 'Notifications could not be loaded.',
  retry: 'Try again',
  options: 'Notification options',
  view: 'View',
  delete: 'Delete',
  cancel: 'Cancel',
  deleteTitle: 'Delete notification?',
  deleteMessage: 'This notification will be removed from your list.',
  deleteSuccess: 'Notification deleted.',
  deleteError: 'The notification could not be deleted.',
  openError: 'The notification could not be opened.',
  targetUnavailable: 'This content was deleted, made private, or is no longer available to you.',
  markAllSuccess: 'All notifications marked as read.',
  markAllError: 'Notifications could not be marked as read.',
  // Notification action phrases — sender name is prepended by the template
  liked: 'liked your dream',
  commented: 'commented on your dream',
  replied: 'replied to your comment',
  followed: 'followed you',
  // Oracle system notification
  oracleAnalyzed: 'Oracle has finished analyzing your dream',
  // Fallback when senderId.display_name is absent
  anonymous: 'Anonymous user',
} as const
