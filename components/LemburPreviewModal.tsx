"use client"

import { useEffect, useState } from "react"
import { Download, X, Loader2 } from "lucide-react"
import type { LemburPDFProps } from "@/lib/lemburPdf"

interface LemburPreviewModalProps {
  open: boolean
  data: LemburPDFProps
  onClose: () => void
  onDownload: () => void
  isDownloading: boolean
}

export default function LemburPreviewModal({
  open,
  data,
  onClose,
  onDownload,
  isDownloading,
}: LemburPreviewModalProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return

    let url: string | null = null
    setIsLoading(true)
    setError(null)
    setBlobUrl(null)

    // Dynamic import to avoid SSR issues with @react-pdf/renderer
    import("@/lib/lemburPdf")
      .then(({ generateLemburPDF }) => generateLemburPDF(data))
      .then((blob) => {
        url = URL.createObjectURL(blob)
        setBlobUrl(url)
      })
      .catch((err) => {
        console.error("PDF preview error:", err)
        setError("Gagal memuat preview PDF.")
      })
      .finally(() => setIsLoading(false))

    return () => {
      if (url) URL.revokeObjectURL(url)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/70 backdrop-blur-sm">
      {/* Toolbar */}
      <div className="flex items-center justify-between bg-gray-900 px-5 py-3 shrink-0 gap-4">
        <div className="min-w-0">
          <h2 className="text-white font-semibold text-sm">Preview Laporan Lembur</h2>
          <p className="text-gray-400 text-xs mt-0.5 truncate">
            {data.nama} — {data.items.length} kegiatan
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onDownload}
            disabled={isDownloading || isLoading}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {isDownloading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {isDownloading ? "Generating..." : "Download PDF"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
            title="Tutup preview"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 overflow-hidden bg-gray-800">
        {isLoading && (
          <div className="flex flex-1 items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
              <p className="text-sm text-gray-400">Memuat preview PDF...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <p className="text-red-400 text-sm">{error}</p>
              <p className="text-gray-500 text-xs mt-1">
                Coba gunakan tombol Download PDF langsung.
              </p>
            </div>
          </div>
        )}

        {blobUrl && !isLoading && (
          <iframe
            src={blobUrl}
            className="flex-1 w-full h-full border-0"
            title="Preview PDF Lembur"
          />
        )}
      </div>
    </div>
  )
}
