/**
 * readerText.ts
 * Frontend utility for clean PDF text reflow, conservative noise cleaning,
 * front-matter metadata extraction, and word-count-based reading pagination.
 */

export interface ParsedBlock {
  type: 'heading' | 'paragraph' | 'figure' | 'table' | 'page_break' | 'reference' | 'metadata';
  text: string;
  html?: string;
  sectionIndex: number;
  sectionType?: 'title' | 'abstract' | 'heading' | 'paragraph' | 'list_item' | 'reference_item' | 'caption' | 'metadata' | 'figure' | 'table' | 'page_break' | 'unknown';
  headingLevel?: 1 | 2 | 3 | 4;
  style?: any;
}

export interface ReadingPage {
  pageIndex: number;
  blocks: ParsedBlock[];
  wordCount: number;
}

/**
 * Counts the number of words in a string.
 */
export function countWords(text: string): number {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Checks if a line matches typical academic section heading patterns.
 */
export function isLikelyHeading(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (trimmed.length > 100) return false;

  // Check if it is a legitimate academic section title (case-insensitive)
  const lowercase = trimmed.toLowerCase();
  const legitimateTitles = [
    'introduction', 'abstract', 'methods', 'methodology', 'results', 'discussion',
    'conclusion', 'conclusions', 'references', 'literature review', 'background',
    'related work', 'discussion and conclusion', 'acknowledgements', 'appendix',
    'tóm tắt', 'giới thiệu', 'phương pháp', 'kết quả', 'thảo luận', 'kết luận', 'tài liệu tham khảo',
    'statements', 'author contributions', 'conflict of interest', 'funding', 'acknowledgments',
    'data availability statement', 'ethics statement', 'supplementary material', "publisher's note",
    'copyright'
  ];
  if (legitimateTitles.includes(lowercase)) return true;

  // All caps lines, e.g., "INTRODUCTION", "REFERENCES", "1. INTRODUCTION"
  const hasLetters = /[a-zA-Z]/.test(trimmed);
  const isAllCaps = hasLetters && trimmed === trimmed.toUpperCase();
  if (isAllCaps) return true;

  // Numbered headers, e.g., "1. Introduction", "1.1 Model Architecture", "Section 2: Methods"
  if (/^\d+(\.\d+)*\s+[A-Z]/.test(trimmed)) return true;
  if (/^(section|mục|chương|chapter|bài|phần)\s+\d+/i.test(trimmed)) return true;
  
  // Numbered headings with title case, e.g., "1. Introduction" or "1.1. Background"
  if (/^\d+(\.\d+)*\s+[A-Z][a-z]/.test(trimmed)) return true;

  return false;
}

/**
 * Detects the heading level (1 to 4) based on patterns, numbering, or specific academic heading matches.
 */
export function detectHeadingLevel(text: string): 1 | 2 | 3 | 4 {
  const trimmed = text.trim();
  if (!trimmed) return 2;

  // Rule 3: Numbered headings first, e.g. "1. Introduction", "1.1 Background", "1.1.1 Details", "1.1.1.1 Extra"
  const numberedMatch = trimmed.match(/^(\d+(?:\.\d+)*)\s/);
  if (numberedMatch) {
    const numPart = numberedMatch[1];
    const dotsCount = (numPart.match(/\./g) || []).length;
    if (dotsCount === 0) return 1;
    if (dotsCount === 1) return 2;
    if (dotsCount === 2) return 3;
    return 4;
  }

  const lowercase = trimmed.toLowerCase();

  // Rule 2: Statement sub-sections should be level 2
  const level2Titles = [
    'author contributions',
    'conflict of interest',
    'funding',
    'acknowledgments',
    'acknowledgements',
    'data availability statement',
    'ethics statement',
    'supplementary material',
    "publisher's note",
    'conflict of interest statement'
  ];
  if (level2Titles.includes(lowercase)) {
    return 2;
  }

  // Rule 1: Major article sections should be level 1
  const level1Titles = [
    'abstract',
    'introduction',
    'conclusion',
    'conclusions',
    'references',
    'statements',
    'dreaming and memory consolidation',
    'the strengths of self-organization theory of dreaming'
  ];
  if (level1Titles.includes(lowercase)) {
    return 1;
  }

  // Rule 1: any all-caps or title-case main section heading.
  const hasLetters = /[a-zA-Z]/.test(trimmed);
  const isAllCaps = hasLetters && trimmed === trimmed.toUpperCase();
  if (isAllCaps) {
    return 1;
  }

  // Check common main section headings
  const mainSections = [
    'methods', 'methodology', 'results', 'discussion', 'literature review', 'background',
    'related work', 'discussion and conclusion', 'appendix', 'tóm tắt', 'giới thiệu',
    'phương pháp', 'kết quả', 'thảo luận', 'kết luận', 'tài liệu tham khảo'
  ];
  if (mainSections.includes(lowercase)) {
    return 1;
  }

  // Rule 4: Default to heading level 2
  return 2;
}

/**
 * Checks if a line is a front-matter metadata line.
 */
export function isMetadataLine(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length > 200) return false;

  const matchPatterns = [
    /^(doi|mã định danh)\s*:/i,
    /^doi\s+https?:\/\//i,
    /^(published|ngày xuất bản|xuất bản)\s*:/i,
    /^(edited\s+by|biên\s+tập\s+bởi)\s*:/i,
    /^(reviewed\s+by|phản\s+biện\s+bởi)\s*:/i,
    /^(correspondence|tác\s+giả\s+liên\s+hệ)\s*:/i,
    /^(citation|trích\s+dẫn)\s*:/i,
    /^(received|accepted|ngày nhận|ngày chấp nhận)\s*:/i,
    /^(copyright|bản quyền|license|giấy phép)\s*:/i,
    /^journal\s*:/i,
  ];
  return matchPatterns.some(p => p.test(trimmed));
}

/**
 * Checks if a word prefix ends with a letter and we should strip hyphen.
 * Returns true if the hyphen was purely for word wrapping.
 */
export function shouldStripHyphen(word1: string, _word2: string): boolean {
  const w1 = word1.toLowerCase();
  
  // Common prefixes in compound words (keep the hyphen)
  const compoundPrefixes = new Set([
    'co', 'pre', 'post', 'non', 'self', 'anti', 'multi', 'semi', 'sub',
    'cross', 'inter', 'intra', 'pro', 'pseudo', 'ex', 'ultra', 'micro',
    'macro', 'bio', 'geo', 'eco', 'cyber', 'neuro', 'psycho', 'socio'
  ]);
  if (compoundPrefixes.has(w1)) return false;

  // Common adjectives/adverbs in compound words (keep the hyphen)
  const compoundAdjectives = new Set([
    'well', 'ill', 'good', 'bad', 'high', 'low', 'long', 'short', 'full',
    'part', 'half', 'first', 'last', 'second', 'third', 'free', 'new', 'old'
  ]);
  if (compoundAdjectives.has(w1)) return false;

  // Very short prefix (keep hyphen for safety, e.g. e-mail, x-ray)
  if (w1.length <= 2) return false;

  return true;
}

/**
 * Checks if the next line looks like continuation text for the paragraph.
 */
export function looksLikeContinuationText(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;

  // Lists, bullet points, numbered lists are NOT continuation text
  if (/^[-•*+]\s+/.test(trimmed)) return false;
  if (/^\[\d+\]\s+/.test(trimmed)) return false;
  if (/^\(\d+\)\s+/.test(trimmed)) return false;
  if (/^\d+\.\s+/.test(trimmed)) return false;

  // Likely headings are NOT continuation text
  if (isLikelyHeading(trimmed)) return false;

  // Metadata lines are NOT continuation text
  if (isMetadataLine(trimmed)) return false;

  return true;
}

/**
 * Conservatively removes repeated headers and footers across sections,
 * and also removes clear noise patterns from top/bottom 4 lines.
 */
export function cleanRepeatedHeadersAndFooters(sections: string[]): string[] {
  if (sections.length === 0) return sections;

  const topCandidates = new Map<string, number>();
  const bottomCandidates = new Map<string, number>();

  const parsedSections = sections.map(secText => {
    return (secText || '').split('\n').map(l => l.trim()).filter(Boolean);
  });

  // Collect candidates from top 2 and bottom 2 for frequency analysis
  parsedSections.forEach(lines => {
    if (lines.length > 0) {
      const top1 = lines[0];
      topCandidates.set(top1, (topCandidates.get(top1) || 0) + 1);
      if (lines.length > 1) {
        const top2 = lines[1];
        topCandidates.set(top2, (topCandidates.get(top2) || 0) + 1);
      }

      const bottom1 = lines[lines.length - 1];
      bottomCandidates.set(bottom1, (bottomCandidates.get(bottom1) || 0) + 1);
      if (lines.length > 1) {
        const bottom2 = lines[lines.length - 2];
        bottomCandidates.set(bottom2, (bottomCandidates.get(bottom2) || 0) + 1);
      }
    }
  });

  const repeatedNoiseLines = new Set<string>();

  const isNoisePattern = (line: string): boolean => {
    const trimmed = line.toLowerCase();
    
    // Page numbers
    if (/^\d+$/.test(trimmed)) return true;
    if (/^(page|trang)\s+\d+/i.test(trimmed)) return true;
    if (/^\d+\s*\|\s*/.test(trimmed) || /\|\s*\d+$/.test(trimmed)) return true;

    // Never classify legitimate headings as noise
    if (isLikelyHeading(line)) {
      return false;
    }

    return true;
  };

  topCandidates.forEach((count, line) => {
    if (count > 1 && line.length < 150 && isNoisePattern(line)) {
      repeatedNoiseLines.add(line);
    }
  });

  bottomCandidates.forEach((count, line) => {
    if (count > 1 && line.length < 150 && isNoisePattern(line)) {
      repeatedNoiseLines.add(line);
    }
  });

  // Additional check for clear noise patterns (Frontiers, etc.)
  const isClearNoisePattern = (line: string): boolean => {
    const trimmed = line.trim();
    if (!trimmed) return false;
    if (trimmed.length > 180) return false;

    // Never remove legitimate headings
    if (isLikelyHeading(line)) return false;

    const noiseRegexes = [
      /frontiersin\.org/i,
      /frontiers\s+in\s+[a-zA-Z]/i,
      /volume\s+\d+\s*\|\s*article\s+\d+/i,
      /article\s+\d+/i,
      /copyright\s+©/i,
      /www\s*\.\s*[a-zA-Z0-9-]+\s*\.\s*(org|com|net|edu)/i,
      /^\d+\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4}/i,
      /^(page|trang)\s+\d+/i,
      /^\d+$/ // single numbers (page numbers)
    ];

    return noiseRegexes.some(r => r.test(trimmed));
  };

  return parsedSections.map(lines => {
    let start = 0;
    let end = lines.length;

    // Check top 4 lines
    while (start < end && start < 4) {
      const line = lines[start];
      if (repeatedNoiseLines.has(line) || isClearNoisePattern(line)) {
        start++;
      } else {
        break;
      }
    }

    // Check bottom 4 lines
    while (end > start && end > lines.length - 4) {
      const line = lines[end - 1];
      if (repeatedNoiseLines.has(line) || isClearNoisePattern(line)) {
        end--;
      } else {
        break;
      }
    }

    return lines.slice(start, end).join('\n');
  });
}

/**
 * Scans the first few sections for front-matter metadata lines and extracts them.
 */
export function extractMetadata(sections: string[]): { metadata: string[], cleanedSections: string[] } {
  const metadata: string[] = [];
  const cleanedSections: string[] = [];
  let lineCount = 0;
  
  const maxMetadataLines = 200;
  const maxMetadataSections = 3;

  for (let i = 0; i < sections.length; i++) {
    const sectionText = sections[i] || '';
    const lines = sectionText.split('\n');
    const remainingLines: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        remainingLines.push(line);
        continue;
      }

      const isFirstFewSections = i < maxMetadataSections;
      const isWithinLineLimit = lineCount < maxMetadataLines;

      if (isFirstFewSections && isWithinLineLimit && isMetadataLine(trimmed)) {
        metadata.push(trimmed);
      } else {
        remainingLines.push(line);
      }

      if (trimmed) {
        lineCount++;
      }
    }
    cleanedSections.push(remainingLines.join('\n'));
  }

  return { metadata, cleanedSections };
}

/**
 * Reflows a cleaned section, identifying headings and paragraph text blocks.
 */
export function parseSectionBlocks(sectionText: string, sectionIndex: number): ParsedBlock[] {
  const lines = sectionText.split('\n').map(l => l.trim());
  const blocks: ParsedBlock[] = [];
  let currentParagraphLines: string[] = [];

  const flushParagraph = () => {
    if (currentParagraphLines.length > 0) {
      const joinedText = currentParagraphLines.join(' ');
      if (isLikelyHeading(joinedText)) {
        blocks.push({
          type: 'heading',
          text: joinedText,
          sectionIndex,
          headingLevel: detectHeadingLevel(joinedText)
        });
      } else {
        blocks.push({ type: 'paragraph', text: joinedText, sectionIndex });
      }
      currentParagraphLines = [];
    }
  };

  for (const line of lines) {
    if (!line) {
      flushParagraph();
      continue;
    }

    // Check if the current line is a heading
    if (isLikelyHeading(line)) {
      flushParagraph();
      blocks.push({
        type: 'heading',
        text: line,
        sectionIndex,
        headingLevel: detectHeadingLevel(line)
      });
      continue;
    }

    // Check if the current line is metadata (so we don't merge it)
    if (isMetadataLine(line)) {
      flushParagraph();
      blocks.push({ type: 'paragraph', text: line, sectionIndex });
      continue;
    }

    // Reflow standard paragraph line
    if (currentParagraphLines.length === 0) {
      currentParagraphLines.push(line);
    } else {
      const prevLine = currentParagraphLines[currentParagraphLines.length - 1];
      
      // Check if previous line ends with terminal punctuation, optionally followed by quotes/parens
      const isTerminalPunctuation = /[\.\?!:;]['"”\)]*$/.test(prevLine);
      
      const isContinuation = looksLikeContinuationText(line);

      if (isTerminalPunctuation || !isContinuation) {
        // Start a new line/paragraph block
        flushParagraph();
        currentParagraphLines.push(line);
      } else {
        // Join line. Check if previous line ends with a hyphen and a letter
        const matchHyphen = prevLine.match(/([a-zA-Z]+)-$/);
        
        if (matchHyphen && shouldStripHyphen(matchHyphen[1], line.split(/\s+/)[0])) {
          // Remove the hyphen and merge directly
          currentParagraphLines[currentParagraphLines.length - 1] = prevLine.slice(0, -1) + line;
        } else {
          // Keep hyphen or join with a space
          currentParagraphLines[currentParagraphLines.length - 1] = prevLine + ' ' + line;
        }
      }
    }
  }

  flushParagraph();
  return blocks;
}

/**
 * Merges consecutive all-caps heading lines into a single heading block.
 */
export function mergeConsecutiveHeadings(blocks: ParsedBlock[]): ParsedBlock[] {
  if (blocks.length <= 1) return blocks;

  const result: ParsedBlock[] = [];
  let i = 0;

  while (i < blocks.length) {
    const current = blocks[i];

    if (current.type === 'heading') {
      let mergedText = current.text;
      let j = i + 1;

      while (j < blocks.length && blocks[j].type === 'heading') {
        const nextBlock = blocks[j];

        // Check if both are all-caps and short
        const curIsAllCaps = current.text === current.text.toUpperCase() && /[A-Z]/.test(current.text);
        const nextIsAllCaps = nextBlock.text === nextBlock.text.toUpperCase() && /[A-Z]/.test(nextBlock.text);

        const sameSection = current.sectionIndex === nextBlock.sectionIndex;

        if (curIsAllCaps && nextIsAllCaps && current.text.length < 100 && nextBlock.text.length < 100 && sameSection) {
          mergedText += ' ' + nextBlock.text;
          j++;
        } else {
          break;
        }
      }

      result.push({
        type: 'heading',
        text: mergedText,
        sectionIndex: current.sectionIndex,
        headingLevel: detectHeadingLevel(mergedText)
      });
      i = j;
    } else {
      result.push(current);
      i++;
    }
  }

  return result;
}

/**
 * Paginate all parsed blocks into reading pages targeting 1200-1800 words.
 */
export function paginateBlocks(blocks: ParsedBlock[]): ReadingPage[] {
  if (blocks.length === 0) return [];

  const pages: ReadingPage[] = [];
  let currentPageBlocks: ParsedBlock[] = [];
  let currentWordCount = 0;
  const targetWords = 1500;

  const flushPage = () => {
    if (currentPageBlocks.length > 0) {
      pages.push({
        pageIndex: pages.length,
        blocks: [...currentPageBlocks],
        wordCount: currentWordCount,
      });
      currentPageBlocks = [];
      currentWordCount = 0;
    }
  };

  for (const block of blocks) {
    const blockWordCount = countWords(block.text);

    if (block.type === 'heading') {
      // Avoid orphan heading: if heading is encountered and we already have substantial text on the page
      if (currentWordCount >= 1000) {
        flushPage();
      }
      currentPageBlocks.push(block);
      currentWordCount += blockWordCount;
    } else {
      currentPageBlocks.push(block);
      currentWordCount += blockWordCount;

      // Flush if we've crossed the target threshold
      if (currentWordCount >= targetWords) {
        flushPage();
      }
    }
  }

  // Flush remaining blocks
  flushPage();

  return pages;
}

/**
 * Fully cleans, reflows, parses, and paginates raw document sections.
 */
export function prepareReaderContent(
  rawSections: any[],
  quality: 'high' | 'medium' | 'low' = 'low',
  extractionEngine?: string
): {
  metadata: string[];
  pages: ReadingPage[];
  metadataBlocks: ParsedBlock[];
} {
  if (
    quality === 'high' ||
    quality === 'medium' ||
    extractionEngine === 'html' ||
    extractionEngine === 'xml' ||
    extractionEngine === 'jats_xml' ||
    extractionEngine === 'publisher_html' ||
    extractionEngine === 'sanitized_html'
  ) {
    const allBlocks: ParsedBlock[] = [];
    const metadataBlocks: ParsedBlock[] = [];
    rawSections.forEach((sec) => {
      const text = (sec.text || '').replace(/\s+/g, ' ').trim();
      if (!text) return;

      let blockType: ParsedBlock['type'] = 'paragraph';
      if (sec.sectionType === 'heading') blockType = 'heading';
      else if (sec.sectionType === 'reference_item' || sec.sectionType === 'reference') blockType = 'reference';
      else if (sec.sectionType === 'figure') blockType = 'figure';
      else if (sec.sectionType === 'table') blockType = 'table';
      else if (sec.sectionType === 'page_break') blockType = 'page_break';
      else if (sec.sectionType === 'metadata') blockType = 'metadata';

      const blockObj: ParsedBlock = {
        type: blockType,
        sectionType: sec.sectionType || 'paragraph',
        text,
        html: sec.html || undefined,
        sectionIndex: sec.sectionIndex,
        headingLevel: sec.sectionType === 'heading' ? detectHeadingLevel(text) : undefined,
        style: sec.style || undefined
      };

      if (blockType === 'metadata') {
        metadataBlocks.push(blockObj);
      } else {
        allBlocks.push(blockObj);
      }
    });

    const pages = paginateBlocks(allBlocks);
    return {
      metadata: [],
      pages,
      metadataBlocks
    };
  }

  const texts = rawSections.map(s => s.text || '');
  
  // 1. Conservatively clean headers/footers
  const cleanedTexts = cleanRepeatedHeadersAndFooters(texts);

  // 2. Extract metadata from the first 2-3 sections / 200 lines
  const { metadata, cleanedSections } = extractMetadata(cleanedTexts);

  // 3. Parse sections into blocks
  let allBlocks: ParsedBlock[] = [];
  cleanedSections.forEach((sectionText, idx) => {
    const blocks = parseSectionBlocks(sectionText, idx);
    allBlocks.push(...blocks);
  });

  // 3.5. Merge consecutive all-caps headings
  allBlocks = mergeConsecutiveHeadings(allBlocks);

  // 4. Separate metadata blocks from body blocks
  const bodyBlocks: ParsedBlock[] = [];
  const metadataBlocks: ParsedBlock[] = [];
  allBlocks.forEach((b) => {
    if (b.type === 'metadata' || b.sectionType === 'metadata') {
      metadataBlocks.push(b);
    } else {
      bodyBlocks.push(b);
    }
  });

  // 5. Paginate blocks into pages
  const pages = paginateBlocks(bodyBlocks);

  return {
    metadata,
    pages,
    metadataBlocks
  };
}
