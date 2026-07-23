import { computed, onUnmounted, ref, watch } from 'vue'
import type { ComputedRef } from 'vue'
import type { ReaderBlock } from '../../../api/types'
import {
  BrowserTranslationUnavailableError,
  createBrowserTranslator,
  translateBrowserTableHtml,
  translateBrowserText,
  type BrowserTranslatorInstance,
} from '../services/browserReaderTranslation.service'
import {
  EphemeralTranslationCache,
  getTargetId,
  translateFigureCaption,
  verifyAndTranslateTableCells,
} from '../services/smartReaderTranslation.service'

type TranslationStatus =
  | 'original'
  | 'downloading'
  | 'translating'
  | 'translated'
  | 'partial'
  | 'failed'
  | 'unavailable'
  | 'unknown'

const cache = new EphemeralTranslationCache()
const BROWSER_TRANSLATION_PIPELINE_VERSION = 'browser-v11'

function isUnchangedResult(source: string, translated: string): boolean {
  return source.normalize('NFKC').replace(/\s+/g, ' ').trim()
    === translated.normalize('NFKC').replace(/\s+/g, ' ').trim()
}

function stableTextHash(value: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

function getPresentationBlockId(block: ReaderBlock): string {
  if (block.blockIdentity?.chunkId) return block.blockIdentity.chunkId
  return `derived:${stableTextHash([
    block.type,
    block.sectionType,
    block.text,
    block.html || '',
    String(block.sectionIndex ?? ''),
  ].join('\u241f'))}`
}

function getSourceText(block: ReaderBlock): string {
  return block.canonicalText || block.text || ''
}

export function useSmartReaderTranslation(options: {
  pathType: 'approved' | 'preview'
  sourceId: ComputedRef<string>
  sourceContentHash: ComputedRef<string>
  sourceLanguage: ComputedRef<string | null>
  targetLocale: ComputedRef<'vi' | 'en'>
  reloadReaderData: () => Promise<void>
}) {
  const isTranslationActive = ref(false)
  const translationStatus = ref<TranslationStatus>('original')
  const translatedTexts = ref(new Map<string, string>())
  const translatedHtml = ref(new Map<string, string>())
  const downloadProgress = ref(0)

  let currentRunId = 0
  let translator: BrowserTranslatorInstance | null = null
  let translatorPair = ''

  const showTranslationControl = computed(() => {
    const sourceLanguage = options.sourceLanguage.value
    return sourceLanguage !== null && sourceLanguage !== options.targetLocale.value
  })

  function disposeTranslator() {
    translator?.destroy?.()
    translator = null
    translatorPair = ''
  }

  function cancelAllActiveRequests() {
    currentRunId++
  }

  function resetForContext() {
    cancelAllActiveRequests()
    disposeTranslator()
    translatedTexts.value.clear()
    translatedHtml.value.clear()
    downloadProgress.value = 0

    const sourceLanguage = options.sourceLanguage.value
    if (sourceLanguage === null) {
      translationStatus.value = 'unknown'
      isTranslationActive.value = false
    } else if (sourceLanguage === options.targetLocale.value) {
      translationStatus.value = 'original'
      isTranslationActive.value = false
    } else {
      translationStatus.value = 'original'
      isTranslationActive.value = true
    }
  }

  watch(
    [() => options.sourceId.value, () => options.sourceContentHash.value, () => options.sourceLanguage.value, () => options.targetLocale.value],
    resetForContext,
    { immediate: true },
  )

  watch(isTranslationActive, active => {
    if (!active) {
      cancelAllActiveRequests()
      translationStatus.value = options.sourceLanguage.value === null ? 'unknown' : 'original'
    } else if (showTranslationControl.value) {
      translationStatus.value = 'original'
    }
  })

  onUnmounted(() => {
    cancelAllActiveRequests()
    disposeTranslator()
  })

  async function ensureTranslator(runId: number): Promise<BrowserTranslatorInstance> {
    const sourceLanguage = options.sourceLanguage.value
    if (!sourceLanguage) throw new BrowserTranslationUnavailableError()
    const pair = `${sourceLanguage}:${options.targetLocale.value}`
    if (translator && translatorPair === pair) return translator

    disposeTranslator()
    translationStatus.value = 'downloading'
    const created = await createBrowserTranslator(sourceLanguage, options.targetLocale.value, progress => {
      if (runId === currentRunId) downloadProgress.value = progress
    })
    if (runId !== currentRunId) {
      created.translator.destroy?.()
      throw new DOMException('Translation run canceled', 'AbortError')
    }
    translator = created.translator
    translatorPair = pair
    return translator
  }

  function cacheKey(block: ReaderBlock, suffix = ''): string {
    const sourceText = getSourceText(block)
    return [
      options.pathType,
      options.sourceId.value,
      options.sourceContentHash.value,
      options.sourceLanguage.value || '',
      options.targetLocale.value,
      BROWSER_TRANSLATION_PIPELINE_VERSION,
      getPresentationBlockId(block),
      suffix,
      block.blockIdentity?.contentHash || stableTextHash(sourceText),
    ].join(':')
  }

  function shouldTranslateBlock(block: ReaderBlock): boolean {
    const excludedKinds = new Set(['reference', 'reference_item'])
    return !excludedKinds.has(block.type || '') && !excludedKinds.has(block.sectionType || '')
  }

  function hasBlockKind(block: ReaderBlock, kind: string): boolean {
    const legacyBlockType = 'blockType' in block ? block.blockType : undefined
    return block.type === kind || block.sectionType === kind || legacyBlockType === kind
  }

  async function translatePage(_pageIndex: number, blocks: ReaderBlock[]) {
    if (!isTranslationActive.value || !showTranslationControl.value) {
      translationStatus.value = 'original'
      return
    }

    const runId = ++currentRunId
    const translatableBlocks = blocks.filter(shouldTranslateBlock)
    if (translatableBlocks.length === 0) {
      translationStatus.value = 'translated'
      return
    }

    try {
      const activeTranslator = await ensureTranslator(runId)
      if (runId !== currentRunId) return
      translationStatus.value = 'translating'

      let translatedCount = 0
      let failedCount = 0

      for (const block of translatableBlocks) {
        if (runId !== currentRunId) return
        const blockId = getPresentationBlockId(block)

        if ((hasBlockKind(block, 'table') || hasBlockKind(block, 'figure')) && block.html) {
          const key = cacheKey(block, `structured-html:${block.html}`)
          const cached = cache.get(key, options.sourceId.value)
          try {
            const translated = cached?.translatedText || await translateBrowserTableHtml(
              activeTranslator,
              block.html,
              options.sourceLanguage.value || 'en',
              options.targetLocale.value,
            )
            if (translated === block.html) {
              translatedHtml.value.delete(blockId)
              failedCount++
              continue
            }
            translatedHtml.value.set(blockId, translated)
            if (!cached) cache.set(key, { translatedText: translated, engineName: 'browser', modelName: null, normalizationVersion: 'browser-v1', translationSchemaVersion: 'v1' }, options.sourceId.value)
            translatedCount++
          } catch {
            failedCount++
          }
          continue
        }

        if (hasBlockKind(block, 'table') && block.tableData?.cells) {
          for (const cell of block.tableData.cells) {
            const original = cell.text || ''
            if (!/[\p{L}]/u.test(original)) continue
            const targetId = getTargetId({ targetType: 'table_cell', chunkId: blockId, row: cell.row, column: cell.column })
            const key = cacheKey(block, `cell:${cell.row}:${cell.column}:${original}`)
            const cached = cache.get(key, options.sourceId.value)
            try {
              const translated = cached?.translatedText || await translateBrowserText(activeTranslator, original, options.sourceLanguage.value || 'en', options.targetLocale.value)
              if (isUnchangedResult(original, translated)) {
                translatedTexts.value.delete(targetId)
                failedCount++
                continue
              }
              translatedTexts.value.set(targetId, translated)
              if (!cached) cache.set(key, { translatedText: translated, engineName: 'browser', modelName: null, normalizationVersion: 'browser-v1', translationSchemaVersion: 'v1' }, options.sourceId.value)
              translatedCount++
            } catch {
              failedCount++
            }
          }
          continue
        }

        const original = getSourceText(block)
        if (!original.trim()) continue
        const key = cacheKey(block, original)
        const cached = cache.get(key, options.sourceId.value)
        try {
          const translated = cached?.translatedText || await translateBrowserText(activeTranslator, original, options.sourceLanguage.value || 'en', options.targetLocale.value)
          if (isUnchangedResult(original, translated)) {
            translatedTexts.value.delete(blockId)
            failedCount++
            continue
          }
          translatedTexts.value.set(blockId, translated)
          if (!cached) cache.set(key, { translatedText: translated, engineName: 'browser', modelName: null, normalizationVersion: 'browser-v1', translationSchemaVersion: 'v1' }, options.sourceId.value)
          translatedCount++
        } catch {
          failedCount++
        }
      }

      if (runId !== currentRunId) return
      if (failedCount === 0) translationStatus.value = 'translated'
      else if (translatedCount > 0) translationStatus.value = 'partial'
      else translationStatus.value = 'failed'
    } catch (error) {
      if (runId !== currentRunId || (error instanceof DOMException && error.name === 'AbortError')) return
      translationStatus.value = error instanceof BrowserTranslationUnavailableError ? 'unavailable' : 'failed'
    }
  }

  function getRenderedText(block: ReaderBlock): string {
    if (!isTranslationActive.value) return block.text
    return translatedTexts.value.get(getPresentationBlockId(block)) || block.text
  }

  function getRenderedHtml(block: ReaderBlock): string | undefined {
    if (!block.html || !isTranslationActive.value) return block.html
    const chunkId = getPresentationBlockId(block)
    const directHtmlTranslation = translatedHtml.value.get(chunkId)
    if (directHtmlTranslation) return directHtmlTranslation

    if (hasBlockKind(block, 'figure')) {
      const caption = translatedTexts.value.get(chunkId)
      return caption ? translateFigureCaption(block.html, caption) : block.html
    }
    if (hasBlockKind(block, 'table') && block.tableData) {
      const cells = new Map<string, string>()
      for (const cell of block.tableData.cells) {
        const translated = translatedTexts.value.get(`${chunkId}:${cell.row}:${cell.column}`)
        if (translated) cells.set(`${cell.row}:${cell.column}`, translated)
      }
      return cells.size ? verifyAndTranslateTableCells(block.html, block.tableData, cells) : block.html
    }
    return block.html
  }

  return {
    isTranslationActive,
    translationStatus,
    downloadProgress,
    showTranslationControl,
    translatePage,
    getRenderedText,
    getRenderedHtml,
    cancelAllActiveRequests,
  }
}
