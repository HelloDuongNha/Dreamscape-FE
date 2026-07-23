import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert'
import { JSDOM } from 'jsdom'
import { computed, ref } from 'vue'
import type { StructuredTableData } from '../../../api/types'
import {
  BrowserTranslationUnavailableError,
  createBrowserTranslator,
  localizeAuthorYearCitation,
  normalizeLetterSpacedWords,
  protectScientificTokens,
  resolveAcademicHeading,
  segmentAcademicText,
  splitForBrowserTranslation,
  translateBrowserTableHtml,
  translateBrowserText,
} from '../services/browserReaderTranslation.service'
import {
  EphemeralTranslationCache,
  buildBatches,
  measureBatchBytes,
  translateFigureCaption,
  verifyAndTranslateTableCells,
} from '../services/smartReaderTranslation.service'
import type { EligibleTargetItem } from '../services/smartReaderTranslation.types'
import { useSmartReaderTranslation } from '../composables/useSmartReaderTranslation'
import { repairOcrHtml, repairOcrText } from '../services/ocrTextRepair.service'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dom = new JSDOM('<!doctype html><html><body></body></html>')
;(globalThis as any).window = dom.window
;(globalThis as any).DOMParser = dom.window.DOMParser
;(globalThis as any).document = dom.window.document

const originalWarn = console.warn
console.warn = (...args: unknown[]) => {
  if (typeof args[0] === 'string' && args[0].includes('onUnmounted is called')) return
  originalWarn(...args)
}

test('provider-neutral envelope byte measurement remains deterministic', () => {
  const items = [{ targetId: 'chunkId1:0:0', text: 'Tiếng Việt có dấu và ký tự đặc biệt \\n \\t \\"' }]
  const independentlyMeasured = Buffer.byteLength(JSON.stringify({ items }), 'utf8')
  assert.equal(measureBatchBytes(items), independentlyMeasured)
  assert.ok(independentlyMeasured > JSON.stringify({ items }).length)
})

test('OCR display repair fixes recurrent English and Vietnamese font-map defects conservatively', () => {
  assert.equal(
    repairOcrText("Taken from'An Introduction to Swarm Intelligence Issues' by Gianni Di Caro"),
    "Taken from 'An Introduction to Swarm Intelligence Issues' by Gianni Di Caro",
  )
  assert.equal(
    repairOcrText("Do đó n' i dung chủ đề của Con ngư'i và Biểu tư'ng"),
    'Do đó nội dung chủ đề của Con người và Biểu tượng',
  )
  assert.equal(
    repairOcrText('Available online at: http://order . ph . utexas . edu/Camazine . pdf'),
    'Available online at: http://order.ph.utexas.edu/Camazine.pdf',
  )
})

test('OCR HTML repair changes text nodes without flattening markup', () => {
  const repaired = repairOcrHtml("<p>Con ngư'i và Biểu tư'ng</p><code>n' i dung</code>")
  assert.ok(repaired.includes('<p>Con người và Biểu tượng</p>'))
  assert.ok(repaired.includes("<code>n' i dung</code>"))
})

test('bounded cache evicts FIFO entries and clears on source change', () => {
  const cache = new EphemeralTranslationCache()
  for (let index = 1; index <= 1005; index++) {
    cache.set(`key:${index}`, {
      translatedText: `Translation ${index}`,
      engineName: 'browser',
      modelName: null,
      normalizationVersion: 'browser-v1',
      translationSchemaVersion: 'v1',
    }, 'source-1')
  }
  assert.equal(cache.get('key:1', 'source-1'), undefined)
  assert.equal(cache.get('key:6', 'source-1')?.translatedText, 'Translation 6')
  assert.equal(cache.get('key:1005', 'source-2'), undefined)
})

test('legacy provider-neutral batch utility still respects count limits', () => {
  const items: EligibleTargetItem[] = Array.from({ length: 45 }, (_, index) => ({
    target: { targetType: 'block_text', chunkId: `c${index}`, contentHash: `h${index}` },
    text: `Text ${index}`,
  }))
  const batches = buildBatches(items, 40, 24576)
  assert.deepEqual(batches.map(batch => batch.targets.length), [40, 5])
})

test('figure caption overlay preserves the image', () => {
  const html = '<figure><img src="test.jpg"><figcaption>Original Caption</figcaption></figure>'
  const translated = translateFigureCaption(html, 'Chú thích đã dịch')
  assert.ok(translated.includes('Chú thích đã dịch'))
  assert.ok(translated.includes('test.jpg'))
})

test('table overlay preserves grid coordinates and spans', () => {
  const html = '<table><tr><th colspan="2">Header</th></tr><tr><td>A</td><td>B</td></tr></table>'
  const tableData: StructuredTableData = {
    version: 1,
    source: 'docling',
    reconstructionMethod: 'docling_native',
    rowCount: 2,
    columnCount: 2,
    cells: [
      { row: 0, column: 0, rowSpan: 1, columnSpan: 2, text: 'Header', role: 'header' },
      { row: 1, column: 0, rowSpan: 1, columnSpan: 1, text: 'A', role: 'data' },
      { row: 1, column: 1, rowSpan: 1, columnSpan: 1, text: 'B', role: 'data' },
    ],
  }
  const translated = verifyAndTranslateTableCells(html, tableData, new Map([
    ['0:0', 'Tiêu đề'],
    ['1:0', 'Ô A'],
    ['1:1', 'Ô B'],
  ]))
  assert.ok(translated.includes('Tiêu đề'))
  assert.ok(translated.includes('colspan="2"'))
})

test('HTML-only tables translate every visible cell without requiring tableData', async () => {
  const html = '<table><tr><th>Content Type</th><th>Future</th></tr><tr><td>Dream Report</td><td>Waking Source</td></tr></table>'
  const translated = await translateBrowserTableHtml({
    async translate(text) {
      const values: Record<string, string> = {
        'Content Type': 'Loại nội dung',
        Future: 'Tương lai',
        'Dream Report': 'Báo cáo giấc mơ',
        'Waking Source': 'Nguồn khi thức',
      }
      return values[text] || text
    },
  }, html, 'en', 'vi')

  assert.ok(translated.includes('Loại nội dung'))
  assert.ok(translated.includes('Báo cáo giấc mơ'))
  assert.ok(translated.includes('colspan') === html.includes('colspan'))
})

test('scientific tokens survive browser translation byte-for-byte', async () => {
  const source = 'The result was p < 0.05 at 5.2 mg/dL [4] (Blanke and Metzinger, 2009), doi:10.1000/test.'
  const translated = await translateBrowserText({
    async translate(text) {
      return text
        .replace('The result was', 'Kết quả nghiên cứu là')
        .replace(' at ', ' ở ')
    },
  }, source)
  assert.ok(translated.includes('p < 0.05'))
  assert.ok(translated.includes('5.2 mg/dL'))
  assert.ok(translated.includes('[4]'))
  assert.ok(translated.includes('(Blanke và Metzinger, 2009)'))
  assert.ok(translated.includes('doi:10.1000/test'))
  assert.ok(protectScientificTokens(source).masked.includes('ZXQDS0QXZ'))
})

test('author-year citations localize connectors while preserving names, years, and separators', () => {
  assert.equal(
    localizeAuthorYearCitation('(Blanke and Metzinger, 2009; Smith et al., 2011)', 'vi'),
    '(Blanke và Metzinger, 2009; Smith và cộng sự, 2011)',
  )
  assert.equal(
    localizeAuthorYearCitation('(Blanke và Metzinger, 2009; Smith và cộng sự, 2011)', 'en'),
    '(Blanke and Metzinger, 2009; Smith et al., 2011)',
  )
})

test('long paragraphs split at readable boundaries instead of being truncated', () => {
  const text = `${'A sentence. '.repeat(400)}Final sentence.`
  const chunks = splitForBrowserTranslation(text, 500)
  assert.ok(chunks.length > 1)
  assert.equal(chunks.join(' ').replace(/\s+/g, ' ').trim(), text.replace(/\s+/g, ' ').trim())
  assert.ok(chunks.every(chunk => chunk.length <= 501))
})

test('letter-spaced academic headings are normalized before translation', () => {
  assert.equal(normalizeLetterSpacedWords('a b s t r a c t'), 'abstract')
  assert.equal(resolveAcademicHeading('a b s t r a c t', 'en', 'vi'), 'tóm tắt')
})

test('uppercase academic headings remain uppercase after translation', async () => {
  const translated = await translateBrowserText({ async translate() { return 'unused' } }, 'CREATION OF THE WAKE SELF', 'en', 'vi')
  assert.equal(translated, 'SỰ HÌNH THÀNH CÁI TÔI KHI THỨC')
})

test('translated prose capitalizes the paragraph opening and each sentence opening', async () => {
  const translated = await translateBrowserText({
    async translate() { return 'đây là câu đầu. đây là câu tiếp theo.' },
  }, 'This is the first sentence. This is the next sentence.', 'en', 'vi')
  assert.equal(translated, 'Đây là câu đầu. Đây là câu tiếp theo.')
})

test('long academic prose is translated by sentence or clause so content cannot disappear wholesale', async () => {
  const source = 'When awake, our sense of self is affected by several factors. These include a feeling of unity; the sense that I am someone and that someone is I. I am not two different people, even if I may act that way on occasion.'
  const segments = segmentAcademicText(source, 'en')
  assert.ok(segments.length >= 1)
  assert.ok(segments[0].includes('When awake') && segments[0].includes('These include'))

  let calls = 0
  const result = await translateBrowserText({
    async translate() {
      calls++
      return 'Bản dịch đầy đủ nói về ý thức về bản thân và cảm giác thống nhất của một con người.'
    },
  }, source, 'en', 'vi')
  assert.equal(calls, segments.length)
  assert.ok(result.includes('cảm nhận về bản thân'))
  assert.ok(result.includes('cảm giác mình là một thể thống nhất'))
})

test('narrative et al citations are localized deterministically and never translated as names', async () => {
  const result = await translateBrowserText({ async translate(text) { return text } }, 'Wamsley et al. 2016', 'en', 'vi')
  assert.equal(result, 'Wamsley và cộng sự 2016')
})

test('figure HTML translates captions and small explanatory text while preserving the image', async () => {
  const html = '<figure><img src="figure.png"><figcaption>Figure 4: Temporal references by sleep stage.</figcaption><small>Percentages are relative to all valid reports.</small></figure>'
  const translated = await translateBrowserTableHtml({
    async translate(text) {
      if (text.includes('Figure 4')) return 'Hình 4: Tham chiếu thời gian theo giai đoạn ngủ.'
      if (text.includes('Percentages')) return 'Tỷ lệ phần trăm được tính trên tất cả báo cáo hợp lệ.'
      return text
    },
  }, html, 'en', 'vi')
  assert.ok(translated.includes('Hình 4'))
  assert.ok(translated.includes('Tỷ lệ phần trăm'))
  assert.ok(translated.includes('figure.png'))
})

test('unchanged browser output is rejected and the difficult clause is retried in smaller pieces', async () => {
  const source = 'This deliberately complex academic clause explains how memory consolidation, emotional regulation, and external sensory input can jointly contribute to the formation of dream content.'
  let unchangedCalls = 0
  let translatedCalls = 0
  const result = await translateBrowserText({
    async translate(text) {
      if (text.length > 72) {
        unchangedCalls++
        return text
      }
      translatedCalls++
      return 'Một phần nội dung học thuật đã được dịch đầy đủ sang tiếng Việt.'
    },
  }, source, 'en', 'vi')

  assert.ok(unchangedCalls >= 2)
  assert.ok(translatedCalls >= 1)
  assert.notEqual(result, source)
  assert.ok(!result.includes('This deliberately complex academic clause'))
})

test('a permanently failed clause returns the whole canonical block instead of mixed languages', async () => {
  const source = 'The first sentence contains enough academic detail to translate correctly. The second sentence also contains important context.'
  const result = await translateBrowserText({ async translate(text) { return text } }, source, 'en', 'vi')
  assert.equal(result, source)
})

test('statistical prose translates without asking Chrome to rewrite canonical statistics', async () => {
  const source = 'Participants were less likely to report dreams after 90s of sleep (Wald χ2(1, N = 247) = 6.24, p = 0.04). Awakening latency did not affect future sources (F(2,59) = 1.00, p = 0.37).'
  let markerFailures = 0
  const result = await translateBrowserText({
    async translate(text) {
      if (text.includes('ZXQDS')) {
        markerFailures++
        return text.replaceAll('ZXQDS', 'zxqds')
      }
      return ' Nội dung nghiên cứu đã được chuyển ngữ rõ ràng '
    },
  }, source, 'en', 'vi')

  assert.ok(markerFailures >= 1)
  assert.notEqual(result, source)
  assert.ok(!result.includes('Participants were less likely'))
  assert.ok(result.includes('90s'))
  assert.ok(result.includes('Wald χ2(1, N = 247) = 6.24'))
  assert.ok(result.includes('p = 0.04'))
  assert.ok(result.includes('F(2,59) = 1.00'))
  assert.ok(result.includes('p = 0.37'))
})

test('suspiciously truncated segment falls back to its canonical source', async () => {
  const source = 'This deliberately long academic sentence contains enough information that a two-word output would clearly be incomplete.'
  const result = await translateBrowserText({ async translate() { return 'Quá ngắn' } }, source, 'en', 'vi')
  assert.equal(result, source)
})

test('browser translator factory reports unsupported browsers cleanly', async () => {
  delete (globalThis as any).Translator
  await assert.rejects(() => createBrowserTranslator('en', 'vi'), BrowserTranslationUnavailableError)
})

test('composable translates canonical prose locally and never calls backend', async () => {
  let calls = 0
  ;(globalThis as any).Translator = {
    async availability() { return 'available' },
    async create() {
      return {
        async translate(text: string) {
          calls++
          return text === 'Hello world' ? 'Xin chào thế giới' : `VI:${text}`
        },
      }
    },
  }

  const sourceLanguage = ref<string | null>('en')
  const targetLocale = ref<'vi' | 'en'>('vi')
  const translation = useSmartReaderTranslation({
    pathType: 'approved',
    sourceId: computed(() => 'source-1'),
    sourceContentHash: computed(() => 'hash-1'),
    sourceLanguage: computed(() => sourceLanguage.value),
    targetLocale: computed(() => targetLocale.value),
    reloadReaderData: async () => undefined,
  })

  const block: any = {
    type: 'paragraph',
    sectionType: 'body',
    text: 'Hello world',
    canonicalText: 'Hello world',
    blockIdentity: { chunkId: 'chunk-1', contentHash: 'content-hash' },
  }
  await translation.translatePage(0, [block])
  assert.equal(translation.translationStatus.value, 'translated')
  assert.equal(translation.getRenderedText(block), 'Xin chào thế giới')
  assert.equal(calls, 1)

  translation.isTranslationActive.value = false
  assert.equal(translation.getRenderedText(block), 'Hello world')
})

test('composable never caches an unchanged English block as a successful translation', async () => {
  let calls = 0
  ;(globalThis as any).Translator = {
    async availability() { return 'available' },
    async create() {
      return {
        async translate(text: string) {
          calls++
          return text
        },
      }
    },
  }

  const translation = useSmartReaderTranslation({
    pathType: 'approved',
    sourceId: computed(() => 'source-unchanged'),
    sourceContentHash: computed(() => 'hash-unchanged'),
    sourceLanguage: computed(() => 'en'),
    targetLocale: computed(() => 'vi'),
    reloadReaderData: async () => undefined,
  })
  const block: any = {
    type: 'paragraph',
    sectionType: 'body',
    text: 'This block remains untranslated.',
    canonicalText: 'This block remains untranslated.',
    blockIdentity: { chunkId: 'chunk-unchanged', contentHash: 'content-unchanged' },
  }

  await translation.translatePage(0, [block])
  const firstRunCalls = calls
  assert.equal(translation.translationStatus.value, 'failed')
  assert.equal(translation.getRenderedText(block), block.text)

  await translation.translatePage(0, [block])
  assert.ok(calls > firstRunCalls)
  assert.equal(translation.translationStatus.value, 'failed')
})

test('derived reader paragraphs without blockIdentity are still translated in the browser', async () => {
  ;(globalThis as any).Translator = {
    async availability() { return 'available' },
    async create() {
      return {
        async translate() {
          return 'Đoạn nội dung dẫn xuất cũng được dịch đầy đủ.'
        },
      }
    },
  }

  const translation = useSmartReaderTranslation({
    pathType: 'approved',
    sourceId: computed(() => 'source-derived'),
    sourceContentHash: computed(() => 'hash-derived'),
    sourceLanguage: computed(() => 'en'),
    targetLocale: computed(() => 'vi'),
    reloadReaderData: async () => undefined,
  })
  const derivedBlock: any = {
    type: 'paragraph',
    sectionType: 'body',
    sectionIndex: 4,
    text: 'Dreams have long been known to reflect the reactivation of past memory.',
  }

  await translation.translatePage(0, [derivedBlock])
  assert.equal(translation.translationStatus.value, 'translated')
  assert.equal(translation.getRenderedText(derivedBlock), 'Đoạn nội dung dẫn xuất cũng được dịch đầy đủ.')
})

test('reference entries remain canonical while reference headings may translate', async () => {
  let calls = 0
  ;(globalThis as any).Translator = {
    async availability() { return 'available' },
    async create() { return { async translate(text: string) { calls++; return `VI:${text}` } } },
  }
  const translation = useSmartReaderTranslation({
    pathType: 'approved',
    sourceId: computed(() => 'source-2'),
    sourceContentHash: computed(() => 'hash-2'),
    sourceLanguage: computed(() => 'en'),
    targetLocale: computed(() => 'vi'),
    reloadReaderData: async () => undefined,
  })
  const heading: any = { type: 'heading', sectionType: 'heading', text: 'References', canonicalText: 'References', blockIdentity: { chunkId: 'h', contentHash: 'hh' } }
  const entry: any = { type: 'reference', sectionType: 'reference_item', text: 'Smith et al. [1]', canonicalText: 'Smith et al. [1]', blockIdentity: { chunkId: 'r', contentHash: 'rr' } }
  await translation.translatePage(0, [heading, entry])
  assert.equal(translation.getRenderedText(heading), 'Tài liệu tham khảo')
  assert.equal(translation.getRenderedText(entry), 'Smith et al. [1]')
  assert.equal(calls, 0)
})

test('production Smart Reader sources do not import jsdom or backend translation APIs', () => {
  const service = fs.readFileSync(path.resolve(__dirname, '../services/browserReaderTranslation.service.ts'), 'utf8')
  const composable = fs.readFileSync(path.resolve(__dirname, '../composables/useSmartReaderTranslation.ts'), 'utf8')
  assert.ok(!service.includes("from 'jsdom'"))
  assert.ok(!composable.includes('translateApprovedSourceText'))
  assert.ok(!composable.includes('translateSourcePreviewText'))
})
