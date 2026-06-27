<template>
  <div v-if="isLoading" class="calendar-view">
    <!-- Left Column (3/5 width) -->
    <div class="calendar-left">
      <div class="calendar-left__header">
        <AppSkeleton type="text" style="width: 150px; height: 28px;" />
        <AppSkeleton type="text" style="width: 250px; height: 16px; margin-top: 4px;" />
      </div>

      <!-- Stats Row (Day Streak, Total Check-ins, Time Online Today) -->
      <div class="stats-row">
        <div class="stat-card" v-for="i in 3" :key="i" style="align-items: flex-start;">
          <AppSkeleton type="text" style="width: 40px; height: 32px; margin-bottom: 8px;" />
          <AppSkeleton type="text" style="width: 80px; height: 14px;" />
        </div>
      </div>

      <!-- Month Navigator -->
      <div class="month-nav" style="margin-top: 10px;">
        <AppSkeleton type="text" style="width: 200px; height: 24px;" />
      </div>

      <!-- Calendar Grid Skeleton -->
      <div class="calendar-grid-wrapper">
        <div class="calendar-grid">
          <!-- Calendar cells placeholders -->
          <div v-for="i in 35" :key="i" style="background: #101010; border: 1px solid #262626; border-radius: 4px; height: 50px;">
            <AppSkeleton type="text" style="width: 100%; height: 100%; margin: 0; border-radius: 4px;" />
          </div>
        </div>
      </div>
    </div>

    <!-- Right Column (2/5 width) -->
    <div class="calendar-right">
      <!-- Rank Progression Container on Top -->
      <div class="rank-container">
        <AppSkeleton type="text" style="width: 120px; height: 18px;" />
        <AppSkeleton type="text" style="width: 100%; height: 10px; margin-top: 8px;" />
        <AppSkeleton type="text" style="width: 200px; height: 14px; margin-top: 8px;" />
      </div>

      <!-- Achievements & Milestones Container -->
      <div class="achievements-container">
        <div class="achievements-container__header">
          <AppSkeleton type="text" style="width: 180px; height: 18px;" />
          <AppSkeleton type="text" style="width: 220px; height: 14px; margin-top: 4px;" />
        </div>

        <div class="achievements-list" style="margin-top: 12px;">
          <!-- 3 achievement skeletons -->
          <div v-for="i in 3" :key="i" class="achievement-row">
            <div class="achievement-row__header">
              <div class="achievement-row__info">
                <AppSkeleton type="text" style="width: 150px; height: 16px; margin-bottom: 6px;" />
                <AppSkeleton type="text" style="width: 200px; height: 12px;" />
              </div>
              <div class="achievement-row__status">
                <AppSkeleton type="avatar" style="width: 24px; height: 24px; margin-bottom: 4px;" />
                <AppSkeleton type="text" style="width: 40px; height: 10px;" />
              </div>
            </div>
            <AppSkeleton type="text" style="width: 100%; height: 4px; margin: 0;" />
          </div>
        </div>
      </div>
    </div>
  </div>

  <div v-else class="calendar-view">
    <!-- Left Column (3/5 width) -->
    <div class="calendar-left">
      <div class="calendar-left__header">
        <h1 class="calendar-left__title">Calendar</h1>
        <p class="calendar-left__subtitle">Your dream check-in history</p>
      </div>

      <!-- Stats Row (Day Streak, Total Check-ins, Time Online Today) -->
      <div class="stats-row">
        <div class="stat-card">
          <span class="stat-card__value">{{ streakCount }}</span>
          <span class="stat-card__label">Day Streak</span>
        </div>
        <div class="stat-card">
          <span class="stat-card__value">{{ loginHistory.length }}</span>
          <span class="stat-card__label">Total Check-ins</span>
        </div>
        <div class="stat-card">
          <span class="stat-card__value">{{ timeOnlineToday }}m</span>
          <span class="stat-card__label">Time Online Today</span>
        </div>
      </div>

      <!-- Health Warning Text Footer -->
      <p class="health-warning-text">
        Khuyến nghị: Không sử dụng quá 180 phút mỗi ngày để bảo vệ sức khỏe tâm thần.
      </p>

      <!-- Month Navigator -->
      <div class="month-nav">
        <button id="prev-month-btn" class="month-nav__btn" aria-label="Previous month" @click="shiftMonth(-1)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <span class="month-nav__label">{{ monthLabel }}</span>
        <button id="next-month-btn" class="month-nav__btn" aria-label="Next month" @click="shiftMonth(1)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>

      <!-- Calendar Grid -->
      <div class="calendar-grid-wrapper">
        <div class="calendar-grid" role="grid" :aria-label="`Calendar for ${monthLabel}`">
          <!-- Weekday headers -->
          <div
            v-for="day in WEEKDAYS"
            :key="day"
            class="calendar-grid__weekday"
            role="columnheader"
            :aria-label="day"
          >
            {{ day }}
          </div>

          <!-- Empty cells before month start -->
          <CalendarCell
            v-for="n in startPadding"
            :key="`pad-${n}`"
            :isEmpty="true"
          />

          <!-- Day cells -->
          <CalendarCell
            v-for="day in daysInMonth"
            :key="day"
            :id="`calendar-day-${viewYear}-${viewMonth + 1}-${day}`"
            :dayNum="day"
            :isToday="isToday(day)"
            :isCheckedIn="isCheckedIn(day)"
            :isFuture="isFuture(day)"
            :ariaLabel="`${day} ${monthLabel}${isCheckedIn(day) ? ' — checked in' : ''}`"
          />

          <!-- Empty cells after month end to fill up to 42 cells (6 rows * 7 days) -->
          <CalendarCell
            v-for="n in (42 - startPadding - daysInMonth)"
            :key="`pad-end-${n}`"
            :isEmpty="true"
          />
        </div>
      </div>
    </div>

    <!-- Right Column (2/5 width) -->
    <div class="calendar-right">
      <!-- Rank Progression Container on Top -->
      <div class="rank-container">
        <div class="rank-container__header">
          <div class="rank-title-wrapper">
            <span class="rank-container__title">Rank Progression</span>
            <button
              ref="rankRulesBtnRef"
              type="button"
              class="info-question-btn"
              @click.stop="toggleRankRules"
              aria-label="Xem Quy tắc Xếp hạng"
            >
              ?
            </button>

            <!-- Floating Popover Dialog -->
            <div v-if="showRankRules" ref="popoverRef" class="rank-rules-popover" @click.stop>
              <div class="rank-rules-popover__header">
                <span>Quy tắc Xếp hạng</span>
              </div>
              <div class="rank-rules-popover__content">
                <p class="rules-section-title">Ngưỡng Xếp hạng:</p>
                <ul class="rules-list">
                  <li v-for="tier in RANK_TIERS" :key="tier.title" :style="{ color: tier.color || '#fff' }">
                    <strong>{{ tier.title }}</strong>: {{ tier.minPoints === 15001 ? '15001+' : (tier.minPoints + '+') }} pts
                  </li>
                </ul>
                <p class="rules-section-title mt-8">Quy tắc tích điểm:</p>
                <p class="rules-text">
                  • Nhận +10 pts đăng nhập hàng ngày + lợi tức chuỗi tối đa +5 pts.<br>
                  • Hoàn thành milestones (+20 pts mỗi mốc).
                </p>
              </div>
            </div>
          </div>
          <span class="rank-container__score-ratio">{{ rankPoints }} / {{ nextTierPoints }}</span>
        </div>

        <!-- Progress Bar -->
        <AppProgressBar :value="rankPoints" :max="nextTierPoints" :color="activeRankColor" height="6px" />

        <!-- Rank Names Row -->
        <div class="rank-names-row">
          <span class="rank-name--current">{{ currentRank }}</span>
          <span class="rank-name--next" v-if="nextRankName">{{ nextRankName }}</span>
        </div>
      </div>

      <!-- Achievements & Milestones Container -->
      <div class="achievements-container">
        <div class="achievements-container__header">
          <span class="achievements-container__title">Milestones & Achievements</span>
          <span class="achievements-container__subtitle">Accumulate metrics to earn bonuses</span>
        </div>

        <div class="achievements-list">
          <div
            v-for="item in achievements"
            :key="item.title"
            class="achievement-row"
          >
            <div class="achievement-row__header">
              <div class="achievement-row__info">
                <span class="achievement-row__title">{{ item.title }}</span>
                <span class="achievement-row__subtitle">{{ item.description }}</span>
              </div>
              <div class="achievement-row__status">
                <span class="achievement-row__reward" v-if="!item.isCompleted">+{{ item.rewardPoints }} pts</span>
                <span class="achievement-row__reward" v-else>[Đã hoàn thành]</span>
                <span class="achievement-row__ratio">{{ item.trackerText }}</span>
              </div>
            </div>
            <AppProgressBar :value="item.value" :max="item.target" :color="item.color" height="4px" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '@/store/useAuthStore'
import apiClient from '@/api/client'
import AppProgressBar from '@/components/common/AppProgressBar.vue'
import CalendarCell from '@/components/common/CalendarCell.vue'
import AppSkeleton from '@/components/common/AppSkeleton.vue'

// ── Rank tiers (mirror of BE/src/utils/rankEngine.ts) ──────────────────────
const RANK_TIERS = [
  { minPoints: 0,     title: 'Nhà Mơ Mộng Mới',       color: '#B45309' },
  { minPoints: 101,   title: 'Người Bắt Đầu Mơ',      color: '#94A3B8' },
  { minPoints: 501,   title: 'Bậc Thầy Giải Mã',      color: '#F59E0B' },
  { minPoints: 2001,  title: 'Kẻ Thao Túng Giấc Mơ',   color: '#06B6D4' },
  { minPoints: 5001,  title: 'Độc Hành Tinh Không',    color: '#A855F7' },
  { minPoints: 15001, title: 'Đấng Sáng Tạo Thực Tại', color: '#EF4444' },
]

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const authStore = useAuthStore()

// ── State ─────────────────────────────────────────────────────────────────
const loginHistory = ref<string[]>(authStore.user?.loginHistory ?? [])
const streakCount  = ref<number>(authStore.user?.streakCount ?? 0)
const highestStreak = ref<number>(authStore.user?.highestStreak ?? 0)
const rankPoints   = ref<number>(authStore.user?.rankPoints ?? 0)
const currentRank  = ref<string>(authStore.user?.currentRank ?? 'Nhà Mơ Mộng Mới')
const isLoading    = ref(true)

const achievementsList = ref<string[]>(authStore.user?.achievements ?? [])
const totalLikesReceived = ref<number>(0)
const totalCommentsReceived = ref<number>(0)
const timeOnlineToday = ref<number>(authStore.user?.timeOnlineToday ?? 0)

const postsCount = ref<number>(0)
const followersCount = ref<number>(0)
const followingCount = ref<number>(0)
const totalTimeOnline = ref<number>(0)
const approvedSourceCount = ref<number>(0)
const showRankRules = ref(false)
const popoverRef = ref<HTMLElement | null>(null)
const rankRulesBtnRef = ref<HTMLElement | null>(null)

// View date state — defaults to the current month fallback until serverDate is loaded
const now = new Date()
const viewYear  = ref(now.getFullYear())
const viewMonth = ref(now.getMonth()) // 0-indexed
const serverDateStr = ref('')

function toggleRankRules() {
  showRankRules.value = !showRankRules.value
}

function handleOutsideClick(e: MouseEvent) {
  if (!showRankRules.value) return
  const target = e.target as Node
  if (popoverRef.value && !popoverRef.value.contains(target) &&
      rankRulesBtnRef.value && !rankRulesBtnRef.value.contains(target)) {
    showRankRules.value = false
  }
}

const nextRankName = computed(() => {
  const currentIdx = RANK_TIERS.findIndex(t => t.title === currentRank.value)
  if (currentIdx !== -1 && currentIdx < RANK_TIERS.length - 1) {
    return RANK_TIERS[currentIdx + 1].title
  }
  return null
})

// ── Overhauled 7 achievements calculation ──────────────────────────────────────────
const achievements = computed(() => {
  // Row 1: Likes received
  const likesVal = totalLikesReceived.value
  const likesMilestones = [10, 100, 1000, 10000, 100000, 1000000]
  let likesTarget = 1000000
  let likesIsCompleted = false
  for (const m of likesMilestones) {
    if (likesVal < m) {
      likesTarget = m
      break
    }
  }
  if (likesVal >= 1000000) {
    likesTarget = 1000000
    likesIsCompleted = true
  }

  // Row 2: Comments received
  const commentsVal = totalCommentsReceived.value
  const commentsMilestones = [10, 100, 1000, 10000, 100000, 1000000]
  let commentsTarget = 1000000
  let commentsIsCompleted = false
  for (const m of commentsMilestones) {
    if (commentsVal < m) {
      commentsTarget = m
      break
    }
  }
  if (commentsVal >= 1000000) {
    commentsTarget = 1000000
    commentsIsCompleted = true
  }

  // Row 3: Dream posts
  const postsVal = postsCount.value
  const postsMilestones = [10, 20, 40, 60, 80, 100]
  let postsTarget = 100
  let postsIsCompleted = false
  for (const m of postsMilestones) {
    if (postsVal < m) {
      postsTarget = m
      break
    }
  }
  if (postsVal >= 100) {
    postsTarget = 100
    postsIsCompleted = true
  }

  // Row 4: Followers
  const followersVal = followersCount.value
  const followersMilestones = [10, 100, 1000, 10000, 100000, 1000000]
  let followersTarget = 1000000
  let followersIsCompleted = false
  for (const m of followersMilestones) {
    if (followersVal < m) {
      followersTarget = m
      break
    }
  }
  if (followersVal >= 1000000) {
    followersTarget = 1000000
    followersIsCompleted = true
  }

  // Row 5: Following
  const followingVal = followingCount.value
  const followingMilestones = [10, 100, 1000, 10000, 100000, 1000000]
  let followingTarget = 1000000
  let followingIsCompleted = false
  for (const m of followingMilestones) {
    if (followingVal < m) {
      followingTarget = m
      break
    }
  }
  if (followingVal >= 1000000) {
    followingTarget = 1000000
    followingIsCompleted = true
  }

  // Row 6: Online hours — combine DB baseline + today's live minutes, then convert
  const totalCombinedMinutes = totalTimeOnline.value + timeOnlineToday.value
  const totalHoursVal = Math.round(totalCombinedMinutes / 60)
  const hoursMilestones = [10, 20, 40, 60, 80, 100]
  let hoursTarget = 100
  let hoursIsCompleted = false
  for (const m of hoursMilestones) {
    if (totalHoursVal < m) {
      hoursTarget = m
      break
    }
  }
  if (totalHoursVal >= 100) {
    hoursTarget = 100
    hoursIsCompleted = true
  }

  // Row 7: Streak milestones
  const streakVal = highestStreak.value
  const streakMilestones = [
    { target: 10,  points: 20 },
    { target: 30,  points: 50 },
    { target: 90,  points: 100 },
    { target: 180, points: 200 },
    { target: 270, points: 350 },
    { target: 365, points: 500 }
  ]
  let streakTarget = 365
  let streakPoints = 500
  let streakIsCompleted = false
  for (const m of streakMilestones) {
    if (streakVal < m.target) {
      streakTarget = m.target
      streakPoints = m.points
      break
    }
  }
  if (streakVal >= 365) {
    streakTarget = 365
    streakPoints = 500
    streakIsCompleted = true
  }

  // Helper for dynamic colors matching milestones
  const getMilestoneColor = (target: number, isHoursOrPosts = false) => {
    const arr = isHoursOrPosts ? [10, 20, 40, 60, 80, 100] : [10, 100, 1000, 10000, 100000, 1000000]
    const idx = arr.indexOf(target)
    if (idx === 0) return '#B45309'
    if (idx === 1) return '#94A3B8'
    if (idx === 2) return '#F59E0B'
    if (idx === 3) return '#06B6D4'
    if (idx === 4) return '#A855F7'
    return '#EF4444'
  }

  const getStreakMilestoneColor = (target: number) => {
    const targets = [10, 30, 90, 180, 270, 365]
    const idx = targets.indexOf(target)
    if (idx === 0) return '#B45309'
    if (idx === 1) return '#94A3B8'
    if (idx === 2) return '#F59E0B'
    if (idx === 3) return '#06B6D4'
    if (idx === 4) return '#A855F7'
    return '#EF4444'
  }

  // Row 8: Contribution approved sources
  const contributionVal = approvedSourceCount.value
  const contributionMilestones = [1, 5, 10, 25, 50, 100]
  let contributionTarget = 100
  let contributionIsCompleted = false
  for (const m of contributionMilestones) {
    if (contributionVal < m) {
      contributionTarget = m
      break
    }
  }
  if (contributionVal >= 100) {
    contributionTarget = 100
    contributionIsCompleted = true
  }

  const getContributionMilestoneColor = (target: number) => {
    const targets = [1, 5, 10, 25, 50, 100]
    const idx = targets.indexOf(target)
    if (idx === 0) return '#B45309'
    if (idx === 1) return '#94A3B8'
    if (idx === 2) return '#F59E0B'
    if (idx === 3) return '#06B6D4'
    if (idx === 4) return '#A855F7'
    return '#EF4444'
  }

  return [
    {
      title: 'Tổng lượt thích nhận được',
      description: 'Tổng số lượt thả tim tích lũy trên tất cả bài chia sẻ giấc mơ của bạn',
      value: likesVal,
      target: likesTarget,
      isCompleted: likesIsCompleted,
      color: getMilestoneColor(likesTarget),
      trackerText: `${likesVal} / ${likesTarget}`,
      rewardPoints: 20
    },
    {
      title: 'Tổng bình luận nhận được',
      description: 'Tổng số lượt phản hồi từ các thành viên khác trên các bài đăng của bạn',
      value: commentsVal,
      target: commentsTarget,
      isCompleted: commentsIsCompleted,
      color: getMilestoneColor(commentsTarget),
      trackerText: `${commentsVal} / ${commentsTarget}`,
      rewardPoints: 20
    },
    {
      title: 'Tần suất ghi chép giấc mơ',
      description: 'Tổng số bài viết chia sẻ giấc mơ cá nhân đã đăng tải lên mạng xã hội',
      value: postsVal,
      target: postsTarget,
      isCompleted: postsIsCompleted,
      color: getMilestoneColor(postsTarget, true),
      trackerText: `${postsVal} / ${postsTarget}`,
      rewardPoints: 20
    },
    {
      title: 'Số lượng người theo dõi',
      description: 'Tổng số thành viên khác đang ấn theo dõi hồ sơ của bạn',
      value: followersVal,
      target: followersTarget,
      isCompleted: followersIsCompleted,
      color: getMilestoneColor(followersTarget),
      trackerText: `${followersVal} / ${followersTarget}`,
      rewardPoints: 20
    },
    {
      title: 'Số lượng người đang theo dõi',
      description: 'Tổng số thành viên khác mà bạn đang chủ động nhấn theo dõi',
      value: followingVal,
      target: followingTarget,
      isCompleted: followingIsCompleted,
      color: getMilestoneColor(followingTarget),
      trackerText: `${followingVal} / ${followingTarget}`,
      rewardPoints: 20
    },
    {
      title: 'Tổng thời gian đồng hành',
      description: 'Tổng số giờ tích lũy bạn hoạt động trực tuyến trên hệ thống',
      value: totalHoursVal,
      target: hoursTarget,
      isCompleted: hoursIsCompleted,
      color: getMilestoneColor(hoursTarget, true),
      trackerText: `${totalHoursVal} / ${hoursTarget} hours`,
      rewardPoints: 20
    },
    {
      title: 'Kỷ nguyên gắn kết',
      description: 'Tổng số ngày đăng nhập liên tục dựa trên múi giờ hệ thống server',
      value: streakVal,
      target: streakTarget,
      isCompleted: streakIsCompleted,
      color: getStreakMilestoneColor(streakTarget),
      trackerText: `${streakVal} / ${streakTarget} days`,
      rewardPoints: streakPoints
    },
    {
      title: 'Đóng góp tài liệu học thuật',
      description: 'Tổng số tài liệu hoặc nguồn học thuật của bạn đã được duyệt vào thư viện DreamScape',
      value: contributionVal,
      target: contributionTarget,
      isCompleted: contributionIsCompleted,
      color: getContributionMilestoneColor(contributionTarget),
      trackerText: `${contributionVal} / ${contributionTarget}`,
      rewardPoints: 20
    }
  ]
})

const nextTierPoints = computed(() => {
  const pts = rankPoints.value
  if (pts <= 100) return 100
  if (pts <= 500) return 500
  if (pts <= 2000) return 2000
  if (pts <= 5000) return 5000
  if (pts <= 15000) return 15000
  return 15000
})

const activeRankColor = computed(() => {
  const tier = RANK_TIERS.find(t => t.title === currentRank.value)
  return tier ? tier.color : '#B45309'
})

let localTimer: any = null

// ── Fetch from API (fresh data, in case user just earned points) ───────────
onMounted(async () => {
  try {
    isLoading.value = true
    const { data } = await apiClient.get<{
      success: boolean
      loginHistory: string[]
      streakCount: number
      highestStreak?: number
      rankPoints: number
      currentRank: string
      achievements?: string[]
      totalLikesReceived?: number
      totalCommentsReceived?: number
      timeOnlineToday?: number
      serverDate?: string
      postsCount?: number
      followersCount?: number
      followingCount?: number
      totalTimeOnline?: number
    }>('/users/me/streak-calendar')
    if (data.success) {
      loginHistory.value = data.loginHistory
      streakCount.value  = data.streakCount
      highestStreak.value = data.highestStreak ?? 0
      rankPoints.value   = data.rankPoints
      currentRank.value  = data.currentRank
      achievementsList.value = data.achievements ?? []
      totalLikesReceived.value = data.totalLikesReceived ?? 0
      totalCommentsReceived.value = data.totalCommentsReceived ?? 0
      timeOnlineToday.value = data.timeOnlineToday ?? 0
      postsCount.value = data.postsCount ?? 0
      followersCount.value = data.followersCount ?? 0
      followingCount.value = data.followingCount ?? 0
      totalTimeOnline.value = data.totalTimeOnline ?? 0
      approvedSourceCount.value = (data as any).contributionStats?.approvedSourceCount ?? 0

      if (data.serverDate) {
        serverDateStr.value = data.serverDate
        const [year, month] = data.serverDate.split('-').map(Number)
        viewYear.value = year
        viewMonth.value = month - 1 // 0-indexed
      }

      // Sync back to authStore so other components stay in sync
      if (authStore.user) {
        authStore.updateCurrentUser({
          ...authStore.user,
          loginHistory: data.loginHistory,
          streakCount:  data.streakCount,
          highestStreak: data.highestStreak,
          rankPoints:   data.rankPoints,
          currentRank:  data.currentRank,
          achievements: data.achievements,
          timeOnlineToday: data.timeOnlineToday,
        })
      }
    }
  } catch (err) {
    console.error('Failed to fetch streak calendar:', err)
  } finally {
    isLoading.value = false
  }

  // Local timer to increment the reactive minute counter online in real-time
  localTimer = setInterval(() => {
    timeOnlineToday.value += 1
    totalTimeOnline.value += 1
    if (authStore.user) {
      authStore.updateCurrentUser({
        ...authStore.user,
        timeOnlineToday: timeOnlineToday.value
      })
    }
  }, 60000)

  // Click-outside handler for rank rules popover
  document.addEventListener('click', handleOutsideClick)
})

onUnmounted(() => {
  if (localTimer) clearInterval(localTimer)
  document.removeEventListener('click', handleOutsideClick)
})

// ── Computed: month metadata ───────────────────────────────────────────────
const monthLabel = computed(() => {
  return new Date(viewYear.value, viewMonth.value, 1)
    .toLocaleString('default', { month: 'long', year: 'numeric' })
})

const daysInMonth = computed(() => {
  return new Date(viewYear.value, viewMonth.value + 1, 0).getDate()
})

const startPadding = computed(() => {
  const dayOfWeek = new Date(viewYear.value, viewMonth.value, 1).getDay()
  return dayOfWeek === 0 ? 6 : dayOfWeek - 1
})

const isCurrentMonth = computed(() => {
  if (serverDateStr.value) {
    const [year, month] = serverDateStr.value.split('-').map(Number)
    return viewYear.value === year && viewMonth.value === (month - 1)
  }
  return viewYear.value === now.getFullYear() && viewMonth.value === now.getMonth()
})

// ── Helpers ───────────────────────────────────────────────────────────────
function toDateStr(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function isCheckedIn(day: number): boolean {
  return loginHistory.value.includes(toDateStr(viewYear.value, viewMonth.value, day))
}

function isToday(day: number): boolean {
  if (serverDateStr.value) {
    const todayStr = toDateStr(viewYear.value, viewMonth.value, day)
    return serverDateStr.value === todayStr
  }
  return (
    isCurrentMonth.value &&
    day === now.getDate()
  )
}

function isFuture(day: number): boolean {
  if (serverDateStr.value) {
    const cellDateStr = toDateStr(viewYear.value, viewMonth.value, day)
    return cellDateStr > serverDateStr.value
  }
  const cellDate = new Date(viewYear.value, viewMonth.value, day)
  return cellDate > now
}

function shiftMonth(delta: number): void {
  let m = viewMonth.value + delta
  let y = viewYear.value
  if (m < 0)  { m = 11; y -= 1 }
  if (m > 11) { m = 0;  y += 1 }
  viewMonth.value = m
  viewYear.value  = y
}
</script>

<style scoped>
/* ── Layout shell ─────────────────────────────────────────────────────── */
.calendar-view {
  max-width: 1100px;
  margin: 0 auto;
  display: flex;
  gap: 24px;
  height: calc(100vh - var(--header-height) - 48px);
  overflow: hidden;
  box-sizing: border-box;
  width: 100%;
}

/* Columns */
.calendar-left {
  flex: 3;
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 0;
  height: 100%;
}

.calendar-right {
  flex: 2;
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 0;
  height: 100%;
}

/* ── Left Column Elements ─────────────────────────────────────────────── */
.calendar-left__header {
  flex-shrink: 0;
}

.calendar-left__title {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  color: #ffffff;
  letter-spacing: -0.3px;
}

.calendar-left__subtitle {
  margin: 4px 0 0;
  font-size: 13px;
  color: #737373;
}

/* Stats Row */
.stats-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  flex-shrink: 0;
}

.stat-card-wrapper {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.stat-card {
  background: #181818;
  border: 1px solid #262626;
  border-radius: 6px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  flex: 1;
}

.stat-card__value {
  font-size: 28px;
  font-weight: 700;
  color: #ffffff;
  line-height: 1;
}

.stat-card__label {
  font-size: 12px;
  color: #737373;
  text-align: center;
}

/* Health Warning text */
.health-warning-text {
  margin: 0;
  font-size: 10.5px;
  color: #555555;
  line-height: 1.3;
  text-align: center;
}

/* Month Navigator */
.month-nav {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.month-nav__btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #181818;
  border: 1px solid #262626;
  border-radius: 4px;
  color: #737373;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.month-nav__btn:hover:not(:disabled) {
  background: #202020;
  color: #ffffff;
}

.month-nav__btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.month-nav__label {
  font-size: 15px;
  font-weight: 600;
  color: #ffffff;
  min-width: 160px;
  text-align: center;
}

/* Calendar Grid */
.calendar-grid-wrapper {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  width: 100%;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  grid-template-rows: 24px repeat(6, min-content);
  width: 100%;
  gap: 6px;
}

.calendar-grid__weekday {
  text-align: center;
  font-size: 11px;
  font-weight: 600;
  color: #555;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 0;
  line-height: 24px;
  height: 24px;
  width: 100%;
}

/* ── Right Column Elements ────────────────────────────────────────────── */
.rank-container {
  background: #181818;
  border: 1px solid #262626;
  border-radius: 6px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex-shrink: 0;
}

.rank-container__header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.rank-container__title {
  font-size: 14px;
  font-weight: 600;
  color: #ffffff;
}

.rank-container__score-ratio {
  font-size: 12px;
  font-weight: 700;
  color: #10B981;
  font-family: var(--font-family-mono, monospace);
}

.rank-title-wrapper {
  display: flex;
  align-items: center;
  gap: 6px;
  position: relative;
}

.info-question-btn {
  background: #181818;
  border: 1px solid #262626;
  border-radius: 50%;
  width: 16px;
  height: 16px;
  font-size: 10px;
  font-weight: bold;
  color: #737373;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  transition: border-color 0.15s, color 0.15s;
}

.info-question-btn:hover {
  border-color: #555;
  color: #ffffff;
}

.rank-rules-popover {
  position: absolute;
  top: 24px;
  left: 0;
  z-index: 100;
  width: 280px;
  background: #181818;
  border: 1px solid #262626;
  border-radius: 4px;
  padding: 12px;
  box-sizing: border-box;
}

.rank-rules-popover__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #262626;
  padding-bottom: 6px;
  margin-bottom: 8px;
  font-size: 12px;
  font-weight: 600;
  color: #ffffff;
}

.close-popover-btn {
  background: transparent;
  border: none;
  color: #737373;
  font-size: 14px;
  cursor: pointer;
  padding: 0;
}

.close-popover-btn:hover {
  color: #ffffff;
}

.rank-rules-popover__content {
  font-size: 11px;
  color: #737373;
  line-height: 1.4;
}

.rules-section-title {
  margin: 0 0 4px 0;
  font-weight: 600;
  color: #ffffff;
}

.mt-8 {
  margin-top: 8px;
}

.rules-list {
  margin: 0 0 8px 0;
  padding-left: 12px;
  list-style-type: disc;
}

.rules-list li {
  margin-bottom: 2px;
}

.rules-text {
  margin: 0;
}

.rank-names-row {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  font-weight: 600;
  color: #737373;
  margin-top: 4px;
}

.rank-name--current {
  color: #ffffff;
}

/* Achievements Container */
.achievements-container {
  background: #181818;
  border: 1px solid #262626;
  border-radius: 6px;
  padding: 16px;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
}

.achievements-container__header {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex-shrink: 0;
}

.achievements-container__title {
  font-size: 14px;
  font-weight: 600;
  color: #ffffff;
}

.achievements-container__subtitle {
  font-size: 11px;
  color: #737373;
}

.achievements-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
  flex: 1;
}

.achievement-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: #101010;
  border: 1px solid #262626;
  border-radius: 4px;
  box-sizing: border-box;
}

.achievement-row__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
}

.achievement-row__info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}

.achievement-row__title {
  font-size: 13px;
  color: #ffffff;
  font-weight: 600;
}

.achievement-row__subtitle {
  font-size: 11px;
  color: #737373;
  line-height: 1.3;
}

.achievement-row__status {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  flex-shrink: 0;
}

.achievement-row__reward {
  font-size: 11px;
  font-weight: 600;
  color: #10B981; /* technical rewards display in flat emerald */
}

.achievement-row__ratio {
  font-size: 11px;
  font-weight: 700;
  color: #3B82F6;
  font-family: var(--font-family-mono, monospace);
}

/* ── Responsive ───────────────────────────────────────────────────────── */
@media (max-width: 768px) {
  .calendar-view {
    flex-direction: column;
    overflow-y: auto;
    height: auto;
  }
  .calendar-left, .calendar-right {
    height: auto;
  }
}
</style>
