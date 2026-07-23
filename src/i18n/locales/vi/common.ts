/** Vietnamese — common shell strings */
export default {
  appName: 'DreamScape',
  toggleNav: 'Mở/đóng điều hướng',
  scrollToTop: 'Cuộn lên đầu và làm mới trang',
  goHome: 'Về trang chủ',
  goToProfile: 'Đến trang cá nhân của tôi',
  // Header search (Home route only)
  searchLabel: 'Tìm kiếm giấc mơ',
  searchPlaceholder: 'Tìm kiếm giấc mơ...',
  clearSearch: 'Xóa tìm kiếm',
  pinnedTaskCollapse: 'Thu thông báo vào cạnh màn hình',
  pinnedTaskExpand: 'Mở lại thông báo',
  pinnedTaskView: 'Xem',
  // Locale switch — label names the TARGET language
  switchToEnglish: 'Switch to English',
  switchToVietnamese: 'Chuyển sang tiếng Việt',
  progress: {
    elapsed: 'Đã chạy {duration}', seconds: '{count} giây', minutes: '{count} phút',
    minutesSeconds: '{minutes} phút {seconds} giây', hoursMinutes: '{hours} giờ {minutes} phút',
    measuring: 'Đang đo tốc độ xử lý để ước tính', remaining: 'Còn khoảng {duration}',
    overdue: 'Lâu hơn dự kiến {duration} · vẫn đang xử lý',
  },
  sourceProgress: {
    doclingStagesLabel: 'Các bước xử lý Docling',
    receivePdf: 'Tiếp nhận PDF gốc', receivePdfDetail: 'Giữ nguyên tệp nguồn để đối chiếu.',
    inspectOcr: 'Kiểm tra lớp văn bản và nhu cầu OCR', inspectOcrDetail: 'Xác định trang scan và chiến lược nhận dạng.',
    parseDocling: 'Phân tích bố cục bằng Docling', parseDoclingDetail: 'Khôi phục heading, đoạn văn, bảng, hình và thứ tự đọc.',
    cleanOcr: 'Làm sạch lỗi OCR', cleanOcrDetail: 'Sửa lỗi ký tự, khoảng trắng và dòng vỡ trước khi lưu.',
    buildReader: 'Dựng Bản đọc thông minh', buildReaderDetail: 'Chỉ dữ liệu đã làm sạch mới được ghi vào bản đọc cuối.',
  },
} as const
