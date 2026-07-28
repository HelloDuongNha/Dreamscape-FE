import type { OracleTurnDto } from '@/api/oracleApi'
import type { OracleShellMessage } from '../oracleShell.types'

export function materializeOracleBranch(
  turns: OracleTurnDto[],
  requestedLeafId?: string,
): OracleShellMessage[] {
  if (!turns.length) return []
  const byId = new Map(turns.map((turn) => [turn._id, turn]))
  const defaultLeaf = [...turns].reverse().find(
    (turn) => turn.role === 'assistant' && turn.contentBlocks.length,
  ) || turns[turns.length - 1]
  let current: OracleTurnDto | undefined = byId.get(requestedLeafId || '') || defaultLeaf
  const ancestry: OracleTurnDto[] = []
  while (current && ancestry.length < 100) {
    ancestry.push(current)
    current = current.parentTurnId ? byId.get(current.parentTurnId) : undefined
  }
  const selected = ancestry.length > 1 ? ancestry.reverse() : turns
  return selected
    .filter((turn) => (
      turn.role === 'user'
      || turn.contentBlocks.length > 0
      || turn._id === requestedLeafId
    ))
    .map((turn) => presentTurn(turn, turns))
}

function presentTurn(turn: OracleTurnDto, turns: OracleTurnDto[]): OracleShellMessage {
  const message = turnToMessage(turn)
  if (turn.role !== 'user') return message
  const rootId = turn.branchRootTurnId || turn._id
  const variants = turns
    .filter((candidate) => candidate.role === 'user'
      && (candidate._id === rootId || candidate.branchRootTurnId === rootId))
    .sort((a, b) => a.sequence - b.sequence)
  if (variants.length <= 1) return message
  const index = variants.findIndex((candidate) => candidate._id === turn._id)
  message.branch = {
    index: index + 1,
    total: variants.length,
    previousLeafId: assistantLeaf(turns, variants[index - 1]),
    nextLeafId: assistantLeaf(turns, variants[index + 1]),
  }
  return message
}

function turnToMessage(turn: OracleTurnDto): OracleShellMessage {
  const timing = turn.runTiming
  return {
    id: turn._id,
    role: turn.role,
    content: turn.contentBlocks.map((block) => block.text).join('\n'),
    citations: turn.citations || [],
    suggestedPrompts: turn.suggestedPrompts || [],
    contextUsage: turn.contextUsage,
    parentTurnId: turn.parentTurnId,
    branchRootTurnId: turn.branchRootTurnId,
    supersedesTurnId: turn.supersedesTurnId,
    createdAt: turn.createdAt,
    runState: timing ? 'completed' : undefined,
    startedAt: timing ? new Date(timing.startedAt).getTime() : undefined,
    thoughtCompletedAt: timing ? new Date(timing.thoughtCompletedAt).getTime() : undefined,
    completedAt: timing ? new Date(timing.completedAt).getTime() : undefined,
    expectedMinMs: timing?.expectedMinMs,
    expectedMaxMs: timing?.expectedMaxMs,
  }
}

function assistantLeaf(turns: OracleTurnDto[], variant?: OracleTurnDto): string | undefined {
  return variant
    ? turns.find(
      (candidate) => candidate.role === 'assistant' && candidate.parentTurnId === variant._id,
    )?._id
    : undefined
}
