import assert from 'node:assert/strict'
import test from 'node:test'
import {
  estimateStructuredReaderSeconds,
} from '../services/structuredReaderEstimate.service'

test('structured reader starts with a usable estimate before history exists', () => {
  assert.equal(estimateStructuredReaderSeconds(), 35)
})

test('structured reader uses the median of recent matching successful builds', () => {
  const estimate = estimateStructuredReaderSeconds([
    { status: 'success', engine: 'structured_resolver', sourceType: 'doi_html_xml', durationMs: 19_000 },
    { status: 'success', engine: 'frontiers_html', sourceType: 'html', durationMs: 31_000 },
    { status: 'success', engine: 'pmc_jats', sourceType: 'xml', durationMs: 25_000 },
  ])
  assert.equal(estimate, 25)
})

test('structured reader excludes failed and PDF builds from its estimate', () => {
  const estimate = estimateStructuredReaderSeconds([
    { status: 'failed', engine: 'structured_resolver', sourceType: 'html', durationMs: 200_000 },
    { status: 'success', engine: 'docling', sourceType: 'uploaded_pdf', durationMs: 90_000 },
    { status: 'success', engine: 'structured_resolver', sourceType: 'doi_html_xml', durationMs: 17_000 },
  ])
  assert.equal(estimate, 17)
})
