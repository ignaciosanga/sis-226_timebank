const ORDERED = /^\s*\d+[.)]\s+/
const BULLET = /^\s*[-*•]\s+/

export function inlineParts(text) {
  const clean = String(text).replace(/`([^`]*)`/g, '$1').replace(/(^|\s)[*_]([^*_\n]+)[*_](?=\s|[.,;:!?]|$)/g, '$1$2')
  const parts = []
  const pattern = /\*\*([^*]+)\*\*/g
  let last = 0
  for (const match of clean.matchAll(pattern)) {
    if (match.index > last) parts.push({ text: clean.slice(last, match.index), bold: false })
    parts.push({ text: match[1], bold: true })
    last = match.index + match[0].length
  }
  if (last < clean.length) parts.push({ text: clean.slice(last), bold: false })
  return parts.map((part) => ({ ...part, text: part.bold ? part.text : part.text.replace(/\*\*/g, '') })).filter((part) => part.text)
}

export function formatAnswer(text) {
  const blocks = []
  let paragraph = []
  const flush = () => {
    if (paragraph.length) blocks.push({ type: 'p', parts: inlineParts(paragraph.join(' ')) })
    paragraph = []
  }
  for (const raw of String(text ?? '').split(/\r?\n/)) {
    const line = raw.replace(/^\s*#{1,6}\s+/, '').trimEnd()
    const kind = ORDERED.test(line) ? 'ol' : BULLET.test(line) ? 'ul' : null
    if (!line.trim()) { flush(); continue }
    if (!kind) { paragraph.push(line.trim()); continue }
    flush()
    const item = inlineParts(line.replace(kind === 'ol' ? ORDERED : BULLET, ''))
    const previous = blocks[blocks.length - 1]
    if (previous?.type === kind) previous.items.push(item)
    else blocks.push({ type: kind, items: [item] })
  }
  flush()
  return blocks
}
