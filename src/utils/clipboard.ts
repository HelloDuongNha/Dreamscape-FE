export async function copyTextToClipboard(text: string): Promise<void> {
  if (!text.trim()) throw new Error('clipboard_empty')

  try {
    if (!navigator.clipboard?.writeText) throw new Error('clipboard_unavailable')
    await navigator.clipboard.writeText(text)
    return
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.inset = '0 auto auto -9999px'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.focus()
    textarea.select()
    textarea.setSelectionRange(0, textarea.value.length)
    const copied = document.execCommand('copy')
    textarea.remove()
    if (!copied) throw new Error('clipboard_fallback_failed')
  }
}
