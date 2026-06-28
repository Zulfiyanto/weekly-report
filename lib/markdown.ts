// ── Lightweight Markdown parser ───────────────────────────────────────────────
// Supports a small, predictable subset used by work-item descriptions:
//   - "- " / "* "  bullet lists (grouping)
//   - "1. "        numbered lists (grouping)
//   - ```fence```  code blocks
//   - `code`       inline code
//   - **bold**     bold
//   - *italic*     italic
// Shared by the web preview (MarkdownPreview) and the PDF renderer so both stay
// in sync.

export type InlineToken =
  | { type: "text"; value: string }
  | { type: "bold"; value: string }
  | { type: "italic"; value: string }
  | { type: "code"; value: string }

export type Block =
  | { type: "heading"; level: number; content: InlineToken[] }
  | { type: "paragraph"; content: InlineToken[] }
  | { type: "bullet"; items: InlineToken[][] }
  | { type: "numbered"; items: InlineToken[][] }
  | { type: "code"; code: string }

const BULLET_RE = /^\s*[-*]\s+/
const NUMBERED_RE = /^\s*\d+\.\s+/
const HEADING_RE = /^(#{1,6})\s+(.*)$/
const FENCE_RE = /^\s*```/
// inline: `code` | **bold** | *italic*
const INLINE_RE = /(`([^`]+)`)|(\*\*([^*]+)\*\*)|(\*([^*]+)\*)/g

// Auto-detect code-like tokens in plain text (GitLab-style), so users don't have
// to wrap them in backticks. Conservative on purpose — only patterns that are
// unlikely to appear in normal prose:
//   - function/method calls:  foo(), obj.method(a, b)
//   - file names:             ordering-layout.module.css, useAssetPathFix.ts
//   - HTML/JSX tags:          <img>, </div>
//   - paths:                  /images/app/
//   - CSS class / id:         .suggestion, #root
//   - PascalCase components:  ReportForm, SelectService (needs 2+ humps)
const AUTO_CODE_RE = new RegExp(
  [
    /[A-Za-z_$][\w$.]*\([^()]*\)/, // func() / obj.method(a, b)
    /\b[\w-]+(?:\.[\w-]+)*\.(?:tsx?|jsx?|css|scss|sass|less|gif|png|jpe?g|svg|webp|json|md|html?|ya?ml|sql|sh|env)\b/, // file.ext
    /<\/?[A-Za-z][\w-]*\s*\/?>/, // <img>
    /\/[\w.-]+(?:\/[\w.-]*)+\/?/, // /images/app/
    /[.#][A-Za-z][\w-]+/, // .suggestion / #root
    /\b[A-Z][a-z0-9]+(?:[A-Z][a-z0-9]+)+\b/, // PascalCase
  ]
    .map((r) => `(?:${r.source})`)
    .join("|"),
  "g"
)

// Split a plain string into text/code tokens via auto-detection.
function splitAutoCode(text: string): InlineToken[] {
  const out: InlineToken[] = []
  let last = 0
  let m: RegExpExecArray | null
  AUTO_CODE_RE.lastIndex = 0
  while ((m = AUTO_CODE_RE.exec(text)) !== null) {
    if (m.index > last) out.push({ type: "text", value: text.slice(last, m.index) })
    out.push({ type: "code", value: m[0] })
    last = AUTO_CODE_RE.lastIndex
  }
  if (last < text.length) out.push({ type: "text", value: text.slice(last) })
  return out
}

export function parseInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = []
  let last = 0
  let m: RegExpExecArray | null
  INLINE_RE.lastIndex = 0
  while ((m = INLINE_RE.exec(text)) !== null) {
    if (m.index > last) tokens.push(...splitAutoCode(text.slice(last, m.index)))
    if (m[1] !== undefined) tokens.push({ type: "code", value: m[2] })
    else if (m[3] !== undefined) tokens.push({ type: "bold", value: m[4] })
    else if (m[5] !== undefined) tokens.push({ type: "italic", value: m[6] })
    last = INLINE_RE.lastIndex
  }
  if (last < text.length) tokens.push(...splitAutoCode(text.slice(last)))
  return tokens.length > 0 ? tokens : [{ type: "text", value: "" }]
}

export function parseMarkdown(text: string): Block[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n")
  const blocks: Block[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // ── Fenced code block ──
    if (FENCE_RE.test(line)) {
      const codeLines: string[] = []
      i++
      while (i < lines.length && !FENCE_RE.test(lines[i])) {
        codeLines.push(lines[i])
        i++
      }
      i++ // skip closing fence (if present)
      blocks.push({ type: "code", code: codeLines.join("\n") })
      continue
    }

    // ── Heading ──
    const heading = HEADING_RE.exec(line)
    if (heading) {
      blocks.push({ type: "heading", level: heading[1].length, content: parseInline(heading[2]) })
      i++
      continue
    }

    // ── Bullet list ──
    if (BULLET_RE.test(line)) {
      const items: InlineToken[][] = []
      while (i < lines.length && BULLET_RE.test(lines[i])) {
        items.push(parseInline(lines[i].replace(BULLET_RE, "")))
        i++
      }
      blocks.push({ type: "bullet", items })
      continue
    }

    // ── Numbered list ──
    if (NUMBERED_RE.test(line)) {
      const items: InlineToken[][] = []
      while (i < lines.length && NUMBERED_RE.test(lines[i])) {
        items.push(parseInline(lines[i].replace(NUMBERED_RE, "")))
        i++
      }
      blocks.push({ type: "numbered", items })
      continue
    }

    // ── Blank line ──
    if (line.trim() === "") {
      i++
      continue
    }

    // ── Paragraph (one line each, preserves line breaks) ──
    blocks.push({ type: "paragraph", content: parseInline(line) })
    i++
  }

  return blocks
}

// Existing list markers we recognize when normalizing pasted text:
//   numbers: "1." "1)" "(1)"  ·  bullets: - * • · ‣ ▪ ▸ ●
const NUM_MARKER_RE = /^\s*\(?\d+\)?[.)]\s+/
const BULLET_MARKER_RE = /^\s*[-*•·‣▪▸●]\s+/
const STRIP_MARKER_RE = /^\s*(?:\(?\d+\)?[.)]|[-*•·‣▪▸●])\s+/

const hasMarker = (l: string) => NUM_MARKER_RE.test(l) || BULLET_MARKER_RE.test(l)

/**
 * Auto-format pasted text into GitLab-style titles + lists so the user doesn't
 * have to add "###"/"-"/"1." by hand. Works on blank-line-separated blocks:
 *  - A single-line block → section title (heading), when the paste is structured.
 *  - A multi-line block  → bullet list (each line an item).
 *  - Existing markers are respected: numbered lines stay numbered (renumbered per
 *    block), bullet chars are normalized to "- ".
 *  - Inside a list block, an unmarked line directly above marked lines becomes a
 *    heading.
 *  - Unstructured prose (no list block, no markers) is returned unchanged.
 */
export function autoFormatList(raw: string): string {
  const normalized = raw.replace(/\r\n/g, "\n")
  // Leave code blocks alone.
  if (normalized.includes("```")) return raw

  const lines = normalized.split("\n")
  if (lines.filter((l) => l.trim() !== "").length < 2) return raw

  // Group consecutive non-empty lines into blocks (blank lines = separators).
  const blocks: string[][] = []
  let cur: string[] = []
  for (const line of lines) {
    if (line.trim() === "") {
      if (cur.length) { blocks.push(cur); cur = [] }
    } else {
      cur.push(line)
    }
  }
  if (cur.length) blocks.push(cur)

  // Only act on "structured" pastes — at least one real list block (multi-line)
  // or explicit markers. Otherwise it's likely prose; leave it alone.
  const structured = blocks.some((b) => b.length >= 2 || b.some(hasMarker))
  if (!structured) return raw

  const out: string[] = []
  for (const block of blocks) {
    if (out.length) out.push("") // single blank line between blocks

    // Standalone unmarked line → section title.
    if (block.length === 1 && !hasMarker(block[0]) && !HEADING_RE.test(block[0])) {
      out.push(`### ${block[0].trim()}`)
      continue
    }

    let num = 0
    block.forEach((line, idx) => {
      if (NUM_MARKER_RE.test(line)) {
        num++
        out.push(`${num}. ${line.replace(STRIP_MARKER_RE, "").trimEnd()}`)
        return
      }
      if (BULLET_MARKER_RE.test(line)) {
        num = 0
        out.push(`- ${line.replace(STRIP_MARKER_RE, "").trimEnd()}`)
        return
      }
      // Unmarked line inside a list block.
      num = 0
      if (HEADING_RE.test(line)) {
        out.push(line)
      } else if (block[idx + 1] && hasMarker(block[idx + 1])) {
        out.push(`### ${line.trim()}`) // title sitting right above its list
      } else {
        out.push(`- ${line.trim()}`)
      }
    })
  }

  return out.join("\n")
}

/** True when the text uses any supported markdown formatting. */
export function hasMarkdown(text: string): boolean {
  return (
    BULLET_RE.test(text) ||
    NUMBERED_RE.test(text) ||
    /^#{1,6}\s/m.test(text) ||
    /```/.test(text) ||
    /`[^`]+`/.test(text) ||
    /\*\*[^*]+\*\*/.test(text) ||
    /\*[^*]+\*/.test(text)
  )
}
