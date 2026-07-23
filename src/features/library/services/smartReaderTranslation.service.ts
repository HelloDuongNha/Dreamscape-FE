// Phase I18N-3B.2B — Smart Reader Frontend Translation Service

import type {
  StructuredTableData
} from '../../../api/types';
import type {
  CryptoHasher,
  CacheValue,
  TranslationTargetRequest,
  EligibleTargetItem
} from './smartReaderTranslation.types';

// ─── Hashing Helper ────────────────────────────────────────────────────────

export class WebCryptoHasher implements CryptoHasher {
  private cryptoObj: Crypto;

  constructor(cryptoObj?: Crypto) {
    if (cryptoObj) {
      this.cryptoObj = cryptoObj;
    } else {
      this.cryptoObj =
        typeof window !== 'undefined'
          ? window.crypto
          : (globalThis as unknown as { crypto: Crypto }).crypto;
    }
  }

  async digest(text: string): Promise<string> {
    const msgBuffer = new TextEncoder().encode(text);
    const hashBuffer = await this.cryptoObj.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
}

// ─── Ephemeral Bounded Cache ───────────────────────────────────────────────

export class EphemeralTranslationCache {
  private cache = new Map<string, CacheValue>();
  private order: string[] = [];
  private currentSourceId: string | null = null;
  private readonly maxCapacity = 1000;

  get(key: string, sourceId: string): CacheValue | undefined {
    this.checkSourceChange(sourceId);
    return this.cache.get(key);
  }

  set(key: string, value: CacheValue, sourceId: string): void {
    this.checkSourceChange(sourceId);
    if (this.cache.has(key)) {
      this.cache.set(key, value);
      return;
    }

    if (this.cache.size >= this.maxCapacity) {
      const oldest = this.order.shift();
      if (oldest) {
        this.cache.delete(oldest);
      }
    }

    this.cache.set(key, value);
    this.order.push(key);
  }

  private checkSourceChange(sourceId: string): void {
    if (this.currentSourceId !== sourceId) {
      this.cache.clear();
      this.order = [];
      this.currentSourceId = sourceId;
    }
  }

  buildKey(params: {
    pathType: 'approved' | 'preview';
    sourceId: string;
    sourceContentHash: string;
    sourceLanguage: string;
    targetLocale: string;
    targetType: 'block_text' | 'figure_caption' | 'table_cell';
    chunkId: string;
    row?: number;
    column?: number;
    contentHash: string;
  }): string {
    return [
      params.pathType,
      params.sourceId,
      params.sourceContentHash,
      params.sourceLanguage,
      params.targetLocale,
      params.targetType,
      params.chunkId,
      params.row ?? '',
      params.column ?? '',
      params.contentHash
    ].join(':');
  }
}

// ─── Batching & Byte Measurement ───────────────────────────────────────────

export function getTargetId(target: { chunkId: string; row?: number; column?: number; targetType: string }): string {
  if (target.targetType === 'table_cell' && target.row !== undefined && target.column !== undefined) {
    return `${target.chunkId}:${target.row}:${target.column}`;
  }
  return target.chunkId;
}

export function measureBatchBytes(items: { targetId: string; text: string }[]): number {
  return new TextEncoder().encode(JSON.stringify({ items })).byteLength;
}

export function buildBatches(
  eligible: EligibleTargetItem[],
  maxTargets = 40,
  maxBytes = 24576
): { targets: TranslationTargetRequest[]; envelope: { items: { targetId: string; text: string }[] } }[] {
  const batches: { targets: TranslationTargetRequest[]; envelope: { items: { targetId: string; text: string }[] } }[] = [];
  
  let currentTargets: TranslationTargetRequest[] = [];
  let currentItems: { targetId: string; text: string }[] = [];

  for (const item of eligible) {
    const targetId = getTargetId(item.target);
    const proposedItem = { targetId, text: item.text };
    const tempItems = [...currentItems, proposedItem];
    const bytes = measureBatchBytes(tempItems);

    const wouldExceedCount = tempItems.length > maxTargets;
    const wouldExceedBytes = bytes > maxBytes;

    if (wouldExceedCount || wouldExceedBytes) {
      if (currentItems.length > 0) {
        batches.push({ targets: currentTargets, envelope: { items: currentItems } });
      }
      currentTargets = [item.target];
      currentItems = [proposedItem];
    } else {
      currentTargets.push(item.target);
      currentItems.push(proposedItem);
    }
  }

  if (currentItems.length > 0) {
    batches.push({ targets: currentTargets, envelope: { items: currentItems } });
  }

  return batches;
}

// ─── DOM Helpers ───────────────────────────────────────────────────────────

export function getDOMParser(): typeof DOMParser {
  const globalParser = (globalThis as any).DOMParser || (typeof window !== 'undefined' ? window.DOMParser : undefined);
  if (globalParser) {
    return globalParser;
  }
  throw new Error('DOMParser is unavailable in this environment.');
}

/**
 * Replaces the caption text inside a figure block safely.
 */
export function translateFigureCaption(html: string, translatedText: string): string {
  const Parser = getDOMParser();
  const doc = new Parser().parseFromString(html, 'text/html');
  const figcaption = doc.querySelector('figcaption');
  if (figcaption) {
    figcaption.textContent = translatedText;
    return doc.body.innerHTML;
  }
  const caption = doc.querySelector('.caption, caption');
  if (caption) {
    caption.textContent = translatedText;
    return doc.body.innerHTML;
  }
  // If no caption tag found, return original
  return html;
}

/**
 * Maps cells in a table HTML using spanning coordinates, replaces text content, and returns outerHTML.
 * If structural inconsistency is found, returns the original HTML intact.
 */
export function verifyAndTranslateTableCells(
  html: string,
  tableData: StructuredTableData,
  cellTranslations: Map<string, string> // key: `${row}:${column}` -> translated text
): string {
  const Parser = getDOMParser();
  const doc = new Parser().parseFromString(html, 'text/html');
  const table = doc.querySelector('table');
  if (!table) return html;

  const rowCount = tableData.rowCount;
  const colCount = tableData.columnCount;
  
  // 1. Initialize occupied grid
  const occupied: boolean[][] = Array.from({ length: rowCount }, () => Array(colCount).fill(false));

  const trs = Array.from(table.querySelectorAll('tr'));
  if (trs.length !== rowCount) {
    return html; // mismatched row count
  }

  // 2. Iterate HTML structure row by row
  for (let r = 0; r < rowCount; r++) {
    const tr = trs[r];
    const cellElements = Array.from(tr.children).filter(el => el.tagName === 'TD' || el.tagName === 'TH');
    
    let c = 0;
    for (let i = 0; i < cellElements.length; i++) {
      const el = cellElements[i] as HTMLTableCellElement;
      
      // Advance past occupied slots
      while (c < colCount && occupied[r][c]) {
        c++;
      }
      
      if (c >= colCount) {
        return html; // out of bounds column error
      }

      const rowSpan = el.rowSpan || 1;
      const colSpan = el.colSpan || 1;

      // Verify bounds
      if (r + rowSpan > rowCount || c + colSpan > colCount) {
        return html;
      }

      // Mark occupied slots
      for (let dr = 0; dr < rowSpan; dr++) {
        for (let dc = 0; dc < colSpan; dc++) {
          if (occupied[r + dr][c + dc]) {
            return html; // overlapping spanning cells
          }
          occupied[r + dr][c + dc] = true;
        }
      }

      // Match corresponding cell in tableData
      const canonCell = tableData.cells.find(cell => cell.row === r && cell.column === c);
      if (!canonCell) {
        return html;
      }

      // Compare spans
      if (canonCell.rowSpan !== rowSpan || canonCell.columnSpan !== colSpan) {
        return html;
      }

      // Verify that plain text content matches (normalizing whitespace)
      const elTextClean = (el.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
      const canonTextClean = (canonCell.text || '').replace(/\s+/g, ' ').trim().toLowerCase();
      if (elTextClean !== canonTextClean) {
        return html;
      }

      // Apply translation if available
      const transKey = `${r}:${c}`;
      if (cellTranslations.has(transKey)) {
        el.textContent = cellTranslations.get(transKey) || '';
      }

      c += colSpan;
    }
  }

  // 3. Final safety check: ensure all grid slots are accounted for
  for (let r = 0; r < rowCount; r++) {
    for (let c = 0; c < colCount; c++) {
      if (!occupied[r][c]) {
        return html; // missing cell coverage
      }
    }
  }

  return table.outerHTML;
}
