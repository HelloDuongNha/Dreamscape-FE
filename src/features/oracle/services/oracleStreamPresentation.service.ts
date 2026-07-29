import type { OracleStreamEvent } from '@/api/oracleApi'
import type { OracleShellMessage } from '../oracleShell.types'

export function applyOracleStreamEvent(input: {
  event: OracleStreamEvent
  target: OracleShellMessage
  responseUnavailable: string
  responseCancelled: string
}): void {
  const { event, target } = input
  if (event.type === 'token') {
    target.firstTokenAt ||= Date.now()
    target.runState = 'responding'
    target.content += String(event.payload.text || '')
    return
  }
  if (event.type === 'tool_progress' && event.payload.stage === 'preparing_answer') {
    target.thoughtCompletedAt = eventTime(event.payload, 'stageStartedAt')
    target.runState = 'preparing'
    return
  }
  if (event.type === 'citation' && event.payload.citation) {
    target.citations = [
      ...(target.citations || []),
      event.payload.citation as NonNullable<OracleShellMessage['citations']>[number],
    ]
    return
  }
  if (event.type === 'done') {
    target.runState = 'completed'
    target.completedAt = eventTime(event.payload, 'completedAt')
    target.suggestedPrompts = Array.isArray(event.payload.suggestedPrompts)
      ? event.payload.suggestedPrompts.map(String)
      : []
    if (event.payload.contextUsage) {
      target.contextUsage = event.payload.contextUsage as OracleShellMessage['contextUsage']
    }
    return
  }
  if (event.type !== 'error' && event.type !== 'cancelled') return
  target.runState = event.type === 'error' ? 'failed' : 'cancelled'
  target.completedAt = Date.now()
  target.content ||= event.type === 'error'
    ? input.responseUnavailable
    : input.responseCancelled
}

function eventTime(payload: Record<string, unknown>, preferredKey?: string): number {
  const preferred = preferredKey ? payload[preferredKey] : undefined
  const parsed = Date.parse(String(preferred || payload._eventCreatedAt || ''))
  return Number.isFinite(parsed) ? parsed : Date.now()
}
