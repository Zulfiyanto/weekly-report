import type { WorkItem, WorkTag, WorkTemplate, ReportDraft, ReportHistory } from "./types"

const DRAFT_KEY = "weekly_report_draft"
const HISTORY_KEY = "weekly_report_history"
const TEMPLATES_KEY = "weekly_report_templates"
const TAGS_KEY = "weekly_report_tags"
const THEME_KEY = "weekly_report_theme"

export const DEFAULT_TAGS: WorkTag[] = [
  { id: "tag_backend",   label: "Backend",      color: "#3b82f6", isDefault: true },
  { id: "tag_frontend",  label: "Frontend",     color: "#22c55e", isDefault: true },
  { id: "tag_testing",   label: "Testing",      color: "#f97316", isDefault: true },
  { id: "tag_devops",    label: "DevOps",        color: "#8b5cf6", isDefault: true },
  { id: "tag_design",    label: "Design",        color: "#ec4899", isDefault: true },
  { id: "tag_meeting",   label: "Meeting",       color: "#6b7280", isDefault: true },
  { id: "tag_docs",      label: "Dokumentasi",   color: "#14b8a6", isDefault: true },
]

export const DEFAULT_TEMPLATES: WorkTemplate[] = [
  {
    id: "tpl_standup",
    label: "Daily Standup",
    description: "Mengikuti daily standup meeting dan melaporkan progress pekerjaan harian kepada tim.",
    isDefault: true,
  },
  {
    id: "tpl_codereview",
    label: "Code Review",
    description: "Melakukan review kode dari pull request anggota tim dan memberikan feedback konstruktif.",
    isDefault: true,
  },
  {
    id: "tpl_testing",
    label: "Testing & QA",
    description: "Melakukan pengujian fitur baru dan memastikan tidak ada regresi pada fitur yang sudah ada.",
    isDefault: true,
  },
  {
    id: "tpl_docs",
    label: "Dokumentasi",
    description: "Membuat dan memperbarui dokumentasi teknis terkait fitur yang sedang dikerjakan.",
    isDefault: true,
  },
  {
    id: "tpl_meeting",
    label: "Rapat Tim",
    description: "Menghadiri rapat tim untuk diskusi perencanaan sprint dan sinkronisasi progress pekerjaan.",
    isDefault: true,
  },
  {
    id: "tpl_bugfix",
    label: "Bug Fixing",
    description: "Mengidentifikasi, menginvestigasi, dan memperbaiki bug yang dilaporkan dari lingkungan produksi.",
    isDefault: true,
  },
]

// ─── Tags ────────────────────────────────────────────────────────────────────

export function loadTags(): WorkTag[] {
  if (typeof window === "undefined") return DEFAULT_TAGS
  const raw = localStorage.getItem(TAGS_KEY)
  if (!raw) {
    localStorage.setItem(TAGS_KEY, JSON.stringify(DEFAULT_TAGS))
    return DEFAULT_TAGS
  }
  try {
    return JSON.parse(raw) as WorkTag[]
  } catch {
    return DEFAULT_TAGS
  }
}

export function addTag(tag: WorkTag): void {
  if (typeof window === "undefined") return
  const tags = loadTags()
  if (tags.find((t) => t.id === tag.id)) return
  tags.push(tag)
  localStorage.setItem(TAGS_KEY, JSON.stringify(tags))
}

export function deleteTag(id: string): void {
  if (typeof window === "undefined") return
  const tags = loadTags().filter((t) => !(t.id === id && !t.isDefault))
  localStorage.setItem(TAGS_KEY, JSON.stringify(tags))
}

// ─── Draft ───────────────────────────────────────────────────────────────────

export function saveDraft(draft: Omit<ReportDraft, "savedAt">): void {
  if (typeof window === "undefined") return
  const data: ReportDraft = { ...draft, savedAt: new Date().toISOString() }
  localStorage.setItem(DRAFT_KEY, JSON.stringify(data))
}

export function loadDraft(): ReportDraft | null {
  if (typeof window === "undefined") return null
  const raw = localStorage.getItem(DRAFT_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    // Migration: ensure each item has required fields
    if (Array.isArray(parsed.items)) {
      parsed.items = parsed.items.map((item: WorkItem) => ({
        ...item,
        title: item.title ?? "",
        tags: item.tags ?? [],
        imageKeys: item.imageKeys ?? [],
      }))
    }
    return parsed as ReportDraft
  } catch {
    return null
  }
}

export function clearDraft(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(DRAFT_KEY)
}

// ─── History ─────────────────────────────────────────────────────────────────

export function saveHistory(entry: Omit<ReportHistory, "id">): ReportHistory {
  if (typeof window === "undefined") return { ...entry, id: Date.now().toString() }
  const history = loadHistory()
  const newEntry: ReportHistory = { ...entry, id: Date.now().toString() }
  history.unshift(newEntry)
  const trimmed = history.slice(0, 20)
  localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed))
  return newEntry
}

export function loadHistory(): ReportHistory[] {
  if (typeof window === "undefined") return []
  const raw = localStorage.getItem(HISTORY_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as ReportHistory[]
    // Migration: v1 entries may have old shape
    return parsed.map((entry) => ({
      ...entry,
      hasImages: entry.hasImages ?? false,
      items: Array.isArray(entry.items)
        ? entry.items.map((item: WorkItem) => ({
            ...item,
            title: item.title ?? "",
            tags: item.tags ?? [],
            imageKeys: item.imageKeys ?? [],
          }))
        : [],
    }))
  } catch {
    return []
  }
}

export function deleteHistory(id: string): void {
  if (typeof window === "undefined") return
  const history = loadHistory().filter((h) => h.id !== id)
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
}

// ─── Templates ───────────────────────────────────────────────────────────────

export function loadTemplates(): WorkTemplate[] {
  if (typeof window === "undefined") return DEFAULT_TEMPLATES
  const raw = localStorage.getItem(TEMPLATES_KEY)
  if (!raw) {
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(DEFAULT_TEMPLATES))
    return DEFAULT_TEMPLATES
  }
  try {
    const parsed = JSON.parse(raw)
    // Migration: v1 stored plain string[]
    if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === "string") {
      localStorage.setItem(TEMPLATES_KEY, JSON.stringify(DEFAULT_TEMPLATES))
      return DEFAULT_TEMPLATES
    }
    return parsed as WorkTemplate[]
  } catch {
    return DEFAULT_TEMPLATES
  }
}

export function saveTemplate(template: WorkTemplate): void {
  if (typeof window === "undefined") return
  const templates = loadTemplates()
  if (templates.find((t) => t.id === template.id)) return
  if (templates.length >= 20) return
  templates.push(template)
  localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates))
}

export function deleteTemplate(id: string): void {
  if (typeof window === "undefined") return
  const templates = loadTemplates().filter((t) => t.id !== id || t.isDefault)
  localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates))
}

// ─── PDF Theme ───────────────────────────────────────────────────────────────

export function loadThemeId(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(THEME_KEY)
}

export function saveThemeId(id: string): void {
  if (typeof window === "undefined") return
  localStorage.setItem(THEME_KEY, id)
}

// Re-export types for convenience
export type { WorkItem, WorkTag, WorkTemplate, ReportDraft, ReportHistory }
