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
