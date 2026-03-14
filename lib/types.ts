export interface WorkItem {
  id: string
  description: string
  isEnhancing: boolean
  imageKeys: string[]   // per-item images
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
