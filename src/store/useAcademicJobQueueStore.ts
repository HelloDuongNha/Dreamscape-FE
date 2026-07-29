import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { getApiErrorMessage } from '@/utils/apiError'

export type AcademicJobKind = 'submission' | 'structured' | 'pdf' | 'rules'
export type AcademicJobState = 'queued' | 'running' | 'completed' | 'failed'
const TERMINAL_PIN_VISIBLE_MS = 3_250

export interface AcademicJobView {
  id: string
  dedupKey: string
  sourceId: string
  title: string
  kind: AcademicJobKind
  state: AcademicJobState
  queuedAt: number
  startedAt?: number
  completedAt?: number
  error?: string
}

interface RuntimeJob extends AcademicJobView {
  promotedFromQueue: boolean
  run: (context: { promotedFromQueue: boolean }) => Promise<unknown>
  resolve: (value: unknown) => void
  reject: (reason?: unknown) => void
}

export const useAcademicJobQueueStore = defineStore('academicJobQueue', () => {
  const jobs = ref<AcademicJobView[]>([])
  const pending: RuntimeJob[] = []
  let active: RuntimeJob | null = null

  const activeJob = computed(() => jobs.value.find(job => job.state === 'running') || null)
  const queuedJobs = computed(() => jobs.value.filter(job => job.state === 'queued'))

  function sync(job: RuntimeJob) {
    const index = jobs.value.findIndex(item => item.id === job.id)
    const view: AcademicJobView = {
      id: job.id,
      dedupKey: job.dedupKey,
      sourceId: job.sourceId,
      title: job.title,
      kind: job.kind,
      state: job.state,
      queuedAt: job.queuedAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      error: job.error,
    }
    if (index >= 0) jobs.value[index] = view
    else jobs.value.push(view)
  }

  async function drain() {
    if (active || pending.length === 0) return
    active = pending.shift()!
    active.state = 'running'
    active.startedAt = Date.now()
    sync(active)

    try {
      const value = await active.run({ promotedFromQueue: active.promotedFromQueue })
      active.state = 'completed'
      active.completedAt = Date.now()
      sync(active)
      active.resolve(value)
    } catch (error: unknown) {
      active.state = 'failed'
      active.completedAt = Date.now()
      active.error = getApiErrorMessage(error, 'Tác vụ thất bại.')
      sync(active)
      active.reject(error)
    } finally {
      const completedId = active.id
      active = null
      window.setTimeout(() => {
        jobs.value = jobs.value.filter(job => job.id !== completedId)
      }, 12_000)
      window.setTimeout(() => void drain(), TERMINAL_PIN_VISIBLE_MS)
    }
  }

  function enqueue<T>(input: {
    sourceId: string
    title: string
    kind: AcademicJobKind
    run: (context: { promotedFromQueue: boolean }) => Promise<T>
  }): Promise<T> {
    const dedupKey = `${input.kind}:${input.sourceId}`
    const existing = jobs.value.find(job => job.dedupKey === dedupKey && (job.state === 'queued' || job.state === 'running'))
    if (existing) {
      return Promise.resolve(undefined as T)
    }

    return new Promise<T>((resolve, reject) => {
      const promotedFromQueue = Boolean(active || pending.length > 0)
      const job: RuntimeJob = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        dedupKey,
        sourceId: input.sourceId,
        title: input.title,
        kind: input.kind,
        state: 'queued',
        queuedAt: Date.now(),
        promotedFromQueue,
        run: input.run,
        resolve: (value: unknown) => resolve(value as T),
        reject,
      }
      pending.push(job)
      sync(job)
      void drain()
    })
  }

  return { jobs, activeJob, queuedJobs, enqueue }
})
