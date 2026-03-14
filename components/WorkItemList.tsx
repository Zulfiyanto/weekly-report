"use client"

import { useEffect, useRef, useState } from "react"
import type { WorkItem } from "@/lib/types"
import { storeImage, deleteImage, loadImages, getTotalSizeLabel } from "@/lib/imageStorage"
import { Trash2, Sparkles, GripVertical, Plus, BookmarkPlus, ImagePlus, X, ZoomIn } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"

const MAX_DESC = 500
const MAX_IMAGES_PER_ITEM = 5

interface WorkItemListProps {
  items: WorkItem[]
  onChange: (items: WorkItem[]) => void
  onSaveTemplate: (description: string) => void
}

function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

// ── Per-item image section ────────────────────────────────────────────────────
function ItemImages({
  item,
  onKeysChange,
}: {
  item: WorkItem
  onKeysChange: (keys: string[]) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const pasteZoneRef = useRef<HTMLDivElement>(null)
  const [previews, setPreviews] = useState<string[]>([])
  const [lightbox, setLightbox] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [pasteActive, setPasteActive] = useState(false)

  useEffect(() => {
    if (item.imageKeys.length === 0) { setPreviews([]); return }
    loadImages(item.imageKeys).then(setPreviews)
  }, [item.imageKeys])

  const processFiles = async (files: File[]) => {
    if (files.length === 0) return
    const remaining = MAX_IMAGES_PER_ITEM - item.imageKeys.length
    if (remaining <= 0) { toast.error(`Maksimal ${MAX_IMAGES_PER_ITEM} gambar per item`); return }
    setUploading(true)
    const newKeys: string[] = []
    for (const file of files.slice(0, remaining)) {
      try {
        const key = await storeImage(file, item.imageKeys.length + newKeys.length)
        newKeys.push(key)
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Gagal upload gambar")
      }
    }
    if (newKeys.length > 0) onKeysChange([...item.imageKeys, ...newKeys])
    setUploading(false)
    if (inputRef.current) inputRef.current.value = ""
  }

  const handleFileInput = (files: FileList | null) => {
    if (files) processFiles(Array.from(files))
  }

  // ── Paste handler ───────────────────────────────────────────────────────────
  const handlePaste = (e: React.ClipboardEvent | ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return
    const imageFiles = Array.from(items)
      .filter((it) => it.type.startsWith("image/"))
      .map((it) => it.getAsFile())
      .filter((f): f is File => f !== null)
    if (imageFiles.length > 0) {
      e.preventDefault()
      processFiles(imageFiles)
      toast.success("Screenshot berhasil ditempel!")
    }
  }

  // Global paste listener while paste zone is focused
  useEffect(() => {
    if (!pasteActive) return
    const handler = (e: ClipboardEvent) => handlePaste(e)
    window.addEventListener("paste", handler)
    return () => window.removeEventListener("paste", handler)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pasteActive, item.imageKeys])

  const removeImage = async (idx: number) => {
    await deleteImage(item.imageKeys[idx])
    onKeysChange(item.imageKeys.filter((_, i) => i !== idx))
  }

  const count = item.imageKeys.length

  return (
    <div className="mt-2 space-y-2">
      {/* Thumbnails */}
      {previews.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {previews.map((src, idx) => (
            <div
              key={item.imageKeys[idx] ?? idx}
              className="group relative h-16 w-16 rounded-lg overflow-hidden border border-gray-200 bg-gray-50 shrink-0"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`Bukti ${idx + 1}`} className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                <button type="button" onClick={() => setLightbox(src)}
                  className="rounded-full bg-white/20 p-1 text-white hover:bg-white/40 transition-colors">
                  <ZoomIn className="h-3 w-3" />
                </button>
                <button type="button" onClick={() => removeImage(idx)}
                  className="rounded-full bg-white/20 p-1 text-white hover:bg-red-500/80 transition-colors">
                  <X className="h-3 w-3" />
                </button>
              </div>
              <span className="absolute top-0.5 left-0.5 rounded-sm bg-black/50 text-white text-[9px] px-1 font-mono">
                {idx + 1}
              </span>
            </div>
          ))}

          {/* Add more */}
          {count < MAX_IMAGES_PER_ITEM && (
            <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading}
              className="h-16 w-16 rounded-lg border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-0.5 text-gray-400 hover:border-blue-400 hover:text-blue-400 hover:bg-blue-50 transition-all shrink-0"
              title="Tambah gambar">
              <ImagePlus className="h-4 w-4" />
              <span className="text-[9px]">Tambah</span>
            </button>
          )}
        </div>
      )}

      {/* Upload + Paste zone */}
      {count < MAX_IMAGES_PER_ITEM && (
        <div
          ref={pasteZoneRef}
          tabIndex={0}
          onFocus={() => setPasteActive(true)}
          onBlur={() => setPasteActive(false)}
          onPaste={handlePaste}
          onDrop={(e) => { e.preventDefault(); handleFileInput(e.dataTransfer.files) }}
          onDragOver={(e) => e.preventDefault()}
          className={`flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-xs transition-all cursor-default outline-none
            ${pasteActive
              ? "border-blue-400 bg-blue-50 text-blue-600 ring-2 ring-blue-200"
              : "border-gray-200 text-gray-400 hover:border-blue-300 hover:text-blue-500 hover:bg-blue-50/50"
            }`}
        >
          {uploading ? (
            <>
              <span className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin shrink-0" />
              <span>Mengupload...</span>
            </>
          ) : (
            <>
              <ImagePlus className="h-3.5 w-3.5 shrink-0" />
              <span>
                <button type="button" onClick={() => inputRef.current?.click()}
                  className="underline underline-offset-2 hover:text-blue-600">
                  Pilih file
                </button>
                {" · "}
                <button type="button" onClick={() => { pasteZoneRef.current?.focus() }}
                  className="underline underline-offset-2 hover:text-blue-600">
                  Klik sini lalu Ctrl+V
                </button>
                {" untuk paste screenshot"}
              </span>
            </>
          )}
        </div>
      )}

      {/* Counter + hint when active */}
      {count > 0 && (
        <p className="text-[10px] text-gray-400">
          {count}/{MAX_IMAGES_PER_ITEM} gambar · {getTotalSizeLabel(previews)}
        </p>
      )}
      {pasteActive && count < MAX_IMAGES_PER_ITEM && (
        <p className="text-[10px] text-blue-500 font-medium animate-pulse">
          ✓ Siap menerima paste — tekan Ctrl+V sekarang
        </p>
      )}

      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/jpg,image/webp"
        multiple className="hidden" onChange={(e) => handleFileInput(e.target.files)} />

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6"
          onClick={() => setLightbox(null)}
        >
          <div className="relative max-w-3xl max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={lightbox} alt="Preview" className="max-w-full max-h-[85vh] rounded-lg object-contain" />
            <button
              onClick={() => setLightbox(null)}
              className="absolute -top-3 -right-3 rounded-full bg-white text-gray-800 p-1.5 shadow-lg hover:bg-gray-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function WorkItemList({ items, onChange, onSaveTemplate }: WorkItemListProps) {
  const addItem = () => {
    onChange([...items, { id: generateId(), description: "", isEnhancing: false, imageKeys: [] }])
  }

  const updateItem = (id: string, patch: Partial<WorkItem>) => {
    onChange(items.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }

  const removeItem = (id: string) => {
    if (items.length <= 1) return
    // Delete associated images
    const item = items.find((i) => i.id === id)
    if (item?.imageKeys.length) {
      item.imageKeys.forEach((key) => deleteImage(key))
    }
    onChange(items.filter((item) => item.id !== id))
  }

  const enhanceItem = async (id: string) => {
    const item = items.find((i) => i.id === id)
    if (!item || item.description.trim().length < 5) return

    updateItem(id, { isEnhancing: true })

    try {
      const res = await fetch("/api/ai-enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: item.description }),
        signal: AbortSignal.timeout(15000),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Gagal memproses AI.")
      updateItem(id, { description: data.enhanced, isEnhancing: false })
      toast.success("Teks berhasil dirapikan oleh AI")
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.name === "TimeoutError"
            ? "Request AI timeout (15 detik). Coba lagi."
            : err.message
          : "Terjadi kesalahan."
      toast.error(msg)
      updateItem(id, { isEnhancing: false })
    }
  }

  return (
    <div className="space-y-3">
      {items.length === 0 && (
        <div className="rounded-xl border-2 border-dashed border-gray-100 py-12 text-center">
          <p className="text-sm text-gray-400">Belum ada item pekerjaan.</p>
        </div>
      )}

      {items.map((item, idx) => {
        const charCount = item.description.length
        const isNearLimit = charCount > MAX_DESC * 0.8
        const isAtLimit = charCount >= MAX_DESC
        const canEnhance = !item.isEnhancing && item.description.trim().length >= 5

        return (
          <div
            key={item.id}
            className="group rounded-xl bg-gray-50 border border-gray-100 hover:border-blue-100 hover:bg-blue-50/30 transition-all overflow-hidden"
          >
            {/* Number badge + textarea row */}
            <div className="flex gap-3 p-4">
              {/* Number */}
              <div className="flex flex-col items-center gap-1.5 shrink-0 pt-0.5">
                <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center">
                  <span className="text-xs font-bold text-blue-600">{idx + 1}</span>
                </div>
                <GripVertical className="h-3.5 w-3.5 text-gray-300 group-hover:text-gray-400 transition-colors" />
              </div>

              {/* Textarea */}
              <div className="flex-1 min-w-0 space-y-1">
                <Textarea
                  value={item.description}
                  onChange={(e) =>
                    updateItem(item.id, { description: e.target.value.slice(0, MAX_DESC) })
                  }
                  placeholder={`Deskripsikan pekerjaan ${idx + 1}...`}
                  rows={2}
                  maxLength={MAX_DESC}
                  className="resize-none text-sm border-0 bg-transparent p-0 focus-visible:ring-0 shadow-none placeholder:text-gray-300 leading-relaxed"
                  disabled={item.isEnhancing}
                />
                <span className={`text-[10px] tabular-nums float-right ${
                  isAtLimit ? "text-red-500 font-semibold" : isNearLimit ? "text-orange-400" : "text-gray-300"
                }`}>
                  {charCount}/{MAX_DESC}
                </span>
              </div>

              {/* Actions column */}
              <div className="flex flex-col gap-1 pt-0.5 shrink-0">
                <button
                  type="button"
                  onClick={() => enhanceItem(item.id)}
                  disabled={!canEnhance}
                  title="Rapikan dengan AI"
                  className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
                >
                  {item.isEnhancing ? (
                    <span className="h-3 w-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  ) : (
                    <Sparkles className="h-3 w-3" />
                  )}
                  <span className="hidden sm:inline">{item.isEnhancing ? "Proses" : "Rapikan"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => onSaveTemplate(item.description)}
                  disabled={!item.description.trim()}
                  title="Simpan sebagai template"
                  className="flex items-center justify-center rounded-lg p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <BookmarkPlus className="h-3.5 w-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  disabled={items.length <= 1}
                  title="Hapus item"
                  className="flex items-center justify-center rounded-lg p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Image section */}
            <div className="px-4 pb-4 pt-1 border-t border-gray-100/80 pl-14">
              <ItemImages
                item={item}
                onKeysChange={(keys) => updateItem(item.id, { imageKeys: keys })}
              />
            </div>
          </div>
        )
      })}

      <button
        type="button"
        onClick={addItem}
        className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 py-3.5 text-sm text-gray-500 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50/40 transition-all font-medium"
      >
        <Plus className="h-4 w-4" />
        Tambah Item Pekerjaan
      </button>
    </div>
  )
}
