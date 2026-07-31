/** Chuỗi tiếng Việt cho trang lịch và tiến trình thành tích. */
export default {
  calendar: {
    title: 'Lịch hoạt động',
    subtitle: 'Lịch sử ghi nhận giấc mơ của bạn',
    dayStreak: 'Chuỗi ngày',
    totalCheckIns: 'Tổng lượt ghi nhận',
    timeOnlineToday: 'Thời gian hôm nay',
    healthWarning: 'Khuyến nghị: Không sử dụng quá 180 phút mỗi ngày để bảo vệ sức khỏe tinh thần.',
    previousMonth: 'Tháng trước',
    nextMonth: 'Tháng sau',
    calendarFor: 'Lịch tháng {month}',
    checkedIn: 'đã ghi nhận',
    weekdays: {
      mon: 'T2',
      tue: 'T3',
      wed: 'T4',
      thu: 'T5',
      fri: 'T6',
      sat: 'T7',
      sun: 'CN',
    },
  },
  rank: {
    title: 'Tiến trình xếp hạng',
    rulesAria: 'Xem quy tắc xếp hạng',
    rulesTitle: 'Quy tắc xếp hạng',
    thresholds: 'Ngưỡng xếp hạng:',
    earningRules: 'Quy tắc tích điểm:',
    dailyLoginRule: 'Nhận +10 điểm khi ghi nhận hằng ngày, cùng thưởng chuỗi tối đa +5 điểm.',
    milestoneRule: 'Hoàn thành cột mốc (+20 điểm cho mỗi mốc).',
    tiers: {
      newDreamer: 'Nhà Mơ Mộng Mới',
      dreamBeginner: 'Người Bắt Đầu Mơ',
      interpretationMaster: 'Bậc Thầy Giải Mã',
      dreamManipulator: 'Kẻ Thao Túng Giấc Mơ',
      cosmicWanderer: 'Độc Hành Tinh Không',
      realityCreator: 'Đấng Sáng Tạo Thực Tại',
    },
  },
  milestones: {
    title: 'Cột mốc và thành tích',
    subtitle: 'Tích lũy chỉ số để nhận điểm thưởng',
    completed: 'Đã hoàn thành',
    items: {
      likes: {
        title: 'Tổng lượt thích nhận được',
        description: 'Tổng lượt thả tim tích lũy trên các bài chia sẻ giấc mơ của bạn',
      },
      comments: {
        title: 'Tổng bình luận nhận được',
        description: 'Tổng lượt phản hồi từ thành viên khác trên các bài đăng của bạn',
      },
      posts: {
        title: 'Tần suất ghi chép giấc mơ',
        description: 'Tổng bài viết chia sẻ giấc mơ cá nhân đã đăng trong cộng đồng',
      },
      followers: {
        title: 'Số người theo dõi',
        description: 'Tổng thành viên hiện đang theo dõi hồ sơ của bạn',
      },
      following: {
        title: 'Số người đang theo dõi',
        description: 'Tổng thành viên có hồ sơ mà bạn hiện đang theo dõi',
      },
      onlineTime: {
        title: 'Tổng thời gian đồng hành',
        description: 'Tổng số giờ bạn đã hoạt động trên DreamScape',
      },
      streak: {
        title: 'Kỷ nguyên gắn kết',
        description: 'Chuỗi ngày ghi nhận liên tục dài nhất dựa trên thời gian máy chủ',
      },
      contributions: {
        title: 'Đóng góp tài liệu học thuật',
        description: 'Tổng tài liệu hoặc nguồn học thuật của bạn đã được duyệt vào Thư viện DreamScape',
      },
    },
  },
  pointsShort: '{count} điểm',
  minutesShort: '{count} phút',
  hoursTracker: '{current} / {target} giờ',
  daysTracker: '{current} / {target} ngày',
} as const
