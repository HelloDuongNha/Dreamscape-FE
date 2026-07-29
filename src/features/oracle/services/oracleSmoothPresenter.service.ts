import type { OracleShellMessage } from '../oracleShell.types'

export function createOracleSmoothPresenter(
  findTarget: (targetId: string) => OracleShellMessage | undefined,
) {
  let frame: number | null = null
  let queuedText = ''
  let targetId: string | null = null
  let ready = false
  let drainResolvers: Array<() => void> = []

  function enqueue(nextTargetId: string, text: string) {
    targetId = nextTargetId
    queuedText += text
  }

  function release() {
    ready = true
    scheduleFrame()
  }

  function scheduleFrame() {
    if (!ready || frame !== null || !queuedText) {
      resolveDrain()
      return
    }
    frame = requestAnimationFrame(paintFrame)
  }

  function paintFrame() {
    frame = null
    const target = targetId ? findTarget(targetId) : undefined
    if (!target) {
      queuedText = ''
      resolveDrain()
      return
    }
    const characters = document.hidden
      ? queuedText.length
      : Math.max(10, Math.min(180, Math.ceil(queuedText.length / 80)))
    target.content += queuedText.slice(0, characters)
    queuedText = queuedText.slice(characters)
    if (queuedText) scheduleFrame()
    else resolveDrain()
  }

  function waitForDrain(): Promise<void> {
    if (!queuedText && frame === null) return Promise.resolve()
    return new Promise((resolve) => drainResolvers.push(resolve))
  }

  function clear(flush = false) {
    if (frame !== null) cancelAnimationFrame(frame)
    frame = null
    const target = targetId ? findTarget(targetId) : undefined
    if (flush && target) target.content += queuedText
    queuedText = ''
    targetId = null
    ready = false
    resolveDrain()
  }

  function resolveDrain() {
    if (queuedText || frame !== null) return
    const resolvers = drainResolvers
    drainResolvers = []
    resolvers.forEach((resolve) => resolve())
  }

  return { enqueue, release, waitForDrain, clear }
}
