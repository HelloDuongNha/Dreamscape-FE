import {
  createBrowserTranslator,
  translateBrowserText,
  type BrowserTranslatorInstance,
} from '@/features/library/services/browserReaderTranslation.service'

export type OracleDisplayLanguage = 'vi' | 'en'

const translatorByPair = new Map<string, Promise<BrowserTranslatorInstance>>()
const translationByText = new Map<string, Promise<string>>()

export function inferOracleTextLanguage(value: string): OracleDisplayLanguage | null {
  if (/[ăâđêôơưáàảãạéèẻẽẹíìỉĩịóòỏõọúùủũụýỳỷỹỵ]/iu.test(value)) return 'vi'
  if (/\b(?:the|and|dream|sleep|memory|evidence|participants?|associated|future|source|condition|rule)\b/iu.test(value)) return 'en'
  return null
}

// Translate only presentation text; canonical rule statements and evidence quotes stay unchanged.
export async function localizeOracleCitationStatement(
  statement: string,
  localizedStatement: { vi?: string; en?: string } | undefined,
  targetLanguage: OracleDisplayLanguage,
): Promise<string> {
  const prepared = String(localizedStatement?.[targetLanguage] || '').trim()
  if (prepared && inferOracleTextLanguage(prepared) === targetLanguage) return prepared

  const original = String(statement || '').trim()
  const sourceLanguage = inferOracleTextLanguage(original)
  if (!original || !sourceLanguage || sourceLanguage === targetLanguage) return original

  const cacheKey = `${sourceLanguage}:${targetLanguage}:${original}`
  let pending = translationByText.get(cacheKey)
  if (!pending) {
    pending = translateWithSharedBrowserModel(original, sourceLanguage, targetLanguage)
      .catch(() => original)
    translationByText.set(cacheKey, pending)
  }
  return pending
}

async function translateWithSharedBrowserModel(
  text: string,
  sourceLanguage: OracleDisplayLanguage,
  targetLanguage: OracleDisplayLanguage,
): Promise<string> {
  const pair = `${sourceLanguage}:${targetLanguage}`
  let translator = translatorByPair.get(pair)
  if (!translator) {
    translator = createBrowserTranslator(sourceLanguage, targetLanguage)
      .then((result) => result.translator)
    translatorByPair.set(pair, translator)
  }
  return translateBrowserText(await translator, text, sourceLanguage, targetLanguage)
}
