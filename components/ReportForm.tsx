"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { reportSchema, type ReportFormValues } from "@/lib/validation"
import {
  saveDraft,
  loadDraft,
  clearDraft,
  saveHistory,
  loadHistory,
  loadTemplates,
  saveTemplate,
  loadTags,
  addTag,
  deleteTag,
  loadThemeId,
  saveThemeId,
  loadCustomColor,
  saveCustomColor,
} from "@/lib/storage"
import { DEFAULT_THEME, getThemeById, buildCustomTheme, type PdfTheme } from "@/lib/pdfThemes"
import { deleteImages, loadImages } from "@/lib/imageStorage"
import { markdownToPlainText } from "@/lib/markdown"
import type { PDFWorkItem } from "@/lib/pdfGenerator"
import { generatePDF, getPDFFileName, type PDFDocProps } from "@/lib/pdfGenerator"
import type { WorkItem, WorkTag, WorkTemplate, ReportHistory } from "@/lib/types"
import WorkItemList from "./WorkItemList"
import HistoryPanel from "./HistoryPanel"
import TemplateChips from "./TemplateChips"
import DraftIndicator from "./DraftIndicator"
import PdfPreviewModal from "./PdfPreviewModal"
import GitlabSettings from "./GitlabSettings"
import GitlabImportModal from "./GitlabImportModal"
import GithubSettings from "./GithubSettings"
import GithubImportModal from "./GithubImportModal"
import MrPasteModal from "./MrPasteModal"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  FileText,
  Eye,
  CalendarDays,
  User,
  ListChecks,
  Loader2,
  AlertCircle,
  ClipboardList,
  Copy,
  Check,
  Palette,
  GitlabIcon,
  Github,
  Settings,
  ClipboardPaste,
} from "lucide-react"
import { PDF_THEMES } from "@/lib/pdfThemes"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog"
import { toast } from "sonner"

function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function generateTemplateId(): string {
  return "tpl_" + Math.random().toString(36).slice(2) + Date.now().toString(36)
}

const DEFAULT_ITEM: WorkItem = { id: "", title: "", description: "", isEnhancing: false, imageKeys: [], tags: [] }

export default function ReportForm() {
  const [items, setItems] = useState<WorkItem[]>([
    { ...DEFAULT_ITEM, id: generateId() },
  ])
  const [tags, setTags] = useState<WorkTag[]>([])
  const [templates, setTemplates] = useState<WorkTemplate[]>([])
  const [history, setHistory] = useState<ReportHistory[]>([])
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null)
  const [selectedTheme, setSelectedTheme] = useState<PdfTheme>(DEFAULT_THEME)
  const [customColor, setCustomColor] = useState<string>("#6366f1")
  const [isGenerating, setIsGenerating] = useState(false)
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [previewData, setPreviewData] = useState<PDFDocProps | null>(null)
  const [copyModalOpen, setCopyModalOpen] = useState(false)
  const [generatedText, setGeneratedText] = useState("")
  const [copied, setCopied] = useState(false)
  const [isClient, setIsClient] = useState(false)
  const [gitlabImportOpen, setGitlabImportOpen] = useState(false)
  const [gitlabSettingsOpen, setGitlabSettingsOpen] = useState(false)
  const [githubImportOpen, setGithubImportOpen] = useState(false)
  const [githubSettingsOpen, setGithubSettingsOpen] = useState(false)
  const [mrPasteOpen, setMrPasteOpen] = useState(false)

  const form = useForm<ReportFormValues>({
    resolver: zodResolver(reportSchema),
    defaultValues: { nama: "", periodeAwal: "", periodeAkhir: "" },
  })

  const { register, watch, setValue, formState: { errors } } = form
  const watchedValues = watch()

  // ── Client init ────────────────────────────────────────────────────────────
  useEffect(() => {
    setIsClient(true)
    const draft = loadDraft()
    if (draft) {
      setValue("nama", draft.nama)
      setValue("periodeAwal", draft.periodeAwal)
      setValue("periodeAkhir", draft.periodeAkhir)
      setItems(
        draft.items.length > 0
          ? draft.items.map((i) => ({ ...i, isEnhancing: false, imageKeys: i.imageKeys ?? [] }))
          : [{ ...DEFAULT_ITEM, id: generateId() }]
      )
      setDraftSavedAt(draft.savedAt)
      toast.success("Draft terakhir berhasil dimuat")
    }
    setTags(loadTags())
    setTemplates(loadTemplates())
    setHistory(loadHistory())
    const savedColor = loadCustomColor()
    if (savedColor) setCustomColor(savedColor)
    const savedThemeId = loadThemeId()
    if (savedThemeId === "custom" && savedColor) {
      setSelectedTheme(buildCustomTheme(savedColor))
    } else if (savedThemeId) {
      setSelectedTheme(getThemeById(savedThemeId))
    }
  }, [setValue])

  // ── Auto-save draft (1s debounce) ─────────────────────────────────────────
  const saveDraftNow = useCallback(() => {
    if (!isClient) return
    saveDraft({
      nama: watchedValues.nama,
      periodeAwal: watchedValues.periodeAwal,
      periodeAkhir: watchedValues.periodeAkhir,
      items,
    })
    setDraftSavedAt(new Date().toISOString())
  }, [isClient, watchedValues.nama, watchedValues.periodeAwal, watchedValues.periodeAkhir, items])

  useEffect(() => {
    if (!isClient) return
    const timeout = setTimeout(saveDraftNow, 1000)
    return () => clearTimeout(timeout)
  }, [saveDraftNow, isClient])

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  const handleGenerateRef = useRef<() => void>(() => {})

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault()
        handleGenerateRef.current()
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault()
        saveDraftNow()
        toast.success("Draft disimpan", { duration: 1500 })
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [saveDraftNow])

  // ── Clear draft ────────────────────────────────────────────────────────────
  const handleClearDraft = useCallback(async () => {
    // Delete all per-item images
    const allKeys = items.flatMap((i) => i.imageKeys)
    if (allKeys.length > 0) await deleteImages(allKeys)
    clearDraft()
    setValue("nama", "")
    setValue("periodeAwal", "")
    setValue("periodeAkhir", "")
    setItems([{ ...DEFAULT_ITEM, id: generateId() }])
    setDraftSavedAt(null)
    toast.success("Draft berhasil dihapus")
  }, [items, setValue])

  // ── Tag handlers ───────────────────────────────────────────────────────────
  const handleTagsChange = (newTags: WorkTag[]) => {
    setTags(newTags)
    // Persist: handle multiple added/removed tags (e.g. AI label & GitLab import)
    const added = newTags.filter((t) => !tags.find((e) => e.id === t.id))
    const removed = tags.filter((t) => !newTags.find((e) => e.id === t.id))
    added.forEach((t) => addTag(t))
    removed.forEach((t) => deleteTag(t.id))
  }

  // ── Template handlers ──────────────────────────────────────────────────────
  const handleUseTemplate = (description: string) => {
    setItems((prev) => [...prev, { id: generateId(), title: "", description, isEnhancing: false, imageKeys: [], tags: [] }])
  }

  const handleSaveTemplate = (description: string) => {
    const newTemplate: WorkTemplate = {
      id: generateTemplateId(),
      label: description.slice(0, 30).trim(),
      description,
      isDefault: false,
    }
    saveTemplate(newTemplate)
    setTemplates(loadTemplates())
    toast.success("Template disimpan")
  }

  // ── GitLab import handler ──────────────────────────────────────────────────
  const handleGitlabImport = useCallback((newItems: WorkItem[]) => {
    if (newItems.length === 0) return
    setItems((prev) => {
      // Drop the initial empty default item if it's the only thing present
      const onlyEmptyDefault =
        prev.length === 1 && !prev[0].title.trim() && !prev[0].description.trim() && prev[0].imageKeys.length === 0
      return onlyEmptyDefault ? newItems : [...prev, ...newItems]
    })
  }, [])

  // ── Theme handler ──────────────────────────────────────────────────────────
  const handleThemeChange = useCallback((theme: PdfTheme) => {
    setSelectedTheme(theme)
    saveThemeId(theme.id)
  }, [])

  const handleCustomColorChange = useCallback((hex: string) => {
    setCustomColor(hex)
    saveCustomColor(hex)
    const theme = buildCustomTheme(hex)
    setSelectedTheme(theme)
    saveThemeId("custom")
  }, [])

  // ── Build PDF data ─────────────────────────────────────────────────────────
  const buildPDFData = useCallback(
    async (values: ReportFormValues): Promise<PDFDocProps | null> => {
      const filledItems = items.filter((i) => i.description.trim())
      if (filledItems.length === 0) {
        toast.error("Tambahkan setidaknya satu item pekerjaan")
        return null
      }
      if (filledItems.some((i) => !i.title.trim())) {
        toast.error("Setiap item pekerjaan harus memiliki judul")
        return null
      }
      // Load images per item in parallel + resolve tags
      const pdfItems: PDFWorkItem[] = await Promise.all(
        filledItems.map(async (item) => ({
          id: item.id,
          title: item.title,
          description: item.description,
          images: item.imageKeys.length > 0 ? await loadImages(item.imageKeys) : [],
          tags: item.tags
            .map((tagId) => tags.find((t) => t.id === tagId))
            .filter((t): t is WorkTag => t !== undefined)
            .map((t) => ({ label: t.label, color: t.color })),
        }))
      )
      return {
        nama: values.nama,
        periodeAwal: values.periodeAwal,
        periodeAkhir: values.periodeAkhir,
        items: pdfItems,
        theme: selectedTheme,
      }
    },
    [items, selectedTheme]
  )

  // ── Preview PDF ────────────────────────────────────────────────────────────
  const handlePreview = useCallback(async () => {
    const valid = await form.trigger()
    if (!valid) return
    const data = await buildPDFData(form.getValues())
    if (!data) return
    setPreviewData(data)
    setIsPreviewing(true)
  }, [form, buildPDFData])

  // ── Generate & download PDF ────────────────────────────────────────────────
  const handleDownload = useCallback(
    async (data: PDFDocProps) => {
      setIsGenerating(true)
      try {
        const blob = await generatePDF(data)
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = getPDFFileName(data.nama, data.periodeAwal, data.periodeAkhir)
        a.click()
        URL.revokeObjectURL(url)

        const filledItems = items.filter((i) => i.description.trim())
        const hasImages = filledItems.some((i) => i.imageKeys.length > 0)
        saveHistory({
          nama: data.nama,
          periodeAwal: data.periodeAwal,
          periodeAkhir: data.periodeAkhir,
          tanggalGenerate: new Date().toISOString(),
          items: filledItems,
          hasImages,
        })
        setHistory(loadHistory())
        toast.success("PDF berhasil digenerate dan didownload!")
      } catch (err) {
        console.error(err)
        toast.error("Gagal generate PDF. Silakan coba lagi.")
      } finally {
        setIsGenerating(false)
      }
    },
    [items]
  )

  // ── Generate button ────────────────────────────────────────────────────────
  const handleGenerate = useCallback(async () => {
    const valid = await form.trigger()
    if (!valid) return
    const data = await buildPDFData(form.getValues())
    if (!data) return
    await handleDownload(data)
  }, [form, buildPDFData, handleDownload])

  useEffect(() => {
    handleGenerateRef.current = handleGenerate
  }, [handleGenerate])

  // ── Generate plain-text summary ────────────────────────────────────────────
  const handleGenerateText = useCallback(() => {
    const filledItems = items.filter((i) => i.description.trim())
    if (filledItems.length === 0) {
      toast.error("Tambahkan setidaknya satu item pekerjaan")
      return
    }

    const lines: string[] = []

    filledItems.forEach((item, idx) => {
      lines.push(`${idx + 1}. ${item.title || "(Tanpa Judul)"}`)
      markdownToPlainText(item.description)
        .split("\n")
        .forEach((line) => lines.push(`   ${line}`))
      if (idx < filledItems.length - 1) lines.push("")
    })

    setGeneratedText(lines.join("\n").trimEnd())
    setCopied(false)
    setCopyModalOpen(true)
  }, [items, tags])

  const handleCopyText = async () => {
    await navigator.clipboard.writeText(generatedText)
    setCopied(true)
    toast.success("Teks berhasil disalin!")
    setTimeout(() => setCopied(false), 2000)
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="space-y-5">

        {/* ── Header ── */}
        <div className="relative overflow-hidden rounded-2xl bg-blue-700 shadow-xl">
          {/* Subtle mesh pattern */}
          <div className="absolute inset-0 opacity-10"
            style={{ backgroundImage: "radial-gradient(circle at 20% 50%, #60a5fa 0%, transparent 50%), radial-gradient(circle at 80% 20%, #a78bfa 0%, transparent 40%)" }} />
          <div className="relative z-10 px-8 py-7 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2.5 mb-1.5">
                <div className="rounded-lg bg-white/15 p-1.5">
                  <FileText className="h-5 w-5 text-white" />
                </div>
                <h1 className="text-xl font-bold text-white tracking-tight">Weekly Report Generator</h1>
              </div>
              <p className="text-blue-200 text-sm leading-relaxed">
                Buat laporan kerja mingguan yang profesional & generate PDF.
              </p>
            </div>
            <div className="hidden sm:flex flex-col items-end gap-1 text-right">
              <span className="text-[10px] text-blue-300 font-medium uppercase tracking-wider">Shortcut</span>
              <span className="text-xs text-blue-200 bg-white/10 rounded px-2 py-0.5 font-mono">Ctrl+Enter → Generate</span>
              <span className="text-xs text-blue-200 bg-white/10 rounded px-2 py-0.5 font-mono">Ctrl+S → Save Draft</span>
            </div>
          </div>
        </div>

        {/* ── Draft Indicator ── */}
        {isClient && (
          <DraftIndicator savedAt={draftSavedAt} onClear={handleClearDraft} />
        )}

        {/* ── Info Section ── */}
        <div className="rounded-2xl bg-white shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-50 bg-gray-50/50">
            <div className="rounded-lg bg-blue-100 p-1.5">
              <User className="h-4 w-4 text-blue-600" />
            </div>
            <h2 className="font-semibold text-gray-800 text-sm">Informasi Laporan</h2>
          </div>
          <div className="px-6 py-5 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="nama" className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Nama Karyawan
              </Label>
              <Input
                id="nama"
                placeholder="Masukkan nama lengkap..."
                {...register("nama")}
                className={`h-11 rounded-xl border-gray-200 bg-gray-50 focus:bg-white transition-colors ${errors.nama ? "border-red-400 bg-red-50" : ""}`}
              />
              {errors.nama && (
                <p className="flex items-center gap-1 text-xs text-red-500">
                  <AlertCircle className="h-3 w-3" />{errors.nama.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="periodeAwal" className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                  <CalendarDays className="h-3 w-3" /> Mulai
                </Label>
                <Input
                  id="periodeAwal"
                  type="date"
                  {...register("periodeAwal")}
                  className={`h-11 rounded-xl border-gray-200 bg-gray-50 focus:bg-white transition-colors ${errors.periodeAwal ? "border-red-400 bg-red-50" : ""}`}
                />
                {errors.periodeAwal && (
                  <p className="flex items-center gap-1 text-xs text-red-500">
                    <AlertCircle className="h-3 w-3" />{errors.periodeAwal.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="periodeAkhir" className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                  <CalendarDays className="h-3 w-3" /> Selesai
                </Label>
                <Input
                  id="periodeAkhir"
                  type="date"
                  {...register("periodeAkhir")}
                  min={watchedValues.periodeAwal}
                  className={`h-11 rounded-xl border-gray-200 bg-gray-50 focus:bg-white transition-colors ${errors.periodeAkhir ? "border-red-400 bg-red-50" : ""}`}
                />
                {errors.periodeAkhir && (
                  <p className="flex items-center gap-1 text-xs text-red-500">
                    <AlertCircle className="h-3 w-3" />{errors.periodeAkhir.message}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Work Items ── */}
        <div className="rounded-2xl bg-white shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-50 bg-gray-50/50">
            <div className="rounded-lg bg-blue-100 p-1.5">
              <ListChecks className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-800 text-sm">Ringkasan Pekerjaan</h2>
              <p className="text-xs text-gray-400 mt-0.5">Tambahkan bukti gambar di setiap item</p>
            </div>
          </div>
          <div className="px-6 py-5 space-y-4">
            {isClient && templates.length > 0 && (
              <>
                <TemplateChips
                  templates={templates}
                  onUseTemplate={handleUseTemplate}
                  onTemplatesChange={setTemplates}
                />
                <Separator />
              </>
            )}
            <WorkItemList
              items={items}
              onChange={setItems}
              onSaveTemplate={handleSaveTemplate}
              allTags={tags}
              onTagsChange={handleTagsChange}
            />
          </div>
        </div>

        {/* ── Action Buttons ── */}
        <div className="space-y-2.5">
          {/* Theme picker */}
          <div className="rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <Palette className="h-3.5 w-3.5" />
                Tema PDF
              </div>
              <span className="text-xs text-gray-400">{selectedTheme.label}</span>
            </div>
            <div className="mt-3 flex items-center gap-2">
              {PDF_THEMES.map((theme) => (
                <button
                  key={theme.id}
                  type="button"
                  title={theme.label}
                  onClick={() => handleThemeChange(theme)}
                  className="group relative flex flex-1 flex-col items-center gap-1.5 rounded-lg py-2 transition-all hover:bg-gray-50"
                >
                  <span
                    className="h-7 w-7 rounded-full transition-transform group-hover:scale-110"
                    style={{ backgroundColor: theme.primary }}
                  >
                    {selectedTheme.id === theme.id && (
                      <span
                        className="flex h-full w-full items-center justify-center rounded-full ring-2 ring-offset-2"
                        style={{ ringColor: theme.primary } as React.CSSProperties}
                      >
                        <span className="h-2 w-2 rounded-full bg-white" />
                      </span>
                    )}
                  </span>
                  <span className={`text-[10px] font-medium ${selectedTheme.id === theme.id ? "text-gray-800" : "text-gray-400"}`}>
                    {theme.label}
                  </span>
                </button>
              ))}
              {/* Custom color button */}
              <label
                title="Warna kustom"
                className="group relative flex flex-1 cursor-pointer flex-col items-center gap-1.5 rounded-lg py-2 transition-all hover:bg-gray-50"
              >
                <span
                  className="relative h-7 w-7 rounded-full transition-transform group-hover:scale-110 overflow-hidden border-2 border-dashed border-gray-300"
                  style={{ backgroundColor: customColor }}
                >
                  {selectedTheme.id === "custom" && (
                    <span className="flex h-full w-full items-center justify-center rounded-full ring-2 ring-offset-2">
                      <span className="h-2 w-2 rounded-full bg-white" />
                    </span>
                  )}
                </span>
                <span className={`text-[10px] font-medium ${selectedTheme.id === "custom" ? "text-gray-800" : "text-gray-400"}`}>
                  Kustom
                </span>
                <input
                  type="color"
                  value={customColor}
                  onChange={(e) => handleCustomColorChange(e.target.value)}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                />
              </label>
            </div>
          </div>

          {/* PDF actions */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handlePreview}
              disabled={isGenerating}
              className="flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-white py-4 text-blue-700 font-semibold text-sm hover:bg-blue-50 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed transition-all"
            >
              <Eye className="h-4 w-4" />
              Preview PDF
            </button>

            <button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating}
              className="flex items-center justify-center gap-2 rounded-xl bg-blue-700 py-4 text-white font-semibold text-sm shadow-lg hover:bg-blue-800 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-150"
            >
              {isGenerating ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Generating...</>
              ) : (
                <><FileText className="h-4 w-4" />Generate PDF</>
              )}
            </button>
          </div>

          {/* Copy plain text */}
          <button
            type="button"
            onClick={handleGenerateText}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-800 shadow-sm transition-all"
          >
            <ClipboardList className="h-4 w-4" />
            Salin Ringkasan Teks
          </button>

          {/* Paste from Merge Request */}
          <button
            type="button"
            onClick={() => setMrPasteOpen(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-blue-200 bg-white py-3 text-sm font-medium text-blue-700 hover:bg-blue-50 shadow-sm transition-all"
          >
            <ClipboardPaste className="h-4 w-4" />
            Tempel dari Merge Request
          </button>

          {/* Import from GitLab */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setGitlabImportOpen(true)}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-orange-200 bg-white py-3 text-sm font-medium text-orange-700 hover:bg-orange-50 shadow-sm transition-all"
            >
              <GitlabIcon className="h-4 w-4" />
              Import dari GitLab
            </button>
            <button
              type="button"
              onClick={() => setGitlabSettingsOpen(true)}
              title="Pengaturan koneksi GitLab"
              className="flex items-center justify-center rounded-xl border border-gray-200 bg-white px-3 text-gray-500 hover:bg-gray-50 hover:text-gray-700 shadow-sm transition-all"
            >
              <Settings className="h-4 w-4" />
            </button>
          </div>

          {/* Import from GitHub */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setGithubImportOpen(true)}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white py-3 text-sm font-medium text-gray-800 hover:bg-gray-50 shadow-sm transition-all"
            >
              <Github className="h-4 w-4" />
              Import dari GitHub
            </button>
            <button
              type="button"
              onClick={() => setGithubSettingsOpen(true)}
              title="Pengaturan koneksi GitHub"
              className="flex items-center justify-center rounded-xl border border-gray-200 bg-white px-3 text-gray-500 hover:bg-gray-50 hover:text-gray-700 shadow-sm transition-all"
            >
              <Settings className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ── History ── */}
        {isClient && history.length > 0 && (
          <HistoryPanel history={history} onHistoryChange={setHistory} />
        )}
      </div>

      {previewData && (
        <PdfPreviewModal
          open={isPreviewing}
          data={previewData}
          onClose={() => setIsPreviewing(false)}
          onDownload={() => handleDownload(previewData)}
          isDownloading={isGenerating}
          selectedTheme={selectedTheme}
          onThemeChange={handleThemeChange}
          customColor={customColor}
          onCustomColorChange={handleCustomColorChange}
        />
      )}

      {/* ── GitLab Modals ── */}
      <GitlabImportModal
        open={gitlabImportOpen}
        onClose={() => setGitlabImportOpen(false)}
        periodeAwal={watchedValues.periodeAwal}
        periodeAkhir={watchedValues.periodeAkhir}
        allTags={tags}
        onTagsChange={handleTagsChange}
        onImport={handleGitlabImport}
        onOpenSettings={() => setGitlabSettingsOpen(true)}
      />
      <GitlabSettings
        open={gitlabSettingsOpen}
        onClose={() => setGitlabSettingsOpen(false)}
      />

      {/* ── GitHub Modals ── */}
      <GithubImportModal
        open={githubImportOpen}
        onClose={() => setGithubImportOpen(false)}
        periodeAwal={watchedValues.periodeAwal}
        periodeAkhir={watchedValues.periodeAkhir}
        allTags={tags}
        onTagsChange={handleTagsChange}
        onImport={handleGitlabImport}
        onOpenSettings={() => setGithubSettingsOpen(true)}
      />
      <GithubSettings
        open={githubSettingsOpen}
        onClose={() => setGithubSettingsOpen(false)}
      />
      <MrPasteModal
        open={mrPasteOpen}
        onClose={() => setMrPasteOpen(false)}
        allTags={tags}
        onTagsChange={handleTagsChange}
        onImport={handleGitlabImport}
      />

      {/* ── Copy Text Modal ── */}
      <Dialog open={copyModalOpen} onOpenChange={setCopyModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="h-4 w-4 text-blue-600" />
              Ringkasan Teks
            </DialogTitle>
          </DialogHeader>

          <div className="relative">
            <textarea
              readOnly
              value={generatedText}
              className="w-full h-64 rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs font-mono leading-relaxed text-gray-700 resize-none outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              onClick={(e) => (e.target as HTMLTextAreaElement).select()}
            />
            <p className="mt-1 text-[10px] text-gray-400">Klik teks di atas untuk pilih semua</p>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <DialogClose asChild>
              <button
                type="button"
                className="px-4 py-2 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Tutup
              </button>
            </DialogClose>
            <button
              type="button"
              onClick={handleCopyText}
              className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg font-semibold transition-all ${
                copied
                  ? "bg-green-600 text-white"
                  : "bg-blue-600 text-white hover:bg-blue-700"
              }`}
            >
              {copied ? (
                <><Check className="h-4 w-4" />Tersalin!</>
              ) : (
                <><Copy className="h-4 w-4" />Salin Semua</>
              )}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
