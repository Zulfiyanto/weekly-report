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
} from "@/lib/storage"
import { deleteImages, loadImages } from "@/lib/imageStorage"
import type { PDFWorkItem } from "@/lib/pdfGenerator"
import { generatePDF, getPDFFileName, type PDFDocProps } from "@/lib/pdfGenerator"
import type { WorkItem, WorkTemplate, ReportHistory } from "@/lib/types"
import WorkItemList from "./WorkItemList"
import HistoryPanel from "./HistoryPanel"
import TemplateChips from "./TemplateChips"
import DraftIndicator from "./DraftIndicator"
import PdfPreviewModal from "./PdfPreviewModal"
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
} from "lucide-react"
import { toast } from "sonner"

function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function generateTemplateId(): string {
  return "tpl_" + Math.random().toString(36).slice(2) + Date.now().toString(36)
}

const DEFAULT_ITEM: WorkItem = { id: "", description: "", isEnhancing: false, imageKeys: [] }

export default function ReportForm() {
  const [items, setItems] = useState<WorkItem[]>([
    { ...DEFAULT_ITEM, id: generateId() },
  ])
  const [templates, setTemplates] = useState<WorkTemplate[]>([])
  const [history, setHistory] = useState<ReportHistory[]>([])
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [previewData, setPreviewData] = useState<PDFDocProps | null>(null)
  const [isClient, setIsClient] = useState(false)

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
    setTemplates(loadTemplates())
    setHistory(loadHistory())
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

  // ── Template handlers ──────────────────────────────────────────────────────
  const handleUseTemplate = (description: string) => {
    setItems((prev) => [...prev, { id: generateId(), description, isEnhancing: false, imageKeys: [] }])
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

  // ── Build PDF data ─────────────────────────────────────────────────────────
  const buildPDFData = useCallback(
    async (values: ReportFormValues): Promise<PDFDocProps | null> => {
      const filledItems = items.filter((i) => i.description.trim())
      if (filledItems.length === 0) {
        toast.error("Tambahkan setidaknya satu item pekerjaan")
        return null
      }
      // Load images per item in parallel
      const pdfItems: PDFWorkItem[] = await Promise.all(
        filledItems.map(async (item) => ({
          id: item.id,
          description: item.description,
          images: item.imageKeys.length > 0 ? await loadImages(item.imageKeys) : [],
        }))
      )
      return {
        nama: values.nama,
        periodeAwal: values.periodeAwal,
        periodeAkhir: values.periodeAkhir,
        items: pdfItems,
      }
    },
    [items]
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
            />
          </div>
        </div>

        {/* ── Action Buttons ── */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={handlePreview}
            disabled={isGenerating}
            className="flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-white py-4 text-blue-700 font-semibold text-sm hover:bg-blue-50 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed transition-all"
          >
            <Eye className="h-4.5 w-4.5" />
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
        />
      )}
    </>
  )
}
