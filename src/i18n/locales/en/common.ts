/** English — common shell strings (identical key set to vi/common.ts) */
export default {
  appName: 'DreamScape',
  toggleNav: 'Toggle navigation',
  scrollToTop: 'Scroll to top and refresh feed',
  goHome: 'Go to Home',
  goToProfile: 'Go to my profile',
  // Header search (Home route only)
  searchLabel: 'Search dreams',
  searchPlaceholder: 'Search dreams...',
  clearSearch: 'Clear search',
  pinnedTaskCollapse: 'Tuck notification into the screen edge',
  pinnedTaskExpand: 'Show notification',
  pinnedTaskView: 'View',
  // Locale switch — label names the TARGET language
  switchToEnglish: 'Switch to English',
  switchToVietnamese: 'Chuyển sang tiếng Việt',
  progress: {
    elapsed: 'Running for {duration}', seconds: '{count} seconds', minutes: '{count} minutes',
    minutesSeconds: '{minutes} minutes {seconds} seconds', hoursMinutes: '{hours} hours {minutes} minutes',
    measuring: 'Measuring processing speed to estimate completion', remaining: 'About {duration} remaining',
    overdue: 'Taking {duration} longer than expected · still processing',
  },
  sourceProgress: {
    doclingStagesLabel: 'Docling processing steps',
    receivePdf: 'Receive original PDF', receivePdfDetail: 'Keep the source file intact for verification.',
    inspectOcr: 'Inspect text layer and OCR needs', inspectOcrDetail: 'Identify scanned pages and the recognition strategy.',
    parseDocling: 'Parse layout with Docling', parseDoclingDetail: 'Recover headings, paragraphs, tables, figures, and reading order.',
    cleanOcr: 'Clean OCR errors', cleanOcrDetail: 'Repair characters, spacing, and broken lines before saving.',
    buildReader: 'Build Smart Reader', buildReaderDetail: 'Only cleaned data is written to the final reader.',
  },
} as const
