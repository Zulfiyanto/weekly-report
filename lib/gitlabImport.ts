import type { GitlabConfig, GitlabMR, WorkTag } from "./types"
import { extractImageRefs, stripImageMarkdown, fetchMrImageFiles } from "./gitlabImages"
import { storeImage } from "./imageStorage"
import { resolveLabelsToTags } from "./tags"

export const MAX_DESC = 2000
export const MAX_TITLE = 80
export const MAX_IMAGES_PER_ITEM = 5

/**
 * Bersihkan judul MR dari gaya penulisan commit supaya layak masuk dokumen resmi:
 * buang prefix conventional-commit (`fix(scope):`, `feat!:`) dan penanda `[TAG]`,
 * lalu kapitalkan huruf pertama. Dipakai sebagai cadangan bila AI gagal merapikan —
 * isinya tetap data asli MR, hanya format penulisannya yang dirapikan.
 */
export function rapikanJudulMr(judul: string): string {
  const bersih = judul
    .replace(
      /^\s*(feat|fix|chore|refactor|docs|style|test|perf|build|ci|revert|hotfix|bugfix)(\([^)]*\))?\s*!?\s*:\s*/i,
      ""
    )
    .replace(/^\s*\[[^\]]+\]\s*/, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (c) => c.toUpperCase())
  // Judul yang isinya cuma prefix akan habis dibersihkan — pakai aslinya
  return bersih || judul.trim()
}

/**
 * Potong teks tanpa memenggal kata: berhenti di akhir kalimat terakhir yang muat,
 * atau di spasi terakhir dengan elipsis. Memotong mentah di batas karakter
 * menyisakan kata terpenggal yang jelek di dokumen resmi.
 */
export function potongRapi(teks: string, maks: number): string {
  if (teks.length <= maks) return teks
  const potong = teks.slice(0, maks)
  const akhirKalimat = Math.max(
    potong.lastIndexOf(". "),
    potong.lastIndexOf("? "),
    potong.lastIndexOf("! ")
  )
  if (akhirKalimat > maks * 0.5) return potong.slice(0, akhirKalimat + 1).trim()
  const spasi = potong.lastIndexOf(" ")
  return (spasi > 0 ? potong.slice(0, spasi) : potong).trim().replace(/[,;:]$/, "") + "…"
}

/** Ambil merge request yang merged dalam rentang tanggal lewat route handler sendiri. */
export async function fetchMergeRequests(
  cfg: GitlabConfig,
  dateFrom: string,
  dateTo: string
): Promise<GitlabMR[]> {
  const res = await fetch("/api/gitlab/merge-requests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: cfg.url, token: cfg.token, dateFrom, dateTo }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || "Gagal mengambil merge request")
  return (data.mergeRequests ?? []) as GitlabMR[]
}

/** Rapikan sebuah teks lewat route AI yang sudah ada. */
async function enhanceText(text: string): Promise<string> {
  const res = await fetch("/api/ai-enhance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
    signal: AbortSignal.timeout(15000),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || "Gagal memproses AI")
  return data.enhanced as string
}

/** Hasil perapian teks oleh AI. `keterangan` hanya diisi oleh perapi laporan lembur. */
export interface EnhanceResult {
  description: string
  keterangan?: string
}

export interface ProcessMrOptions {
  aiEnabled: boolean
  imagesEnabled: boolean
  /** Daftar tag saat ini — label MR yang belum punya tag akan ditambahkan ke sini. */
  tags: WorkTag[]
  maxImages?: number
  /**
   * Perapi teks kustom. Bila kosong dipakai `/api/ai-enhance` (gaya laporan
   * mingguan); laporan lembur menyuntik perapi `/api/ai-lembur` lewat sini.
   */
  enhance?: (text: string) => Promise<EnhanceResult>
  /** Dipanggil sebelum langkah yang lambat, untuk menampilkan progress. */
  onProgress?: (step: "ai" | "images") => void
}

export interface ProcessedMr {
  title: string
  description: string
  /** Label pendek untuk kolom Keterangan tabel evidence (bila perapi menyediakannya). */
  keterangan?: string
  /**
   * true bila AI berhasil merapikan. Bila false padahal `aiEnabled`, `description`
   * masih berisi teks MR mentah — pemanggil sebaiknya pakai `title` agar teks
   * teknis tidak bocor ke dokumen.
   */
  enhanced: boolean
  imageKeys: string[]
  tagIds: string[]
  /** Daftar tag setelah label MR di-resolve (bisa bertambah). */
  tags: WorkTag[]
  failedImages: number
}

/**
 * Ubah satu merge request menjadi bahan item laporan:
 * buang markdown gambar → rapikan dengan AI (opsional) → ambil screenshot → resolve label jadi tag.
 */
export async function processMr(
  cfg: GitlabConfig,
  mr: GitlabMR,
  opts: ProcessMrOptions
): Promise<ProcessedMr> {
  const maxImages = opts.maxImages ?? MAX_IMAGES_PER_ITEM
  const rawDesc = mr.description?.trim() || ""
  // Buang markdown gambar dari teks — gambarnya diambil terpisah di bawah
  const baseDesc = (stripImageMarkdown(rawDesc) || mr.title).slice(0, MAX_DESC)
  let description = baseDesc
  let keterangan: string | undefined
  let enhanced = false

  if (opts.aiEnabled && baseDesc.trim().length >= 5) {
    opts.onProgress?.("ai")
    try {
      const hasil = opts.enhance
        ? await opts.enhance(baseDesc)
        : { description: await enhanceText(baseDesc) }
      if (hasil?.description?.trim()) {
        description = hasil.description.trim().slice(0, MAX_DESC)
        enhanced = true
      }
      if (hasil?.keterangan?.trim()) keterangan = hasil.keterangan.trim()
    } catch {
      // Biarkan deskripsi mentah bila AI gagal untuk item ini
    }
  }

  const imageKeys: string[] = []
  let failedImages = 0
  if (opts.imagesEnabled) {
    const refCount = extractImageRefs(rawDesc).length
    if (refCount > 0) {
      opts.onProgress?.("images")
      const files = await fetchMrImageFiles(cfg, mr, maxImages)
      for (const file of files) {
        try {
          imageKeys.push(await storeImage(file, imageKeys.length))
        } catch {
          failedImages++
        }
      }
      failedImages += Math.min(refCount, maxImages) - files.length
    }
  }

  const { tags, tagIds } = resolveLabelsToTags(mr.labels, opts.tags)

  return {
    title: mr.title.slice(0, MAX_TITLE),
    description,
    keterangan,
    enhanced,
    imageKeys,
    tagIds,
    tags,
    failedImages,
  }
}
