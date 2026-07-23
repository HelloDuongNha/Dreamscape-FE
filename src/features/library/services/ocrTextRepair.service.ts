export function repairOcrText(input: string): string {
  let text = (input || '').normalize('NFC')

  // Repair URLs split by PDF glyph positioning, without touching normal prose.
  text = text.replace(/https?\s*:\s*\/\s*\/[^\s]+(?:\s+[./]\s*[^\s]+)+/giu, match =>
    match.replace(/\s*:\s*/g, ':').replace(/\s*\/\s*/g, '/').replace(/\s*\.\s*/g, '.'),
  )
  text = text.replace(/\b(?:Self\s*Organizing|self\s*organizing)\b/gu, match =>
    match[0] === 'S' ? 'Self-Organizing' : 'self-organizing',
  )
  text = text.replace(/\bselforganization\b/giu, 'self-organization')
  text = text.replace(/\btwostage\b/giu, 'two-stage')
  text = text.replace(/\bdreamlag\b/giu, 'dream-lag')

  // Quote boundaries commonly collapse in extracted English captions.
  text = text.replace(/([\p{Ll}])'(?=[\p{Lu}])/gu, "$1 '")
  text = text.replace(/\s+'\s*,\s*/gu, ', ')
  text = text.replace(/\s+([,.;:!?])/gu, '$1')

  // Conservative repairs for recurrent Vietnamese font-map corruption. These
  // patterns require the surrounding word shape; a bare apostrophe is kept.
  text = text
    .replace(/\bngư\s*['’]\s*i\b/giu, 'người')
    .replace(/\btư\s*['’]\s*ng\b/giu, 'tượng')
    .replace(/\bn\s*['’]\s*i\s+dung\b/giu, 'nội dung')

  // Remove isolated extraction glyphs and repair split numeric page ranges.
  text = text.replace(/(^|\n)\s*['’"`-]\s*(?=\n|$)/gu, '$1')
  text = text.replace(/,\s*(\d{1,3})\s+(\d{1,3})(?=\s*(?:\n|$))/gu, ', $1–$2')
  return text.replace(/[ \t]{2,}/g, ' ').trim()
}

export function repairOcrHtml(html: string): string {
  if (!html || typeof DOMParser !== 'function') return html
  const document = new DOMParser().parseFromString(html, 'text/html')
  const walker = document.createTreeWalker(document.body, 4 /* NodeFilter.SHOW_TEXT */)
  let node = walker.nextNode()
  while (node) {
    const parentName = node.parentElement?.tagName.toLocaleLowerCase() || ''
    if (node.nodeValue && !['script', 'style', 'math', 'svg', 'code'].includes(parentName)) {
      node.nodeValue = repairOcrText(node.nodeValue)
    }
    node = walker.nextNode()
  }
  return document.body.innerHTML
}
