"use client"

import { useRef, useState } from "react"
import { ImagePlus, X, ZoomIn } from "lucide-react"
import { storeImage, deleteImage, getTotalSizeLabel } from "@/lib/imageStorage"
import { toast } from "sonner"

const MAX_IMAGES = 10

interface ImageUploaderProps {
  imageKeys: string[]
  previewUrls: string[]
  onKeysChange: (keys: string[]) => void
}

export default function ImageUploader({
  imageKeys,
  previewUrls,
  onKeysChange,
}: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [previewing, setPreviewing] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return

    const remaining = MAX_IMAGES - imageKeys.length
    if (remaining <= 0) {
      toast.error(`Maksimal ${MAX_IMAGES} gambar`)
      return
    }

    setUploading(true)
    const newKeys: string[] = []

    for (const file of Array.from(files).slice(0, remaining)) {
      try {
        const key = await storeImage(file, imageKeys.length + newKeys.length)
        newKeys.push(key)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Gagal mengupload gambar"
        toast.error(msg)
      }
    }

    if (newKeys.length > 0) {
      onKeysChange([...imageKeys, ...newKeys])
    }
    setUploading(false)

    // Reset file input
    if (inputRef.current) inputRef.current.value = ""
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    handleFiles(e.dataTransfer.files)
  }

  const removeImage = async (idx: number) => {
    const key = imageKeys[idx]
    await deleteImage(key)
    onKeysChange(imageKeys.filter((_, i) => i !== idx))
  }

  const totalSizeLabel = getTotalSizeLabel(previewUrls)
  const count = imageKeys.length

  return (
    <div className="space-y-3">
      {/* Drop Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => !uploading && inputRef.current?.click()}
        className={`cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-all group ${
          uploading
            ? "border-blue-300 bg-blue-50 cursor-wait"
            : "border-gray-200 hover:border-blue-400 hover:bg-blue-50/40"
        }`}
      >
        <ImagePlus
          className={`h-8 w-8 mx-auto mb-2 transition-colors ${
            uploading ? "text-blue-400 animate-pulse" : "text-gray-300 group-hover:text-blue-400"
          }`}
        />
        <p className="text-sm font-medium text-gray-500 group-hover:text-blue-600">
          {uploading ? "Mengupload..." : "Klik atau drag & drop gambar"}
        </p>
        <p className="text-xs text-gray-400 mt-1">PNG, JPG, WEBP · Maks 2MB per gambar</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
          disabled={uploading}
        />
      </div>

      {/* Counter */}
      {count > 0 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
          <span>
            <span className={count >= MAX_IMAGES ? "text-orange-500 font-medium" : ""}>
              {count}/{MAX_IMAGES} gambar
            </span>
            {totalSizeLabel && <span className="ml-2 text-gray-400">· {totalSizeLabel}</span>}
          </span>
          <span className="text-gray-400">Akan masuk ke PDF sebagai lampiran</span>
        </div>
      )}

      {/* Thumbnails */}
      {previewUrls.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
          {previewUrls.map((src, idx) => (
            <div
              key={imageKeys[idx] ?? idx}
              className="group relative aspect-square rounded-lg overflow-hidden border border-gray-200 shadow-sm bg-gray-50"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`Screenshot ${idx + 1}`} className="w-full h-full object-cover" />
              {/* Overlay */}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewing(src)}
                  className="rounded-full bg-white/20 p-1.5 text-white hover:bg-white/40 transition-colors"
                  title="Preview"
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => removeImage(idx)}
                  className="rounded-full bg-white/20 p-1.5 text-white hover:bg-red-500/80 transition-colors"
                  title="Hapus"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <span className="absolute top-1 left-1 rounded-full bg-black/60 text-white text-[10px] px-1.5 py-0.5 font-mono">
                {idx + 1}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {previewing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6"
          onClick={() => setPreviewing(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewing}
              alt="Preview"
              className="max-w-full max-h-[85vh] rounded-lg object-contain"
            />
            <button
              onClick={() => setPreviewing(null)}
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
