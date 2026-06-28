"use client"

import { useEffect, useRef, useState } from "react"
import type { WorkItem, WorkTag } from "@/lib/types"
import { parseMrText } from "@/lib/mrParser"
import { storeImage, deleteImage, loadImages } from "@/lib/imageStorage"
import { resolveLabelsToTags } from "@/lib/tags"
import { loadGitlabConfig } from "@/lib/storage"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  ClipboardPaste,
  Loader2,
  Plus,
  Sparkles,
  X,
  ImagePlus,
  Wand2,
} from "lucide-react"
import { toast } from "sonner"

const MAX_DESC = 2000
const MAX_TITLE = 80
const MAX_IMAGES = 5

function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

/** Ambil semua URL gambar dari potongan HTML clipboard. */
function extractImgSrcs(html: string): string[] {
  const out: string[] = []
  const re = /<img[^>]+src=["']([^"']+)["']/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    if (m[1]) out.push(m[1])
  }
  return out
}

/** Konversi data URL base64 menjadi File untuk dialirkan ke pipeline storeImage. */
function dataUrlToFile(dataUrl: string, filename: string): File {
  const [meta, b64] = dataUrl.split(",")
  const mime = meta.match(/:(.*?);/)?.[1] || "image/png"
  const bin = atob(b64)
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return new File([arr], filename, { type: mime })
}

interface MrPasteModalProps {
  open: boolean
  onClose: () => void
  allTags: WorkTag[]
  onTagsChange: (tags: WorkTag[]) => void
  onImport: (items: WorkItem[]) => void
}

// ── Rapikan deskripsi via route AI yang sudah ada ─────────────────────────────
async function enhanceText(text: string): Promise<string> {
  const res = await fetch("/api/ai-enhance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
    signal: AbortSignal.timeout(15000),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || "Gagal memproses AI")
  return data.enhanced as string
}

export default function MrPasteModal({
  open,
  onClose,
  allTags,
  onTagsChange,
  onImport,
}: MrPasteModalProps) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [imageKeys, setImageKeys] = useState<string[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [imageRefCount, setImageRefCount] = useState(0)
  const [suggestedLabels, setSuggestedLabels] = useState<string[]>([])
  const [aiEnabled, setAiEnabled] = useState(true)
  const [parsed, setParsed] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [fetchingImages, setFetchingImages] = useState(false)
  const [needGitlabConfig, setNeedGitlabConfig] = useState(false)
  const pasteRef = useRef<HTMLTextAreaElement>(null)

  // ── Reset saat dibuka ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return
    setTitle("")
    setDescription("")
    setImageKeys([])
    setPreviews([])
    setImageRefCount(0)
    setSuggestedLabels([])
    setAiEnabled(true)
    setParsed(false)
    setIsAdding(false)
    setUploading(false)
    setFetchingImages(false)
    setNeedGitlabConfig(false)
  }, [open])

  // ── Sinkronkan preview thumbnail dengan imageKeys ─────────────────────────
  useEffect(() => {
    if (imageKeys.length === 0) { setPreviews([]); return }
    loadImages(imageKeys).then(setPreviews)
  }, [imageKeys])

  const storeImageFiles = async (files: File[]) => {
    if (files.length === 0) return
    const remaining = MAX_IMAGES - imageKeys.length
    if (remaining <= 0) { toast.error(`Maksimal ${MAX_IMAGES} gambar`); return }
    setUploading(true)
    const newKeys: string[] = []
    for (const file of files.slice(0, remaining)) {
      try {
        const key = await storeImage(file, imageKeys.length + newKeys.length)
        newKeys.push(key)
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Gagal menyimpan gambar")
      }
    }
    if (newKeys.length > 0) setImageKeys((prev) => [...prev, ...newKeys])
    setUploading(false)
  }

  // ── Ambil gambar dari <img> di HTML clipboard ──────────────────────────────
  // Gambar inline (data URL) langsung disimpan; gambar di host GitLab diambil
  // lewat server pakai token tersimpan. Mengembalikan jumlah yang berhasil.
  const fetchHtmlImages = async (html: string): Promise<number> => {
    const srcs = extractImgSrcs(html)
    if (srcs.length === 0) return 0

    const cfg = loadGitlabConfig()
    setFetchingImages(true)
    const files: File[] = []
    let failed = 0
    let needConfig = false

    for (const src of srcs) {
      try {
        if (src.startsWith("data:")) {
          files.push(dataUrlToFile(src, `screenshot-${files.length + 1}.png`))
        } else if (cfg) {
          const res = await fetch("/api/gitlab/image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: cfg.url, token: cfg.token, imageUrl: src }),
          })
          const data = await res.json()
          if (res.ok && data.dataUrl) {
            files.push(dataUrlToFile(data.dataUrl, `screenshot-${files.length + 1}.png`))
          } else {
            failed++
          }
        } else {
          needConfig = true
        }
      } catch {
        failed++
      }
    }

    if (files.length > 0) await storeImageFiles(files)
    setFetchingImages(false)
    if (needConfig) setNeedGitlabConfig(true)
    if (files.length > 0) toast.success(`${files.length} screenshot otomatis terambil`)
    else if (failed > 0) toast.error(`${failed} screenshot gagal diambil otomatis`)
    return files.length
  }

  // ── Handle paste: ambil teks + gambar dari clipboard ──────────────────────
  const handlePaste = (e: React.ClipboardEvent) => {
    const cd = e.clipboardData
    if (!cd) return

    const html = cd.getData("text/html")

    // Gambar yang ikut ter-copy sebagai file (mis. copy satu gambar langsung)
    const imageFiles = Array.from(cd.items)
      .filter((it) => it.type.startsWith("image/"))
      .map((it) => it.getAsFile())
      .filter((f): f is File => f !== null)
    if (imageFiles.length > 0) storeImageFiles(imageFiles)

    // Teks: prioritaskan text/plain, fallback strip tag dari text/html
    let text = cd.getData("text/plain")
    if (!text && html) text = html.replace(/<[^>]+>/g, "\n")
    if (!text.trim() && !html) return

    e.preventDefault()

    const result = parseMrText(text)
    setTitle(result.title)
    setDescription(result.description)
    setSuggestedLabels(result.labels)
    setNeedGitlabConfig(false)
    setParsed(true)

    // Berapa screenshot yang terdeteksi (markdown ![](...) atau <img> di HTML)
    const htmlImgCount = html ? extractImgSrcs(html).length : 0
    setImageRefCount(Math.max(result.imageRefCount, htmlImgCount))
    toast.success("Isi MR berhasil dirapikan")

    // Coba ambil gambar dari <img> HTML secara otomatis
    if (html && htmlImgCount > 0) fetchHtmlImages(html)
  }

  const removeImage = async (idx: number) => {
    await deleteImage(imageKeys[idx])
    setImageKeys((prev) => prev.filter((_, i) => i !== idx))
  }

  // ── Tambahkan sebagai item pekerjaan ──────────────────────────────────────
  const handleAdd = async () => {
    if (!title.trim()) { toast.error("Judul belum terisi"); return }
    if (!description.trim()) { toast.error("Deskripsi belum terisi"); return }

    setIsAdding(true)
    try {
      let finalDesc = description.trim().slice(0, MAX_DESC)

      if (aiEnabled && finalDesc.length >= 5) {
        try {
          const enhanced = await enhanceText(finalDesc)
          if (enhanced?.trim()) finalDesc = enhanced.trim().slice(0, MAX_DESC)
        } catch (err: unknown) {
          toast.error(err instanceof Error ? err.message : "AI gagal, pakai teks asli")
        }
      }

      // Resolusi saran label -> tag
      let tagIds: string[] = []
      if (suggestedLabels.length > 0) {
        const { tags: updatedTags, tagIds: ids } = resolveLabelsToTags(suggestedLabels, allTags)
        if (updatedTags.length !== allTags.length) onTagsChange(updatedTags)
        tagIds = ids
      }

      const item: WorkItem = {
        id: generateId(),
        title: title.trim().slice(0, MAX_TITLE),
        description: finalDesc,
        isEnhancing: false,
        imageKeys,
        tags: tagIds,
      }
      onImport([item])
      toast.success("Item berhasil ditambahkan dari MR")
      onClose()
    } finally {
      setIsAdding(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <ClipboardPaste className="h-4 w-4 text-blue-600" />
            Tempel dari Merge Request
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Zona paste */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Tempel isi MR (judul + deskripsi + screenshot)
            </Label>
            <Textarea
              ref={pasteRef}
              autoFocus
              onPaste={handlePaste}
              placeholder="Klik di sini lalu Ctrl+V untuk menempel isi merge request dari GitLab..."
              rows={parsed ? 2 : 5}
              className="resize-none text-xs rounded-xl border-gray-200 bg-gray-50 focus:bg-white leading-relaxed"
            />
            <p className="text-[10px] text-gray-400">
              Judul, deskripsi, dan screenshot akan dipisah & dirapikan otomatis.
            </p>
          </div>

          {parsed && (
            <>
              {/* Judul */}
              <div className="space-y-1.5">
                <Label htmlFor="mr-title" className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Judul
                </Label>
                <Input
                  id="mr-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value.slice(0, MAX_TITLE))}
                  maxLength={MAX_TITLE}
                  placeholder="Judul task..."
                  className="h-10 rounded-xl border-gray-200 bg-gray-50"
                />
              </div>

              {/* Deskripsi */}
              <div className="space-y-1.5">
                <Label htmlFor="mr-desc" className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Deskripsi
                </Label>
                <Textarea
                  id="mr-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value.slice(0, MAX_DESC))}
                  maxLength={MAX_DESC}
                  rows={6}
                  className="resize-none text-sm rounded-xl border-gray-200 bg-gray-50 leading-relaxed"
                />
                <span className="text-[10px] tabular-nums text-gray-300 float-right">
                  {description.length}/{MAX_DESC}
                </span>
              </div>

              {/* Saran label */}
              {suggestedLabels.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-gray-400">Saran label:</span>
                  {suggestedLabels.map((l) => (
                    <span key={l} className="rounded-full bg-blue-50 border border-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-600">
                      {l}
                    </span>
                  ))}
                </div>
              )}

              {/* Screenshot */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Screenshot
                </Label>
                {previews.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {previews.map((src, idx) => (
                      <div key={imageKeys[idx] ?? idx} className="group relative h-16 w-16 rounded-lg overflow-hidden border border-gray-200 bg-gray-50 shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={src} alt={`Screenshot ${idx + 1}`} className="h-full w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removeImage(idx)}
                          className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {(uploading || fetchingImages) && (
                  <p className="flex items-center gap-1.5 text-[11px] text-gray-400">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {fetchingImages ? "Mengambil screenshot dari GitLab..." : "Menyimpan gambar..."}
                  </p>
                )}
                {!fetchingImages && imageRefCount > previews.length && (
                  <div className="flex items-start gap-1.5 rounded-lg bg-amber-50 border border-amber-100 px-3 py-2 text-[11px] text-amber-700">
                    <ImagePlus className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <span>
                      {imageRefCount - previews.length} screenshot belum terambil otomatis.{" "}
                      {needGitlabConfig
                        ? "Hubungkan akun di Pengaturan GitLab agar bisa diambil otomatis, atau salin gambarnya satu per satu lalu Ctrl+V di sini."
                        : "Salin gambarnya satu per satu lalu Ctrl+V di sini."}
                    </span>
                  </div>
                )}
                {previews.length === 0 && imageRefCount === 0 && !fetchingImages && (
                  <p className="text-[11px] text-gray-400">
                    Belum ada screenshot. Copy gambar dari GitLab lalu Ctrl+V di kotak tempel di atas.
                  </p>
                )}
              </div>

              {/* Toggle AI */}
              <label className="flex items-center gap-2 rounded-lg bg-violet-50 border border-violet-100 px-3 py-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={aiEnabled}
                  onChange={(e) => setAiEnabled(e.target.checked)}
                  className="h-4 w-4 accent-violet-600"
                />
                <Sparkles className="h-3.5 w-3.5 text-violet-600" />
                <span className="text-xs font-medium text-violet-700">
                  Rapikan deskripsi dengan AI saat ditambahkan
                </span>
              </label>

              {/* Tombol tambah */}
              <button
                type="button"
                onClick={handleAdd}
                disabled={isAdding}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 py-3 text-white font-semibold text-sm shadow-lg hover:bg-blue-800 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
              >
                {isAdding ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Memproses...</>
                ) : (
                  <><Plus className="h-4 w-4" />Tambahkan sebagai item</>
                )}
              </button>
            </>
          )}

          {!parsed && (
            <div className="flex flex-col items-center gap-2 py-4 text-center text-gray-300">
              <Wand2 className="h-7 w-7" />
              <p className="text-xs">Hasil rapi akan muncul di sini setelah kamu menempel.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
