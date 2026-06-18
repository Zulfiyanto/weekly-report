const MAX_TITLE = 80
const MAX_DESC = 500

export interface ParsedMr {
  title: string
  description: string
  imageRefCount: number  // jumlah link image markdown yang terdeteksi di teks
  labels: string[]       // saran label dari prefix conventional-commit (mis. "fix", "feat")
}

// Label baris penanda dari tampilan MR yang dirender (case-insensitive),
// boleh diikuti ":" atau anotasi seperti "(optional)".
const TITLE_LABELS = /^(title|judul)\s*:?\s*(\(optional\))?\s*$/i
const DESC_LABELS = /^(description|deskripsi|deskripsi singkat)\s*:?\s*(\(optional\))?\s*$/i
// Label lain yang menandai akhir blok deskripsi (mis. section GitLab template).
const OTHER_LABELS = /^(screenshots?|tangkapan layar|labels?|assignee|reviewers?|milestone|related|terkait)\s*:?\s*(\(optional\))?\s*$/i

const IMAGE_LINE = /!\[[^\]]*\]\([^)]*\)/g
const MD_LINK = /\[([^\]]+)\]\([^)]*\)/g

/**
 * Bersihkan teks markdown menjadi teks laporan yang rapi.
 * Mengembalikan teks bersih + jumlah image markdown yang dibuang.
 */
function cleanMarkdown(raw: string): { text: string; imageRefCount: number } {
  const imageRefCount = (raw.match(IMAGE_LINE) || []).length

  const lines = raw
    .replace(IMAGE_LINE, "")            // buang image markdown
    .replace(MD_LINK, "$1")             // [teks](url) -> teks
    .split("\n")
    .map((line) => {
      let l = line.replace(/\s+$/g, "") // trim trailing spaces
      l = l.replace(/^#{1,6}\s+/, "")   // buang penanda heading
      l = l.replace(/\*\*([^*]+)\*\*/g, "$1") // bold
      l = l.replace(/`([^`]+)`/g, "$1")       // inline code
      // Normalisasi bullet "*"/"+"/"-" menjadi "- "
      l = l.replace(/^(\s*)[*+-]\s+/, "$1- ")
      // Sisa emphasis italic tunggal
      l = l.replace(/(^|\s)\*([^*]+)\*(\s|$)/g, "$1$2$3")
      return l
    })

  const text = lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")  // ringkas 3+ baris kosong jadi 1 baris kosong
    .trim()

  return { text, imageRefCount }
}

/**
 * Ambil saran label dari prefix conventional-commit pada judul.
 * Contoh: "fix(overbrengen): ..." -> ["fix"], "feat: ..." -> ["feat"].
 */
function suggestLabels(title: string): string[] {
  const m = title.match(/^(\w+)(?:\([^)]*\))?!?\s*:/)
  if (!m) return []
  const type = m[1].toLowerCase()
  const known = ["feat", "fix", "docs", "style", "refactor", "perf", "test", "chore", "build", "ci"]
  return known.includes(type) ? [type] : []
}

/**
 * Parse teks mentah hasil paste dari deskripsi Merge Request.
 * Mendukung dua bentuk:
 *  1. Tampilan ter-render berlabel: baris "Title" lalu judul, "Description" lalu isi.
 *  2. Markdown mentah: heading pertama / baris pertama = judul, sisanya = deskripsi.
 */
export function parseMrText(raw: string): ParsedMr {
  const normalized = (raw || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n")
  const lines = normalized.split("\n")

  let titleRaw = ""
  let descRaw = ""

  // ── Bentuk 1: berlabel ──────────────────────────────────────────────────
  const titleIdx = lines.findIndex((l) => TITLE_LABELS.test(l.trim()))
  const descIdx = lines.findIndex((l) => DESC_LABELS.test(l.trim()))

  if (titleIdx !== -1 || descIdx !== -1) {
    if (titleIdx !== -1) {
      // Judul = baris non-kosong pertama setelah label "Title"
      for (let i = titleIdx + 1; i < lines.length; i++) {
        if (lines[i].trim()) {
          titleRaw = lines[i].trim()
          break
        }
      }
    }
    if (descIdx !== -1) {
      // Deskripsi = dari setelah label "Description" sampai label lain / akhir
      const body: string[] = []
      for (let i = descIdx + 1; i < lines.length; i++) {
        const t = lines[i].trim()
        if (OTHER_LABELS.test(t) || TITLE_LABELS.test(t)) break
        body.push(lines[i])
      }
      descRaw = body.join("\n")
    } else {
      // Ada "Title" tapi tak ada "Description": sisanya setelah judul = deskripsi
      const body: string[] = []
      let started = false
      for (let i = titleIdx + 1; i < lines.length; i++) {
        if (!started) {
          if (lines[i].trim()) { started = true } // lewati sampai judul ketemu
          continue
        }
        const t = lines[i].trim()
        if (OTHER_LABELS.test(t)) break
        body.push(lines[i])
      }
      descRaw = body.join("\n")
    }
  } else {
    // ── Bentuk 2: markdown mentah ─────────────────────────────────────────
    const firstIdx = lines.findIndex((l) => l.trim())
    if (firstIdx !== -1) {
      titleRaw = lines[firstIdx].replace(/^#{1,6}\s+/, "").trim()
      descRaw = lines.slice(firstIdx + 1).join("\n")
    }
  }

  const title = cleanMarkdown(titleRaw).text.split("\n")[0].slice(0, MAX_TITLE)
  const { text: description, imageRefCount } = cleanMarkdown(descRaw)

  return {
    title,
    description: description.slice(0, MAX_DESC),
    imageRefCount,
    labels: suggestLabels(title),
  }
}
