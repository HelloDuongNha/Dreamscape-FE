// Phase I18N-3B.2B — Smart Reader Frontend Translation Types



export interface CryptoHasher {
  digest(text: string): Promise<string>;
}

export interface CacheValue {
  translatedText: string;
  engineName: string | null;
  modelName: string | null;
  normalizationVersion: string;
  translationSchemaVersion: string;
}

export interface TranslationTargetRequest {
  targetType: 'block_text' | 'figure_caption' | 'table_cell';
  chunkId: string;
  row?: number;
  column?: number;
  contentHash: string;
}

export interface TranslateReaderRequest {
  sourceContentHash: string;
  targetLocale: 'vi' | 'en';
  targets: TranslationTargetRequest[];
}

export interface TranslationTargetResult {
  targetType: 'block_text' | 'figure_caption' | 'table_cell';
  chunkId: string;
  row?: number;
  column?: number;
  contentHash: string;
  status: 'translated' | 'provider_failed' | 'same_language' | 'excluded_reference' | 'excluded_structured_content' | 'source_language_unknown';
  translatedText?: string;
  providerFailureCode?: string;
}

export interface TranslateReaderResponse {
  success: boolean;
  data: {
    sourceContentHash: string;
    sourceLanguage: string | null;
    targetLocale: 'vi' | 'en';
    engineName: string | null;
    modelName: string | null;
    normalizationVersion: string;
    translationSchemaVersion: string;
    targets: TranslationTargetResult[];
  };
}

export interface EligibleTargetItem {
  target: TranslationTargetRequest;
  text: string;
}
