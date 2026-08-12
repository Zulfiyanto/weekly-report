"use client"

import { useEffect, useRef, useState } from "react"
import { storeImage, deleteImage, loadImages, getTotalSizeLabel } from "@/lib/imageStorage"
import { ImagePlus, X, ZoomIn } from "lucide-react"
import { toast } from "sonner"

export const MAX_IMAGES_PER_ITEM = 5

interface ItemImagesProps {
  imageKeys: string[]
  onKeysChange: (keys: string[]) => void
  maxImages?: number
}

/** Pemilih gambar bukti per item: file picker, drag & drop, dan paste Ctrl+V. */
export default function ItemImages({
  imageKeys,
  onKeysChange,
  maxImages = MAX_IMAGES_PER_ITEM,
}: ItemImagesProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const pasteZoneRef = useRef<HTMLDivElement>(null)
  const [previews, setPreviews] = useState<string[]>([])
  const [lightbox, setLightbox] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [pasteActive, setPasteActive] = useState(false)

  useEffect(() => {
    if (imageKeys.length === 0) { setPreviews([]); return }
    loadImages(imageKeys).then(setPreviews)
  }, [imageKeys])

  const processFiles = async (files: File[]) => {
    if (files.length === 0) return
    const remaining = maxImages - imageKeys.length
    if (remaining <= 0) { toast.error(`Maksimal ${maxImages} gambar per item`); return }
    setUploading(true)
    const newKeys: string[] = []
    for (const file of files.slice(0, remaining)) {
      try {
        const key = await storeImage(file, imageKeys.length + newKeys.length)
        newKeys.push(key)
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Gagal upload gambar")
      }
    }
    if (newKeys.length > 0) onKeysChange([...imageKeys, ...newKeys])
    setUploading(false)
    if (inputRef.current) inputRef.current.value = ""
  }

  const handleFileInput = (files: FileList | null) => {
    if (files) processFiles(Array.from(files))
  }

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

  useEffect(() => {
    if (!pasteActive) return
    const handler = (e: ClipboardEvent) => handlePaste(e)
    window.addEventListener("paste", handler)
    return () => window.removeEventListener("paste", handler)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pasteActive, imageKeys])

  const removeImage = async (idx: number) => {
    await deleteImage(imageKeys[idx])
    onKeysChange(imageKeys.filter((_, i) => i !== idx))
  }

  const count = imageKeys.length

  return (
    <div className="mt-2 space-y-2">
      {previews.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {previews.map((src, idx) => (
            <div
              key={imageKeys[idx] ?? idx}
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

          {count < maxImages && (
            <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading}
              className="h-16 w-16 rounded-lg border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-0.5 text-gray-400 hover:border-blue-400 hover:text-blue-400 hover:bg-blue-50 transition-all shrink-0"
              title="Tambah gambar">
              <ImagePlus className="h-4 w-4" />
              <span className="text-[9px]">Tambah</span>
            </button>
          )}
        </div>
      )}

      {count < maxImages && (
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

      {count > 0 && (
        <p className="text-[10px] text-gray-400">
          {count}/{maxImages} gambar · {getTotalSizeLabel(previews)}
        </p>
      )}
      {pasteActive && count < maxImages && (
        <p className="text-[10px] text-blue-500 font-medium animate-pulse">
          ✓ Siap menerima paste — tekan Ctrl+V sekarang
        </p>
      )}

      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/jpg,image/webp"
        multiple className="hidden" onChange={(e) => handleFileInput(e.target.files)} />

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
