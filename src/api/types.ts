// ─── API Response Shapes ───────────────────────────────────────────────────────
// These mirror the exact JSON the Express backend returns (SYSTEM_LOG §STEP 2/3/5)

export interface ApiUser {
  _id:            string
  username:       string
  display_name:   string
  avatar:         string
  bio:            string
  follower_count: number
  followers?:     string[]
  following?:     string[]
  isPrivateAccount?: boolean;
  dmPrivacy?:     'everyone' | 'following' | 'friends';
  followersPrivacy?: 'everyone' | 'following' | 'only_me';
  followingPrivacy?: 'everyone' | 'following' | 'only_me';
  followersList?: ApiUser[];
  followingList?: ApiUser[];
  createdAt?:     string
  email?:         string
  defaultPrivacy?: 'public' | 'private'
  birth_date?:     string
  birth_hour?:     string
  // ── Streak & Rank ─────────────────────────────────────────────────────────
  loginHistory?:  string[]   // 'YYYY-MM-DD' strings
  streakCount?:   number
  highestStreak?: number
  rankPoints?:    number
  currentRank?:   string
  dailyTasks?: {
    likeOtherPost: boolean;
    commentOtherPost: boolean;
    createPost: boolean;
    lastResetDate: string;
  };
  achievements?:    string[]
  timeOnlineToday?: number
  lastActiveDate?:  string
  lastHeartbeatAt?: string
}

export interface AiScientificContextNote {
  ruleId:     string
  note:       string
  confidence: number
  dreamEvidence?: string[]
  insightTitle?: string
  boundary?: string
  ruleCode?: string
  ruleStatement?: string
  applicationTier?: 'supported' | 'exploratory'
  academicEvidenceScore?: number
  caseApplicability?: {
    status: 'strong_match' | 'partial_match' | 'mixed' | 'weakened' | 'unresolved'
    answeredCount: number
    totalCount: number
    confirmedCount: number
    weakenedCount: number
    unresolvedCount: number
    conclusion: string
  }
  matchedDreamDetails?: string[]
  evidenceQuotes?: {
    sourceId: string
    chunkId: string
    quote: string
  }[]
  sources?: {
    sourceId: string
    title: string
    authors: string[]
    year?: number
    journal?: string;
    doi?: string
    chunkIds?: string[]
  }[]
}

export interface AiSymbolicNote {
  symbol:        string
  meaning:       string
  relevance:     number
  symbolValence: number
  origin?:        'dictionary' | 'contextual_observation'
  knowledgeStatus?: 'dictionary' | 'observed'
  dictionarySymbol?: string
  dreamEvidence?: string
  contextualTone?: 'threatening' | 'reassuring' | 'ambivalent' | 'neutral'
  motifStats?: {
    previousPersonalDreamCount: number
    similarDreamCount: number
    sameSequenceCount: number
    confirmedContextCount: number
    observedPersonalDreamCount?: number
    observedPublicDreamCount?: number
    observedToneCounts?: Record<'threatening' | 'reassuring' | 'ambivalent' | 'neutral', number>
  }
}

export interface AiCulturalSymbolicNote {
  source: string
  note:   string
}

export interface AiRealLifeHypothesis {
  ruleId?: string | null
  ruleIds?: string[]
  ruleCode?: string
  ruleStatement?: string
  hypothesis:            string
  evidenceFromDream:     string[]
  confidence:            number
  needsUserConfirmation: boolean
  followUpQuestion:      string
  reasonForAsking?:      string
  ifYesMeaning?:         string
  ifNoMeaning?:          string
  questionType?:         'past' | 'present' | 'future'
  verificationKey?:      string
  questionBasis?:        'academic_rule' | 'dream_sequence' | 'sleep_context'
  questionDimension?:    string
  questionGroup?:        string
  answerSemantics?: {
    yes: 'supports' | 'weakens' | 'unresolved'
    no: 'supports' | 'weakens' | 'unresolved'
    unsure: 'unresolved'
  }
  sources?: {
    sourceId: string
    title: string
    authors: string[]
    year?: number
    journal?: string
    doi?: string
    chunkIds?: string[]
  }[]
  userFeedback?:         'yes' | 'no' | 'unsure' | null
}

export interface AiDreamAnalysisResult {
  title:                     string
  emotional_tone:            string
  emotional_valence?:        -2 | -1 | 0 | 1 | 2
  emotional_tone_key?:       'urgent_conflicted' | 'anxious' | 'fearful' | 'sad' | 'calm' | 'mixed' | 'neutral'
  summary:                   string
  core_analysis:             string
  disclaimer:                string
  confidence:                number
  creative_continuation?: {
    title: string
    continuation: string
    connectionToCurrentDream: string
    inspirationIndexes: number[]
    disclaimer: string
    inspirations?: Array<{
      dreamId: string
      title: string
      similarity: number
      matchedOn: string[]
    }>
  }
  case_conclusion?: {
    status: 'preliminary' | 'clarified'
    headline: string
    conclusion: string
    reasoning: string
    confidenceLabel: string
    confirmedFindings: string[]
    ruledOut: string[]
    recommendedNextStep: string
    concern: {
      level: 'no_clear_warning'
      label: string
      explanation: string
      watchFor: string[]
      helpSource: { title: string; url: string }
    }
    evidenceBasis: Array<{
      kind: 'confirmed_context' | 'academic_context' | 'boundary'
      title: string
      detail: string
      sources?: Array<{ sourceId: string; title: string; year?: number; doi?: string }>
    }>
  }
  feedback_conclusion?:      string | null
  feedback_changed_paths?:   string[]
  feedback_changed_fragments?: Record<string, string[]>
  feedback_analysis?: {
    confirmedFacts: string[]
    rejectedDirections: string[]
    unresolvedQuestions: string[]
    interpretation: string
    nextSteps: string[]
  } | null
  grounding_summary?: {
    narrativeUsed: boolean
    resolvedContextCount: number
    unresolvedContextCount: number
    dictionaryMotifCount: number
    contextualMotifCount: number
    appliedRuleCount: number
    explanatoryRuleCount: number
    exploratoryRuleCount?: number
    similarDreamCount: number
    sleepContextFactCount: number
  }
  analysis_mode?:            'llm_grounded' | 'structured_fallback'
  scientific_context_notes?: AiScientificContextNote[]
  symbolic_notes?:           AiSymbolicNote[]
  cultural_symbolic_notes?:  AiCulturalSymbolicNote[]
  real_life_hypotheses?:     AiRealLifeHypothesis[]
  interpretive_threads?: {
    title: string
    dreamEvidence: string[]
    reasoning: string
    alternativeExplanation: string
  }[]
  practical_reflections?: {
    suggestion: string
    rationale: string
  }[]
  similar_dreams?: {
    dreamId: string
    title: string
    excerpt: string
    createdAt: string
    authorDisplayName: string
    sameAuthor: boolean
    similarity: number
    matchedOn: string[]
  }[]
  feedback_revision?: {
    hypothesis: string
    status: 'supported' | 'weakened' | 'unresolved'
    interpretation: string
    ruleId?: string
  }[]
}

export interface ApiDream {
  _id:            string
  userId:         string | ApiUser   // populated by .populate() → may be object
  content:        string
  mood_tag:       string
  is_public:      boolean
  privacy:        'public' | 'private'
  ai_analysis_enabled: boolean
  likes:          string[]           // array of userId strings who liked this post
  likes_count:    number
  comments_count: number
  created_at:     string             // ISO-8601 — used as pagination cursor
  ai_status:      'pending' | 'sensing' | 'completed' | 'failed' | 'cancelled' | 'disabled'
  ai_result:      AiDreamAnalysisResult | null
  aiAnalysis?:    AiDreamAnalysisResult | null
  analysisMetadata?: {
    currentStage?: 'queued' | 'preparing' | 'retrieving_context' | 'retrieving_rules' | 'generating_analysis' | 'finalizing' | 'completed' | 'failed' | 'cancelled'
    failedAtStage?: 'queued' | 'preparing' | 'retrieving_context' | 'retrieving_rules' | 'generating_analysis' | 'finalizing'
    progress?: number
    statusMessage?: string
    currentMiniStep?: string
    stageResults?: Partial<Record<'queued' | 'preparing' | 'retrieving_context' | 'retrieving_rules' | 'generating_analysis' | 'finalizing', string>>
    queuePosition?: number
    enqueuedAt?: string
    startedAt?: string
    processingStartedAt?: string
    processingDurationMs?: number
    generatedAt?: string
    durationMs?: number
    estimatedDurationSeconds?: number
    timingDeltaSeconds?: number
    cancelledAt?: string
    lastReplacementOutcome?: 'cancelled' | 'failed'
    lastReplacementTrigger?: 'retry' | 'dream_addition' | 'addition_retry' | 'content_edit' | 'addition_edit'
    replacementEndedAt?: string
    replacementDurationMs?: number
    hasUnanalyzedAdditions?: boolean
  } | null
  edit_history:   { content: string; editedAt: string }[]
  additions:      {
    sequence: number
    content: string
    addedAt: string
    analysisState?: 'pending' | 'analyzed' | 'unanalyzed'
    analysisRunId?: string
    analyzedAt?: string
  }[]
  versions?: {
    version: number
    content: string
    additions: ApiDream['additions']
    ai_status: ApiDream['ai_status']
    ai_result: AiDreamAnalysisResult | null
    mood_tag: string
    analysisMetadata?: ApiDream['analysisMetadata']
    editedAt: string
    isCurrent: boolean
    isLegacyPartial: boolean
  }[]
}

export interface AuthResponse {
  success: boolean
  message: string
  token:   string
  user:    ApiUser
}

export interface DreamFeedResponse {
  success:    boolean
  data:       ApiDream[]
  limit:      number
  nextCursor: string | null
}

export interface CreateDreamResponse {
  success: boolean
  message: string
  data:    ApiDream
}

export interface UpdateDreamResponse {
  success: boolean
  message: string
  data:    ApiDream
}

/** Server response from POST /api/dreams/:id/like */
export interface LikeResponse {
  success:     boolean
  liked:        boolean    // true = just liked, false = just unliked
  likes_count:  number
  likes:        string[]
}

/** A single comment returned by GET/POST /api/dreams/:id/comments */
export interface ApiComment {
  _id:        string
  dreamId:    string | ApiDream  // populated when fetched via GET /comments/user/:id
  userId:     ApiUser    // always populated by the server
  content:    string
  created_at: string     // ISO-8601
}

export interface CommentListResponse {
  success: boolean
  data:    ApiComment[]
}

// ─── Chat (§6.3 / §6.4) ───────────────────────────────────────────────────────

export interface ApiConversation {
  _id:             string
  participant_ids: ApiUser[]   // populated — always returns full user objects
  last_message:    string
  updated_at:      string      // ISO-8601
  unread_count:    number      // messages from partner with status !== 'seen'
}

export interface ApiMessage {
  _id:            string
  conversationId: string
  senderId:       string | ApiUser  // populated in HTTP response, raw string from socket
  content:        string
  timestamp:      string            // ISO-8601
  status?:        'sent' | 'delivered' | 'seen'  // delivery receipt
}

/** Payload emitted by the server's receive_message socket event */
export interface SocketMessage {
  _id:            string
  conversationId: string
  senderId:       string           // always a raw userId string from socket
  content:        string
  timestamp:      string
  status:         'sent' | 'delivered' | 'seen'
  tempId?:        string           // echoed back to sender so it can swap the optimistic entry
}

/** Payload emitted by the server's message_status_updated socket event */
export interface SocketStatusUpdate {
  messageId?:       string   // present for per-message updates (delivered)
  conversationId?:  string   // present for bulk updates (seen)
  status:           'sent' | 'delivered' | 'seen'
}

export interface MessagingConversationSearchResult {
  user:           ApiUser
  conversationId: string | null
  last_message:   string
  updated_at:     string | null
  source:         'conversation' | 'following'
}

export interface MessagingMessageSearchResult {
  message:        ApiMessage
  conversationId: string
  partner:        ApiUser
}

export interface MessagingSearchResponse {
  conversations: MessagingConversationSearchResult[]
  messages:      MessagingMessageSearchResult[]
}

export interface ApiNotification {
  _id:         string
  recipientId: string
  senderId:    ApiUser
  type:        'like' | 'comment' | 'follow' | 'dream_analysis'
  postId?:     string | Pick<ApiDream, '_id' | 'content'>
  isRead:      boolean
  timestamp:   string
}

// ─── Smart Reader I18N Interfaces ──────────────────────────────────────────

export interface CanonicalReaderBlockIdentity {
  chunkId: string;
  sectionId: string;
  chunkIndex: number;
  contentHash: string;
}

export interface CanonicalReaderSectionIdentity {
  sectionId: string;
  sectionOrder: number | null;
  heading: string | null;
  sectionType: string | null;
}

export interface TableCellData {
  row: number;
  column: number;
  rowSpan: number;
  columnSpan: number;
  text: string;
  role: 'header' | 'data';
}

export interface StructuredTableData {
  version: number;
  source: string;
  reconstructionMethod: string;
  rowCount: number;
  columnCount: number;
  cells: TableCellData[];
}

export interface BaseReaderBlock {
  type: string;
  sectionType: string;
  text: string; // presentation (may be normalized)
  html?: string;
  marker?: string;
  sectionIndex: number;
  headingLevel?: number;
  style?: { pageIndex?: number; doiUrl?: string; [key: string]: unknown };
  sectionIdentity: CanonicalReaderSectionIdentity | null;
  tableData?: StructuredTableData | null;
  actions?: { label: string; url: string }[];
  refNumber?: string;
  supType?: string;
  label?: string;
  fileTypes?: string[];
  description?: string;
}

export interface CanonicalReaderBlock extends BaseReaderBlock {
  blockIdentity: CanonicalReaderBlockIdentity;
  canonicalText: string; // raw unmodified byte-for-byte text from API
}

export interface DerivedReaderBlock extends BaseReaderBlock {
  blockIdentity?: undefined;
  canonicalText?: undefined;
}

export type ReaderBlock = CanonicalReaderBlock | DerivedReaderBlock;

export interface ReaderPage {
  pageIndex: number;
  blocks: ReaderBlock[];
  wordCount: number;
}
