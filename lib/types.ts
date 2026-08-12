export interface WorkTag {
  id: string
  label: string
  color: string       // hex
  isDefault: boolean
}

export interface WorkItem {
  id: string
  title: string
  description: string
  isEnhancing: boolean
  imageKeys: string[]
  tags: string[]      // tag IDs
}

export interface WorkTemplate {
  id: string
  label: string
  description: string
  isDefault: boolean
}

export interface ReportDraft {
  nama: string
  periodeAwal: string
  periodeAkhir: string
  items: WorkItem[]
  savedAt: string
}

export interface ReportHistory {
  id: string
  nama: string
  periodeAwal: string
  periodeAkhir: string
  tanggalGenerate: string
  items: WorkItem[]
  hasImages: boolean
}

// ─── Lembur ──────────────────────────────────────────────────────────────────

export const LEMBUR_LOKASI = ["Rumah", "Kantor", "Rumah dan Kantor"] as const
export type LemburLokasi = (typeof LEMBUR_LOKASI)[number]

export interface LemburItem {
  id: string
  uraian: string          // kolom "Uraian Kegiatan"
  tanggal: string         // yyyy-MM-dd
  jamMulai: string        // HH:mm
  jamSelesai: string      // HH:mm
  lokasi: LemburLokasi | "" // "" = belum dipilih
  keterangan: string      // kolom "Keterangan" di tabel evidence
  imageKeys: string[]     // key IndexedDB (lihat lib/imageStorage.ts)
}

/** Identitas penanda tangan — disimpan terpisah agar bertahan saat draft dihapus. */
export interface LemburProfile {
  nama: string
  nipp: string
  jabatan: string
  namaPekerjaan: string  // mis. "Development Phinnisi"
  namaManager: string
}

export interface LemburDraft extends LemburProfile {
  tanggalDokumen: string // yyyy-MM-dd
  jamDefaultMulai: string
  jamDefaultSelesai: string
  lokasiDefault: LemburLokasi | ""
  items: LemburItem[]
  savedAt: string
}

export interface GitlabConfig {
  url: string      // mis. https://gitlab.kantor.co.id (tanpa trailing slash)
  token: string    // Personal Access Token (scope: read_api)
}

export interface GitlabMR {
  id: number
  iid: number
  projectId: number
  title: string
  description: string
  webUrl: string
  labels: string[]
  mergedAt: string
  projectPath: string  // mis. "tim-x/repo-y"
}

export interface GithubConfig {
  url: string      // API base, mis. https://api.github.com (Enterprise: https://host/api/v3)
  token: string    // Personal Access Token (scope: repo / read)
}

export interface GithubPR {
  id: number
  number: number
  title: string
  description: string
  webUrl: string
  labels: string[]
  mergedAt: string
  repo: string     // mis. "owner/repo"
}
