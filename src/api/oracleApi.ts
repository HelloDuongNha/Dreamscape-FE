import apiClient from './client'
import type { OracleMode } from '@/features/oracle/oracleShell.types'
import type { AiDreamAnalysisResult } from './types'

export interface OracleThreadDto {
  _id: string
  title: string
  mode: OracleMode
  pinned: boolean
  archived: boolean
  createdAt: string
  updatedAt: string
  lastTurnAt: string
  activeRunId?: string | null
  activeRunStatus?: 'initializing' | 'queued' | 'running' | null
  activeRunStartedAt?: string | null
  activeRunAssistantTurnId?: string | null
  activeRunExpectedMinMs?: number | null
  activeRunExpectedMaxMs?: number | null
  activeRunStage?: 'thinking' | 'preparing' | 'completed' | null
  activeRunStageStartedAt?: string | null
}

export interface OracleTurnDto {
  _id: string
  role: 'user' | 'assistant'
  status: 'queued' | 'streaming' | 'completed' | 'failed' | 'cancelled'
  sequence: number
  parentTurnId?: string
  branchRootTurnId?: string
  supersedesTurnId?: string
  contentBlocks: Array<{ type: 'text'; text: string }>
  citations?: OracleCitationDto[]
  suggestedPrompts?: string[]
  contextUsage?: {
    usedTokens: number
    maxTokens: number
    percent: number
    provider?: string
    modelName?: string
    includedMessages?: number
    omittedMessages?: number
  }
  runTiming?: {
    startedAt: string
    thoughtCompletedAt: string
    completedAt: string
    expectedMinMs?: number
    expectedMaxMs?: number
  }
  createdAt: string
}

export interface OracleCitationDto {
  index: number
  sourceType: 'academic_source' | 'own_dream' | 'public_dream'
  sourceId: string
  title: string
  year?: number
  excerpt: string
  doi?: string
  detail?: string
  ruleLinks?: OracleCitationRuleLinkDto[]
}

export interface OracleCitationRuleLinkDto {
  ruleId: string
  ruleCode: string
  statement: string
  localizedStatement?: { vi: string; en: string }
  quote: string
  evidenceScore: number
  sourceEvidenceScore?: number
  userValidationAdjustment?: number
  usageExcerpt?: string
  supportingSourceCount: number
  verificationKey?: string
  verificationQuestion?: string
  localizedVerificationQuestion?: { vi: string; en: string }
  currentUserAnswer?: 'yes' | 'no' | 'unsure' | null
  dreamHypothesisIndex?: number
  dreamVerificationKey?: string
}

export interface OracleRuleScoreUpdateDto {
  ruleId: string
  score: number
  previousScore: number
  scoreDelta: number
  validationAdjustment: number
  relation: 'direct' | 'shared_quote'
  voteDelta: -2 | -1 | 0 | 1 | 2
}

export interface OracleCitationFeedbackResult {
  ruleId: string
  answer: 'yes' | 'no' | 'unsure' | null
  score: number
  scoreDelta: number
  voteDelta: -2 | 0 | 2
  scoreUpdates: OracleRuleScoreUpdateDto[]
}

export interface DreamHypothesisFeedbackData {
  analysis?: AiDreamAnalysisResult
  feedbackRevision?: NonNullable<AiDreamAnalysisResult['feedback_revision']>
  feedbackConclusion?: string | null
  ruleScoreUpdates?: OracleRuleScoreUpdateDto[]
  ruleId?: string
  answer?: 'yes' | 'no' | 'unsure' | null
  score?: number
  scoreDelta?: number
}

export interface DreamHypothesisFeedbackResponse {
  success: boolean
  data: DreamHypothesisFeedbackData
}

export interface OracleRunDto {
  userTurnId: string
  assistantTurnId: string
  runId: string
  status: string
  replayed: boolean
}

export interface OracleRunStatusDto {
  runId: string
  threadId: string
  assistantTurnId: string
  status: 'initializing' | 'queued' | 'running' | 'completed' | 'cancelled' | 'failed'
  startedAt: string
  completedAt?: string | null
  expectedMinMs?: number | null
  expectedMaxMs?: number | null
  stage?: 'thinking' | 'preparing' | 'completed' | null
  stageStartedAt?: string | null
  errorCode?: string | null
}

export async function submitOracleCitationFeedback(input: {
  turnId: string
  citationIndex: number
  sourceId?: string
  ruleId: string
  answer: 'yes' | 'no' | 'unsure' | null
}): Promise<OracleCitationFeedbackResult> {
  const { data } = await apiClient.post<OracleResponse<OracleCitationFeedbackResult>>(
    `/oracle/turns/${input.turnId}/citations/${input.citationIndex}/feedback`,
    {
    ruleId: input.ruleId,
    answer: input.answer,
    },
    { params: input.sourceId ? { sourceId: input.sourceId } : undefined },
  )
  return data.data
}

export async function getOracleCitationDetails(
  turnId: string,
  citationIndex: number,
  sourceId?: string,
): Promise<OracleCitationDto> {
  const { data } = await apiClient.get<OracleResponse<OracleCitationDto>>(
    `/oracle/turns/${turnId}/citations/${citationIndex}`,
    { params: sourceId ? { sourceId } : undefined },
  )
  return data.data
}

export interface OracleStreamEvent {
  sequence: number
  type: 'token' | 'done' | 'error' | 'cancelled' | 'tool_start' | 'tool_progress' | 'tool_complete' | 'citation'
  payload: Record<string, unknown>
}

interface OracleResponse<T> {
  success: boolean
  data: T
}

export interface OracleCredentialDto {
  _id: string
  provider: 'openai_compatible' | 'ollama'
  label: string
  baseUrl: string
  modelName: string
  keyHint: string
  active: boolean
  status: 'unchecked' | 'active' | 'failed'
  lastCheckedAt?: string | null
  lastErrorCode?: string | null
  createdAt: string
  updatedAt: string
}

export async function listOracleCredentials(): Promise<OracleCredentialDto[]> {
  const { data } = await apiClient.get<OracleResponse<OracleCredentialDto[]>>('/oracle/credentials', {
    headers: { 'Cache-Control': 'no-cache' },
  })
  return data.data
}

export async function createOracleCredential(input: {
  provider: OracleCredentialDto['provider']
  label: string
  baseUrl: string
  modelName: string
  apiKey?: string
  privateContextAcknowledged: boolean
}): Promise<OracleCredentialDto> {
  const { data } = await apiClient.post<OracleResponse<OracleCredentialDto>>('/oracle/credentials', input)
  return data.data
}

export async function testOracleCredential(id: string): Promise<OracleCredentialDto> {
  const { data } = await apiClient.post<OracleResponse<OracleCredentialDto>>(`/oracle/credentials/${id}/test`)
  return data.data
}

export async function activateOracleCredential(id: string): Promise<OracleCredentialDto> {
  const { data } = await apiClient.post<OracleResponse<OracleCredentialDto>>(`/oracle/credentials/${id}/activate`)
  return data.data
}

export async function deleteOracleCredential(id: string): Promise<void> {
  await apiClient.delete(`/oracle/credentials/${id}`)
}

export async function listOracleThreads(limit = 50): Promise<OracleThreadDto[]> {
  const { data } = await apiClient.get<OracleResponse<OracleThreadDto[]>>('/oracle/threads', {
    params: { limit },
    headers: { 'Cache-Control': 'no-cache' },
  })
  return data.data
}

export async function createOracleThread(input: {
  title: string
  mode: OracleMode
}): Promise<OracleThreadDto> {
  const { data } = await apiClient.post<OracleResponse<OracleThreadDto>>('/oracle/threads', input)
  return data.data
}

export async function updateOracleThread(
  threadId: string,
  input: Partial<Pick<OracleThreadDto, 'title' | 'pinned' | 'archived'>>,
): Promise<OracleThreadDto> {
  const { data } = await apiClient.patch<OracleResponse<OracleThreadDto>>(
    `/oracle/threads/${threadId}`,
    input,
  )
  return data.data
}

export async function deleteOracleThread(threadId: string): Promise<void> {
  await apiClient.delete(`/oracle/threads/${threadId}`)
}

export async function getOracleThread(threadId: string): Promise<{
  thread: OracleThreadDto
  turns: OracleTurnDto[]
}> {
  const { data } = await apiClient.get<OracleResponse<{
    thread: OracleThreadDto
    turns: OracleTurnDto[]
  }>>(`/oracle/threads/${threadId}`, {
    headers: { 'Cache-Control': 'no-cache' },
  })
  return data.data
}

export async function postOracleTurn(
  threadId: string,
  content: string,
  clientRequestId: string,
  parentTurnId?: string,
): Promise<OracleRunDto> {
  const { data } = await apiClient.post<OracleResponse<OracleRunDto>>(
    `/oracle/threads/${threadId}/turns`,
    { content, clientRequestId, ...(parentTurnId ? { parentTurnId } : {}) },
  )
  return data.data
}

export async function branchOracleTurn(
  threadId: string,
  turnId: string,
  content: string,
  clientRequestId: string,
): Promise<OracleRunDto> {
  const { data } = await apiClient.post<OracleResponse<OracleRunDto>>(
    `/oracle/threads/${threadId}/turns/${turnId}/branch`,
    { content, clientRequestId },
  )
  return data.data
}

export async function cancelOracleRun(runId: string): Promise<void> {
  await apiClient.post(`/oracle/runs/${runId}/cancel`)
}

export async function getOracleRunStatus(runId: string): Promise<OracleRunStatusDto> {
  const { data } = await apiClient.get<OracleResponse<OracleRunStatusDto>>(
    `/oracle/runs/${runId}`,
    { headers: { 'Cache-Control': 'no-cache' } },
  )
  return data.data
}

export async function streamOracleRun(
  runId: string,
  onEvent: (event: OracleStreamEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  let afterSequence = 0
  let terminal = false
  while (!terminal && !signal.aborted) {
    const token = localStorage.getItem('ds_token')
    const baseUrl = String(apiClient.defaults.baseURL || '/api').replace(/\/+$/, '')
    const response = await fetch(
      `${baseUrl}/oracle/runs/${runId}/events?afterSequence=${afterSequence}`,
      { headers: token ? { Authorization: `Bearer ${token}` } : {}, signal },
    )
    if (!response.ok || !response.body) throw new Error(`oracle_stream_${response.status}`)
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let pending = ''
    while (!signal.aborted) {
      const { value, done } = await reader.read()
      pending += decoder.decode(value || new Uint8Array(), { stream: !done })
      const frames = pending.split('\n\n')
      pending = frames.pop() || ''
      for (const frame of frames) {
        let sequence = 0
        let type = ''
        let payload: Record<string, unknown> = {}
        for (const line of frame.split('\n')) {
          if (line.startsWith('id:')) sequence = Number(line.slice(3).trim())
          else if (line.startsWith('event:')) type = line.slice(6).trim()
          else if (line.startsWith('data:')) payload = JSON.parse(line.slice(5).trim())
        }
        if (!sequence || !type) continue
        afterSequence = Math.max(afterSequence, sequence)
        const event = { sequence, type, payload } as OracleStreamEvent
        onEvent(event)
        if (['done', 'error', 'cancelled'].includes(type)) terminal = true
      }
      if (done || terminal) break
    }
  }
}
