"use client"

import { useState } from "react"
import type { ReportHistory } from "@/lib/types"
import { deleteHistory } from "@/lib/storage"
import { loadImages } from "@/lib/imageStorage"
import { format } from "date-fns"
import { id } from "date-fns/locale"
import { Download, Trash2, ChevronDown, ChevronUp, ClipboardList, Image as ImageIcon } from "lucide-react"
import { generatePDF, getPDFFileName } from "@/lib/pdfGenerator"
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import { toast } from "sonner"

interface HistoryPanelProps {
  history: ReportHistory[]
  onHistoryChange: (history: ReportHistory[]) => void
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "-"
  try {
    return format(new Date(dateStr), "dd MMM yyyy", { locale: id })
  } catch {
    return dateStr
  }
}

function formatDateTime(dateStr: string): string {
  if (!dateStr) return "-"
  try {
    return format(new Date(dateStr), "dd MMM yyyy, HH:mm", { locale: id })
  } catch {
    return dateStr
  }
}

export default function HistoryPanel({ history, onHistoryChange }: HistoryPanelProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(true)

  const handleDelete = (id: string) => {
    deleteHistory(id)
    onHistoryChange(history.filter((h) => h.id !== id))
    toast.success("Riwayat dihapus")
  }

  const handleDownload = async (entry: ReportHistory) => {
    setLoadingId(entry.id)
    try {
      // Load images per item
      const pdfItems = await Promise.all(
        entry.items.map(async (item) => ({
          id: item.id,
          title: item.title ?? "",
          description: item.description,
          images: item.imageKeys?.length ? await loadImages(item.imageKeys) : [],
          tags: [],
        }))
      )
      const blob = await generatePDF({
        nama: entry.nama,
        periodeAwal: entry.periodeAwal,
        periodeAkhir: entry.periodeAkhir,
        items: pdfItems,
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = getPDFFileName(entry.nama, entry.periodeAwal, entry.periodeAkhir)
      a.click()
      URL.revokeObjectURL(url)
      toast.success("PDF berhasil didownload")
    } catch (err) {
      console.error(err)
      toast.error("Gagal generate PDF.")
    } finally {
      setLoadingId(null)
    }
  }

  if (history.length === 0) return null

  return (
    <div className="rounded-2xl bg-white shadow-sm border border-gray-100 overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-6 py-4 border-b border-gray-50 bg-gray-50/50 hover:bg-gray-100/50 transition-colors"
      >
        <div className="rounded-lg bg-blue-100 p-1.5">
          <ClipboardList className="h-4 w-4 text-blue-600" />
        </div>
        <span className="font-semibold text-gray-800 text-sm">Riwayat Report</span>
        <span className="text-xs font-medium text-blue-600 bg-blue-100 rounded-full px-2 py-0.5">
          {history.length}
        </span>
        <span className="ml-auto text-gray-400">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      {expanded && (
        <div className="divide-y divide-gray-50">
          {history.map((entry) => {
                const isLoading = loadingId === entry.id
                return (
                  <div key={entry.id} className="flex items-center gap-4 px-6 py-3.5 hover:bg-gray-50/60 transition-colors group">
                    {/* Icon */}
                    <div className="shrink-0 w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
                      <ClipboardList className="h-4 w-4 text-blue-500" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-800 truncate">{entry.nama}</p>
                        {entry.hasImages && (
                          <span className="flex items-center gap-0.5 text-[10px] text-blue-500 bg-blue-50 rounded-full px-1.5 py-0.5 shrink-0">
                            <ImageIcon className="h-2.5 w-2.5" />
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        {formatDate(entry.periodeAwal)} — {formatDate(entry.periodeAkhir)}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {formatDateTime(entry.tanggalGenerate)} · {entry.items.length} item
                      </p>
                    </div>

                    <div className="flex gap-1.5 shrink-0">
                      {/* Download */}
                      <button
                        type="button"
                        onClick={() => handleDownload(entry)}
                        disabled={isLoading}
                        className="flex items-center gap-1.5 rounded-lg bg-blue-600 text-white px-3 py-1.5 text-xs font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
                      >
                        {isLoading ? (
                          <span className="h-3 w-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                        ) : (
                          <Download className="h-3 w-3" />
                        )}
                        Download
                      </button>

                      {/* Delete with confirmation */}
                      <Dialog>
                        <DialogTrigger asChild>
                          <button
                            type="button"
                            className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                            title="Hapus riwayat"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </DialogTrigger>
                        <DialogContent className="max-w-sm">
                          <DialogHeader>
                            <DialogTitle>Hapus Riwayat?</DialogTitle>
                            <DialogDescription>
                              Riwayat report <strong>{entry.nama}</strong> ({formatDate(entry.periodeAwal)} – {formatDate(entry.periodeAkhir)}) akan dihapus permanen.
                            </DialogDescription>
                          </DialogHeader>
                          <DialogFooter>
                            <DialogClose asChild>
                              <button
                                type="button"
                                className="px-4 py-2 text-sm rounded-md border border-gray-200 hover:bg-gray-50 transition-colors"
                              >
                                Batal
                              </button>
                            </DialogClose>
                            <DialogClose asChild>
                              <button
                                type="button"
                                onClick={() => handleDelete(entry.id)}
                                className="px-4 py-2 text-sm rounded-md bg-red-500 text-white hover:bg-red-600 transition-colors"
                              >
                                Hapus
                              </button>
                            </DialogClose>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                )
              })}
        </div>
      )}
    </div>
  )
}
