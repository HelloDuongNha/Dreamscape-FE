export interface ReaderBuildTimingSample {
  status?: 'success' | 'failed'
  engine?: string
  sourceType?: string
  durationMs?: number
}

const DEFAULT_STRUCTURED_IMPORT_SECONDS = 35

export function estimateStructuredReaderSeconds(
  snapshots: ReaderBuildTimingSample[] = [],
): number {
  const durations = snapshots
    .filter(isSuccessfulStructuredBuild)
    .map((snapshot) => Number(snapshot.durationMs) / 1000)
    .filter((seconds) => Number.isFinite(seconds) && seconds > 0)
    .slice(-5)
    .sort((left, right) => left - right)

  if (!durations.length) return DEFAULT_STRUCTURED_IMPORT_SECONDS
  const middle = Math.floor(durations.length / 2)
  const median = durations.length % 2
    ? durations[middle]
    : (durations[middle - 1] + durations[middle]) / 2
  return Math.round(Math.min(600, Math.max(5, median)))
}

function isSuccessfulStructuredBuild(snapshot: ReaderBuildTimingSample): boolean {
  if (snapshot.status === 'failed') return false
  const provenance = `${snapshot.engine || ''} ${snapshot.sourceType || ''}`.toLowerCase()
  return /structured|jats|xml|html|plos|frontiers|pmc/.test(provenance)
    && !/docling|uploaded_pdf|ocr/.test(provenance)
}
