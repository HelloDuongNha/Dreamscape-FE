export type AcademicLookupPayload = {
  doi?: string
  pmcid?: string
  url?: string
}

export type AcademicLookupError = 'required' | 'too_long' | 'invalid'

export type AcademicLookupResult =
  | { payload: AcademicLookupPayload; error?: never }
  | { payload?: never; error: AcademicLookupError }

// Normalize DOI, PMCID and academic URLs into the existing source resolver contract.
export function parseAcademicLookupInput(value: string): AcademicLookupResult {
  const input = value.trim()
  if (!input) return { error: 'required' }
  if (input.length > 500) return { error: 'too_long' }

  if (/^PMC\d+$/i.test(input)) {
    return { payload: { pmcid: input.toUpperCase() } }
  }
  if (isDoi(input)) {
    return { payload: { doi: input } }
  }

  const url = parseHttpUrl(input) || parseHttpUrl(`https://${input}`)
  if (!url) return { error: 'invalid' }

  if (/^(?:dx\.)?doi\.org$/i.test(url.hostname)) {
    const doi = decodeURIComponent(url.pathname.replace(/^\/+/, ''))
    return isDoi(doi) ? { payload: { doi } } : { error: 'invalid' }
  }

  const pmcid = `${url.pathname}${url.search}`.match(/\bPMC\d+\b/i)?.[0]
  if (pmcid) return { payload: { pmcid: pmcid.toUpperCase() } }
  return { payload: { url: url.href } }
}

function isDoi(value: string): boolean {
  return /^10\.\d{4,9}\/[A-Za-z0-9.\-_()/:;]+[A-Za-z0-9)]$/i.test(value)
}

function parseHttpUrl(value: string): URL | null {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null
  } catch {
    return null
  }
}
