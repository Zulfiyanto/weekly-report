import type { GitlabConfig, GitlabMR } from "./types"

// ── Gambar dari deskripsi Merge Request GitLab ────────────────────────────────
// Deskripsi MR memuat gambar sebagai markdown ![alt](/uploads/<secret>/<file>).
// Path "/uploads/..." itu relatif terhadap PROYEK, bukan root instance, jadi URL
// unduhan harus dibangun dari projectId/projectPath. Format rute berbeda antar
// versi GitLab, sehingga kita coba beberapa kandidat sampai ada yang berhasil.

const MD_IMAGE_RE = /!\[[^\]]*\]\(\s*(<[^>]*>|[^)\s]+)(?:\s+"[^"]*")?\s*\)/g
const HTML_IMG_RE = /<img[^>]+src=["']([^"']+)["']/gi
const UPLOADS_RE = /^\/uploads\/([^/]+)\/(.+)$/

/** Semua URL/path gambar yang dirujuk teks (markdown ![...](...) dan <img>). */
export function extractImageRefs(text: string): string[] {
  const refs: string[] = []
  let m: RegExpExecArray | null
  MD_IMAGE_RE.lastIndex = 0
  while ((m = MD_IMAGE_RE.exec(text)) !== null) {
    refs.push(m[1].replace(/^<|>$/g, ""))
  }
  HTML_IMG_RE.lastIndex = 0
  while ((m = HTML_IMG_RE.exec(text)) !== null) {
    refs.push(m[1])
  }
  // De-dup sambil mempertahankan urutan, buang data: (bukan referensi remote)
  return [...new Set(refs)].filter((r) => r && !r.startsWith("data:"))
}

/** Buang markdown/HTML gambar dari teks (deskripsi jadi bersih untuk laporan). */
export function stripImageMarkdown(text: string): string {
  return text
    .replace(MD_IMAGE_RE, "")
    .replace(/<img[^>]*>/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

/**
 * Kandidat URL unduhan untuk satu referensi gambar, dicoba berurutan:
 *  1. API v4 uploads (GitLab >= 16.9, paling andal dengan PAT)
 *  2. Rute web "/-/project/<id>/uploads/..." (GitLab >= 15.x)
 *  3. Rute web lama "/<namespace>/<repo>/uploads/..."
 * Referensi absolut atau path non-uploads cukup diresolusi terhadap base.
 */
export function buildImageCandidates(
  src: string,
  baseUrl: string,
  projectId: number,
  projectPath: string
): string[] {
  const base = baseUrl.replace(/\/+$/, "")
  if (/^https?:\/\//i.test(src)) return [src]

  const uploads = UPLOADS_RE.exec(src)
  if (uploads) {
    const [, secret, filename] = uploads
    const candidates = [
      `${base}/api/v4/projects/${projectId}/uploads/${secret}/${encodeURIComponent(filename)}`,
      `${base}/-/project/${projectId}/uploads/${secret}/${filename}`,
    ]
    if (projectPath) candidates.push(`${base}/${projectPath}/uploads/${secret}/${filename}`)
    return candidates
  }

  return [src.startsWith("/") ? `${base}${src}` : `${base}/${src}`]
}

/** Konversi data URL base64 menjadi File untuk pipeline storeImage. */
export function dataUrlToFile(dataUrl: string, filename: string): File {
  const [meta, b64] = dataUrl.split(",")
  const mime = meta.match(/:(.*?);/)?.[1] || "image/png"
  const bin = atob(b64)
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return new File([arr], filename, { type: mime })
}

async function fetchViaProxy(cfg: GitlabConfig, imageUrl: string): Promise<string | null> {
  try {
    const res = await fetch("/api/gitlab/image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: cfg.url, token: cfg.token, imageUrl }),
    })
    const data = await res.json()
    return res.ok && data.dataUrl ? (data.dataUrl as string) : null
  } catch {
    return null
  }
}

/**
 * Unduh gambar-gambar yang dirujuk deskripsi sebuah MR (maksimal `max`).
 * Mengembalikan File yang berhasil diambil; referensi yang gagal dilewati.
 */
export async function fetchMrImageFiles(
  cfg: GitlabConfig,
  mr: Pick<GitlabMR, "description" | "projectId" | "projectPath">,
  max: number
): Promise<File[]> {
  const refs = extractImageRefs(mr.description || "").slice(0, max)
  const files: File[] = []

  for (const ref of refs) {
    const candidates = buildImageCandidates(ref, cfg.url, mr.projectId, mr.projectPath)
    for (const candidate of candidates) {
      const dataUrl = await fetchViaProxy(cfg, candidate)
      if (dataUrl) {
        files.push(dataUrlToFile(dataUrl, `mr-screenshot-${files.length + 1}.png`))
        break
      }
    }
  }

  return files
}
