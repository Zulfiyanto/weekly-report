"use client"

import { useEffect, useRef, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { PenLine, Eraser, Check, Upload } from "lucide-react"
import { toast } from "sonner"

/** Resolusi internal kanvas — cukup tinggi agar tanda tangan tetap tajam di PDF. */
const W = 900
const H = 300
const STROKE = 3.5
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024

interface SignaturePadProps {
  open: boolean
  onClose: () => void
  title: string
  /** Tanda tangan yang sudah ada — dipakai sebagai titik awal (hanya ditampilkan). */
  initial?: string
  onSave: (dataUrl: string) => void
}

/**
 * Potong area transparan di sekeliling coretan supaya tanda tangan tidak
 * mengambang di tengah kotak kosong saat ditempel ke PDF.
 */
function cropTransparan(canvas: HTMLCanvasElement): string | null {
  const ctx = canvas.getContext("2d")
  if (!ctx) return null
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)

  let minX = canvas.width
  let minY = canvas.height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      if (data[(y * canvas.width + x) * 4 + 3] > 8) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) return null // kanvas kosong

  const pad = 8
  minX = Math.max(0, minX - pad)
  minY = Math.max(0, minY - pad)
  maxX = Math.min(canvas.width - 1, maxX + pad)
  maxY = Math.min(canvas.height - 1, maxY + pad)

  const out = document.createElement("canvas")
  out.width = maxX - minX + 1
  out.height = maxY - minY + 1
  const octx = out.getContext("2d")
  if (!octx) return null
  octx.drawImage(canvas, minX, minY, out.width, out.height, 0, 0, out.width, out.height)
  return out.toDataURL("image/png")
}

export default function SignaturePad({
  open,
  onClose,
  title,
  initial,
  onSave,
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const drawing = useRef(false)
  const [kosong, setKosong] = useState(true)

  // Tandai kanvas kosong pada rising edge `open` (menyesuaikan state saat render,
  // pola yang sama dipakai GitlabSettings.tsx dan AbsenImportModal.tsx).
  const [wasOpen, setWasOpen] = useState(false)
  if (open && !wasOpen) {
    setWasOpen(true)
    setKosong(true)
  } else if (!open && wasOpen) {
    setWasOpen(false)
  }

  // Kanvas baru dipasang setelah dialog terpasang — siapkan konteks gambarnya.
  useEffect(() => {
    if (!open) return
    const ctx = canvasRef.current?.getContext("2d")
    if (!ctx) return
    ctx.clearRect(0, 0, W, H)
    ctx.lineWidth = STROKE
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.strokeStyle = "#111827"
  }, [open])

  const posisi = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current!
    const r = c.getBoundingClientRect()
    return {
      x: ((e.clientX - r.left) / r.width) * W,
      y: ((e.clientY - r.top) / r.height) * H,
    }
  }

  const mulai = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current
    const ctx = c?.getContext("2d")
    if (!c || !ctx) return
    c.setPointerCapture(e.pointerId)
    drawing.current = true
    const { x, y } = posisi(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
    // Titik tunggal agar ketukan singkat tetap membekas
    ctx.lineTo(x + 0.01, y)
    ctx.stroke()
    setKosong(false)
  }

  const gerak = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return
    const ctx = canvasRef.current?.getContext("2d")
    if (!ctx) return
    const { x, y } = posisi(e)
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  const selesai = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return
    drawing.current = false
    canvasRef.current?.releasePointerCapture(e.pointerId)
  }

  const bersihkan = () => {
    const ctx = canvasRef.current?.getContext("2d")
    if (!ctx) return
    ctx.clearRect(0, 0, W, H)
    setKosong(true)
  }

  const simpan = () => {
    const c = canvasRef.current
    if (!c) return
    const dataUrl = cropTransparan(c)
    if (!dataUrl) {
      toast.error("Tanda tangan masih kosong")
      return
    }
    onSave(dataUrl)
    toast.success("Tanda tangan disimpan")
    onClose()
  }

  const unggah = (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast.error("Berkas harus berupa gambar")
      return
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error("Ukuran gambar melebihi 2MB")
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      onSave(reader.result as string)
      toast.success("Tanda tangan diunggah")
      onClose()
    }
    reader.onerror = () => toast.error("Gagal membaca berkas")
    reader.readAsDataURL(file)
    if (fileRef.current) fileRef.current.value = ""
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <PenLine className="h-4 w-4 text-blue-600" />
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {initial && (
            <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
              <span className="shrink-0 text-[11px] font-medium text-gray-500">Saat ini</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={initial} alt="Tanda tangan saat ini" className="h-10 object-contain" />
            </div>
          )}

          <div className="relative">
            <canvas
              ref={canvasRef}
              width={W}
              height={H}
              onPointerDown={mulai}
              onPointerMove={gerak}
              onPointerUp={selesai}
              onPointerLeave={selesai}
              className="h-44 w-full touch-none rounded-xl border-2 border-dashed border-gray-300 bg-white"
            />
            {kosong && (
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-gray-300">
                Gambar tanda tangan Anda di sini
              </span>
            )}
            {/* Garis bantu */}
            <span className="pointer-events-none absolute bottom-8 left-8 right-8 border-b border-gray-200" />
          </div>

          <p className="text-[10px] leading-relaxed text-gray-400">
            Gambar pakai mouse, layar sentuh, atau pen. Latar belakangnya transparan, jadi
            menempel rapi di dokumen.
          </p>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={bersihkan}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm font-medium text-gray-600 shadow-sm transition-all hover:bg-gray-50"
            >
              <Eraser className="h-3.5 w-3.5" />
              Bersihkan
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              title="Unggah gambar tanda tangan (PNG transparan disarankan)"
              className="flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm font-medium text-gray-600 shadow-sm transition-all hover:bg-gray-50"
            >
              <Upload className="h-3.5 w-3.5" />
              Unggah
            </button>
            <button
              type="button"
              onClick={simpan}
              disabled={kosong}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-700 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Check className="h-4 w-4" />
              Simpan Tanda Tangan
            </button>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => unggah(e.target.files?.[0])}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
