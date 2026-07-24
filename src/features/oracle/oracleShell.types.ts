export type OracleMode = 'chat' | 'dream_analysis' | 'creative_continuation';

export interface OracleThreadItem {
  id: string;
  title: string;
  mode: OracleMode;
  pinned: boolean;
  archived: boolean;
  updatedAt: string;
  lastTurnAt: string;
  activeRunId?: string | null;
  activeRunStatus?: 'initializing' | 'queued' | 'running' | null;
  activeRunStartedAt?: string | null;
  activeRunAssistantTurnId?: string | null;
  activeRunExpectedMinMs?: number | null;
  activeRunExpectedMaxMs?: number | null;
  activeRunStage?: 'thinking' | 'preparing' | 'completed' | null;
  activeRunStageStartedAt?: string | null;
}

export interface OracleShellMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
  runState?: 'thinking' | 'preparing' | 'responding' | 'completed' | 'cancelled' | 'failed';
  startedAt?: number;
  thoughtCompletedAt?: number;
  presentationStartedAt?: number;
  firstTokenAt?: number;
  completedAt?: number;
  expectedMinMs?: number;
  expectedMaxMs?: number;
  citations?: Array<{
    index: number;
    sourceType: 'academic_source' | 'own_dream' | 'public_dream';
    sourceId: string;
    title: string;
    year?: number;
    excerpt: string;
    detail?: string;
    ruleLinks?: Array<{
      ruleId: string;
      ruleCode: string;
      statement: string;
      localizedStatement?: { vi: string; en: string };
      quote: string;
      evidenceScore: number;
      supportingSourceCount: number;
      verificationKey?: string;
      verificationQuestion?: string;
      localizedVerificationQuestion?: { vi: string; en: string };
      currentUserAnswer?: 'yes' | 'no' | 'unsure' | null;
    }>;
  }>;
  suggestedPrompts?: string[];
  contextUsage?: {
    usedTokens: number;
    maxTokens: number;
    percent: number;
    provider?: string;
    modelName?: string;
  };
  parentTurnId?: string;
  branchRootTurnId?: string;
  supersedesTurnId?: string;
  branch?: {
    index: number;
    total: number;
    previousLeafId?: string;
    nextLeafId?: string;
  };
}
