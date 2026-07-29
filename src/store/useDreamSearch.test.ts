import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useDreamStore } from './useDreamStore'
import { createHighlightedExcerpt } from '@/utils/highlightText'
import { resolveDreamMoodLevel } from '@/utils/dreamMood'
import type { DreamSearchResponse } from '@/api/types'

const api = vi.hoisted(() => ({
  get: vi.fn(),
}))
vi.mock('@/api/client', () => ({ default: api }))

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('Dream search state', () => {
  it('does not request empty criteria and prevents an older response replacing a newer query', async () => {
    const store = useDreamStore()
    await store.searchDreams()
    expect(api.get).not.toHaveBeenCalled()

    const first = deferred<{ data: DreamSearchResponse }>()
    const second = deferred<{ data: DreamSearchResponse }>()
    api.get.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)

    store.searchQuery = 'first query'
    const firstRequest = store.searchDreams()
    store.searchQuery = 'second query'
    const secondRequest = store.searchDreams()

    second.resolve({ data: responseFixture('second-dream') })
    await secondRequest
    first.resolve({ data: responseFixture('first-dream') })
    await firstRequest

    expect(store.searchResults.map(item => item.dream._id)).toEqual(['second-dream'])
    expect(api.get).toHaveBeenNthCalledWith(
      2,
      '/dreams/search',
      expect.objectContaining({
        params: { limit: 20, q: 'second query' },
        signal: expect.any(AbortSignal),
      }),
    )
  })

  it('sends the shared mood value without requiring text', async () => {
    const store = useDreamStore()
    api.get.mockResolvedValue({ data: responseFixture('mood-dream') })
    store.searchMood = 'negative'

    await store.searchDreams()

    expect(api.get).toHaveBeenCalledWith(
      '/dreams/search',
      expect.objectContaining({ params: { limit: 20, mood: 'negative' } }),
    )
  })
})

describe('Dream search presentation utilities', () => {
  it('keeps the matching text visible and emits text segments instead of HTML', () => {
    const text = `${'A'.repeat(260)} nhà ga ${'<script>unsafe</script>'}`
    const start = text.indexOf('nhà ga')
    const excerpt = createHighlightedExcerpt(text, [{ start, end: start + 6 }], 120)

    expect(excerpt.clippedBefore).toBe(true)
    expect(excerpt.segments.find(segment => segment.highlighted)?.text).toBe('nhà ga')
    expect(excerpt.segments.map(segment => segment.text).join('')).toContain('<script>')
  })

  it('uses analysis valence before a conflicting legacy tone', () => {
    expect(resolveDreamMoodLevel(-1, 'calm')).toBe('negative')
    expect(resolveDreamMoodLevel(undefined, 'calm')).toBe('positive')
    expect(resolveDreamMoodLevel(undefined, 'fearful')).toBe('very-negative')
    expect(resolveDreamMoodLevel(undefined, 'sad')).toBe('very-negative')
    expect(resolveDreamMoodLevel(undefined, 'anxious')).toBe('negative')
    expect(resolveDreamMoodLevel(undefined, 'urgent_conflicted')).toBe('negative')
    expect(resolveDreamMoodLevel(undefined, 'mixed')).toBe('mixed')
    expect(resolveDreamMoodLevel(undefined, 'neutral')).toBe('mixed')
    expect(resolveDreamMoodLevel(2, 'neutral')).toBe('very-positive')
  })
})

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(resolver => {
    resolve = resolver
  })
  return { promise, resolve }
}

function responseFixture(id: string): DreamSearchResponse {
  return {
    success: true,
    limit: 20,
    nextCursor: null,
    data: [{
      dream: {
        _id: id,
        userId: 'user-1',
        content: 'Dream content',
        mood_tag: '',
        is_public: true,
        privacy: 'public',
        ai_analysis_enabled: false,
        likes: [],
        likes_count: 0,
        comments_count: 0,
        comments_enabled: true,
        created_at: new Date().toISOString(),
        ai_status: 'disabled',
        ai_result: null,
        edit_history: [],
        additions: [],
      },
      dreamRanges: [],
      matchedComments: [],
      matchedCommentCount: 0,
    }],
  }
}
