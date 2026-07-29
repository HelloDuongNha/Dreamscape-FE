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
  loadError: 'Không thể tải thông báo.',
  retry: 'Thử lại',
  options: 'Tùy chọn thông báo',
  view: 'Xem',
  delete: 'Xóa',
  cancel: 'Hủy',
  deleteTitle: 'Xóa thông báo?',
  deleteMessage: 'Thông báo này sẽ bị xóa khỏi danh sách của bạn.',
  deleteSuccess: 'Đã xóa thông báo.',
  deleteError: 'Không thể xóa thông báo.',
  openError: 'Không thể mở thông báo.',
  targetUnavailable: 'Nội dung này đã bị xóa, chuyển sang riêng tư hoặc bạn không còn quyền xem.',
  markAllSuccess: 'Đã đánh dấu tất cả thông báo là đã đọc.',
  markAllError: 'Không thể đánh dấu thông báo là đã đọc.',
  // Notification action phrases — sender name is prepended by the template
  liked: 'đã thích giấc mơ của bạn',
  commented: 'đã bình luận về giấc mơ của bạn',
  followed: 'đã theo dõi bạn',
  // Oracle system notification
  oracleAnalyzed: 'Oracle đã phân tích xong giấc mơ',
  // Fallback when senderId.display_name is absent
  anonymous: 'Người dùng ẩn danh',
} as const
