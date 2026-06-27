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
}

export interface AiCulturalSymbolicNote {
  source: string
  note:   string
}

export interface AiRealLifeHypothesis {
  hypothesis:            string
  evidenceFromDream:     string[]
  confidence:            number
  needsUserConfirmation: boolean
  followUpQuestion:      string
  userFeedback?:         'yes' | 'no' | 'unsure' | null
}

export interface AiDreamAnalysisResult {
  title:                     string
  emotional_tone:            string
  summary:                   string
  core_analysis:             string
  disclaimer:                string
  confidence:                number
  dreamValenceScore:         number
  scientific_context_notes?: AiScientificContextNote[]
  symbolic_notes?:           AiSymbolicNote[]
  cultural_symbolic_notes?:  AiCulturalSymbolicNote[]
  real_life_hypotheses?:     AiRealLifeHypothesis[]
}

export interface ApiDream {
  _id:            string
  userId:         string | ApiUser   // populated by .populate() → may be object
  content:        string
  mood_tag:       string
  is_public:      boolean
  privacy:        'public' | 'private'
  likes:          string[]           // array of userId strings who liked this post
  likes_count:    number
  comments_count: number
  created_at:     string             // ISO-8601 — used as pagination cursor
  ai_status:      'pending' | 'sensing' | 'completed' | 'failed'
  ai_result:      AiDreamAnalysisResult | null
  aiAnalysis?:    AiDreamAnalysisResult | null
  edit_history:   { content: string; editedAt: string }[]
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

export interface ApiNotification {
  _id:         string
  recipientId: string
  senderId:    ApiUser
  type:        'like' | 'comment' | 'follow'
  postId?:     string
  isRead:      boolean
  timestamp:   string
}
