"use client"

import { useEffect, useState } from "react"
import { Download, X, Loader2, Palette } from "lucide-react"
import type { PDFDocProps } from "@/lib/pdfGenerator"
import { PDF_THEMES, buildCustomTheme, type PdfTheme } from "@/lib/pdfThemes"

interface PdfPreviewModalProps {
  open: boolean
  data: PDFDocProps
  onClose: () => void
  onDownload: () => void
  isDownloading: boolean
  selectedTheme: PdfTheme
  onThemeChange: (theme: PdfTheme) => void
  customColor: string
  onCustomColorChange: (hex: string) => void
}

export default function PdfPreviewModal({
  open,
  data,
  onClose,
  onDownload,
  isDownloading,
  selectedTheme,
  onThemeChange,
  customColor,
  onCustomColorChange,
}: PdfPreviewModalProps) {
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
    import("@/lib/pdfGenerator")
      .then(({ generatePDF }) => generatePDF({ ...data, theme: selectedTheme }))
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
  }, [open, selectedTheme])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/70 backdrop-blur-sm">
      {/* Toolbar */}
      <div className="flex items-center justify-between bg-gray-900 px-5 py-3 shrink-0 gap-4">
        <div className="min-w-0">
          <h2 className="text-white font-semibold text-sm">Preview PDF</h2>
          <p className="text-gray-400 text-xs mt-0.5 truncate">
            {data.nama} — {data.periodeAwal} s/d {data.periodeAkhir}
          </p>
        </div>

        {/* Theme Picker */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5 text-gray-400 text-xs">
            <Palette className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Tema:</span>
          </div>
          <div className="flex items-center gap-1.5">
            {PDF_THEMES.map((theme) => (
              <button
                key={theme.id}
                type="button"
                title={theme.label}
                onClick={() => onThemeChange(theme)}
                className="relative h-6 w-6 rounded-full transition-transform hover:scale-110 focus:outline-none"
                style={{ backgroundColor: theme.primary }}
              >
                {selectedTheme.id === theme.id && (
                  <span className="absolute inset-0 rounded-full ring-2 ring-white ring-offset-1 ring-offset-gray-900" />
                )}
              </button>
            ))}
            {/* Custom color picker */}
            <label
              title="Warna kustom"
              className="relative h-6 w-6 cursor-pointer rounded-full transition-transform hover:scale-110 border-2 border-dashed border-gray-500 overflow-hidden"
              style={{ backgroundColor: customColor }}
            >
              {selectedTheme.id === "custom" && (
                <span className="absolute inset-0 rounded-full ring-2 ring-white ring-offset-1 ring-offset-gray-900" />
              )}
              <input
                type="color"
                value={customColor}
                onChange={(e) => {
                  onCustomColorChange(e.target.value)
                  onThemeChange(buildCustomTheme(e.target.value))
                }}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
            </label>
          </div>
          <span className="hidden sm:block text-xs text-gray-500 ml-1">
            {selectedTheme.label}
          </span>
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
            title="Preview PDF"
          />
        )}
      </div>
    </div>
  )
}
