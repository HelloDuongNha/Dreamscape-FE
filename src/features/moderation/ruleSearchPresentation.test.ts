import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getRuleCandidates } from '@/api/ruleCandidateApi'
import { createHighlightedExcerpt, findLiteralTextRanges } from '@/utils/highlightText'

const api = vi.hoisted(() => ({
  get: vi.fn(),
}))
vi.mock('@/api/client', () => ({ default: api }))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Rule search contract and presentation', () => {
  it('passes the existing filters, normalized name and abort signal through one list API', async () => {
    api.get.mockResolvedValue({ data: { success: true, data: [] } })
    const controller = new AbortController()

    await getRuleCandidates({
      status: 'approved',
      academicSourceId: 'source-1',
      q: 'future event',
    }, controller.signal)

    expect(api.get).toHaveBeenCalledWith(
      '/moderation/rules-v3/candidates',
      {
        params: {
          status: 'approved',
          academicSourceId: 'source-1',
          q: 'future event',
        },
        signal: controller.signal,
      },
    )
  })

  it('highlights literal punctuation safely without emitting HTML', () => {
    const label = 'Future (event) <script> remains text'
    const ranges = findLiteralTextRanges(label, 'future (event)')
    const result = createHighlightedExcerpt(label, ranges, label.length)

    expect(result.segments.find(segment => segment.highlighted)?.text).toBe('Future (event)')
    expect(result.segments.map(segment => segment.text).join('')).toBe(label)
  })
})
