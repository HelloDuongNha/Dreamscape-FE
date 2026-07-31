/** English strings for the achievements calendar and progression page. */
export default {
  calendar: {
    title: 'Calendar',
    subtitle: 'Your dream check-in history',
    dayStreak: 'Day streak',
    totalCheckIns: 'Total check-ins',
    timeOnlineToday: 'Time online today',
    healthWarning: 'Recommendation: Limit daily use to 180 minutes to protect your mental well-being.',
    previousMonth: 'Previous month',
    nextMonth: 'Next month',
    calendarFor: 'Calendar for {month}',
    checkedIn: 'checked in',
    weekdays: {
      mon: 'Mon',
      tue: 'Tue',
      wed: 'Wed',
      thu: 'Thu',
      fri: 'Fri',
      sat: 'Sat',
      sun: 'Sun',
    },
  },
  rank: {
    title: 'Rank progression',
    rulesAria: 'View rank rules',
    rulesTitle: 'Rank rules',
    thresholds: 'Rank thresholds:',
    earningRules: 'How to earn points:',
    dailyLoginRule: 'Earn +10 pts for a daily check-in, plus a streak bonus of up to +5 pts.',
    milestoneRule: 'Complete milestones (+20 pts per milestone).',
    tiers: {
      newDreamer: 'New Dreamer',
      dreamBeginner: 'Dream Beginner',
      interpretationMaster: 'Interpretation Master',
      dreamManipulator: 'Dream Manipulator',
      cosmicWanderer: 'Cosmic Wanderer',
      realityCreator: 'Reality Creator',
    },
  },
  milestones: {
    title: 'Milestones & achievements',
    subtitle: 'Accumulate metrics to earn bonuses',
    completed: 'Completed',
    items: {
      likes: {
        title: 'Total likes received',
        description: 'Likes accumulated across all of your shared dream posts',
      },
      comments: {
        title: 'Total comments received',
        description: 'Responses from other members across all of your posts',
      },
      posts: {
        title: 'Dream journal frequency',
        description: 'Personal dream posts you have published to the community',
      },
      followers: {
        title: 'Followers',
        description: 'Members who currently follow your profile',
      },
      following: {
        title: 'Following',
        description: 'Members whose profiles you currently follow',
      },
      onlineTime: {
        title: 'Total time together',
        description: 'Hours you have spent active on DreamScape',
      },
      streak: {
        title: 'Consistency era',
        description: 'Your longest consecutive check-in streak based on server time',
      },
      contributions: {
        title: 'Academic source contributions',
        description: 'Your academic documents or sources approved for the DreamScape Library',
      },
    },
  },
  pointsShort: '{count} pts',
  minutesShort: '{count}m',
  hoursTracker: '{current} / {target} hours',
  daysTracker: '{current} / {target} days',
} as const
