/** Vietnamese — notification dropdown shell strings
 *
 * System-owned text only. Sender display_name, dream titles and
 * notification body content are user-authored and are never translated.
 */
export default {
  buttonLabel: 'Thông báo',
  title: 'Thông báo',
  markAllRead: 'Đánh dấu tất cả đã đọc',
  loading: 'Đang tải...',
  empty: 'Chưa có thông báo',
  // Notification action phrases — sender name is prepended by the template
  liked: 'đã thích giấc mơ của bạn',
  commented: 'đã bình luận về giấc mơ của bạn',
  followed: 'đã theo dõi bạn',
  // Oracle system notification
  oracleAnalyzed: 'Oracle đã phân tích xong giấc mơ',
  // Fallback when senderId.display_name is absent
  anonymous: 'Người dùng ẩn danh',
} as const
