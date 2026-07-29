import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getApprovedSources } from '@/api/sourceApi'
import { parseDoiSearchInput } from './utils/academicContributionLookup'

const api = vi.hoisted(() => ({
  get: vi.fn(),
}))
vi.mock('@/api/client', () => ({ default: api }))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Academic source DOI search', () => {
  it('canonicalizes plain, prefixed and doi.org forms without accepting general text', () => {
    const canonical = '10.1371/journal.pone.0264574'
    expect(parseDoiSearchInput(canonical)).toEqual({ doi: canonical })
    expect(parseDoiSearchInput(`doi: ${canonical.toUpperCase()}`)).toEqual({ doi: canonical })
    expect(parseDoiSearchInput(`https://doi.org/${canonical}`)).toEqual({ doi: canonical })
    expect(parseDoiSearchInput('dream title')).toEqual({ error: 'invalid' })
    expect(parseDoiSearchInput('')).toEqual({ doi: null })
  })

  it('uses the read-only catalog endpoint and forwards cancellation', async () => {
    api.get.mockResolvedValue({
      data: {
        success: true,
        data: { items: [], pagination: { page: 1, limit: 12, total: 0, pages: 0 } },
      },
    })
    const controller = new AbortController()

    await getApprovedSources(
      { doi: '10.1371/journal.pone.0264574', page: 1, limit: 12 },
      controller.signal,
    )

    expect(api.get).toHaveBeenCalledWith('/sources/approved', {
      params: { doi: '10.1371/journal.pone.0264574', page: 1, limit: 12 },
      signal: controller.signal,
    })
  })
})
