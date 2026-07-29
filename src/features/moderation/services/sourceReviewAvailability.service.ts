const ACTIVE_READER_BUILD_STAGES = new Set([
  'uploaded',
  'inspecting',
  'extracting_text',
  'resolving_identifiers',
  'fetching_preferred_source',
  'ocr_processing',
  'compiling_reader',
]);

interface ReviewableSourceState {
  _id?: string;
  fullTextStatus?: string;
  extractionStatus?: string;
}

interface TrackedReaderState {
  contributionId?: string | null;
  status?: string;
}

// Locks moderation actions while the source is still building its reader.
export function isSourceReaderBuildInProgress(
  source: ReviewableSourceState,
  trackedReader?: TrackedReaderState,
): boolean {
  const trackedBuildIsActive = Boolean(
    source._id
    && trackedReader?.contributionId === source._id
    && trackedReader.status === 'pending',
  );
  return trackedBuildIsActive
    || source.fullTextStatus === 'importing'
    || ACTIVE_READER_BUILD_STAGES.has(String(source.extractionStatus || ''));
}
