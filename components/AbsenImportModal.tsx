"use client"

import { useMemo, useState } from "react"
import { format } from "date-fns"
import { id as localeId } from "date-fns/locale"
import {
  parseAbsenText,
  getLemburPeriod,
  isInPeriod,
  type AbsenEntry,
} from "@/lib/absenParser"
import { saveAbsenText, loadAbsenText, clearAbsenText } from "@/lib/storage"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  CalendarClock,
  ListChecks,
  Pencil,
  Trash2,
  Inbox,
  AlertCircle,
} from "lucide-react"
import { toast } from "sonner"

export const MAX_TANGGAL = 10

const CONTOH = `12-08-2026\t08:19\t20:16\tHadir
11-08-2026\t08:11\t20:21\tHadir
10-08-2026\t08:14\t20:13\tHadir`

interface AbsenImportModalProps {
  open: boolean
  onClose: () => void
  /** Tanggal dokumen — dipakai menentukan periode lembur yang sedang berjalan. */
  tanggalDokumen: string
  onPick: (entries: AbsenEntry[]) => void
}

function labelTanggal(tanggal: string): { hari: string; tanggalPanjang: string; weekend: boolean } {
  const d = new Date(`${tanggal}T00:00:00`)
  const dow = d.getDay()
  return {
    hari: format(d, "EEEE", { locale: localeId }),
    tanggalPanjang: format(d, "d MMMM yyyy", { locale: localeId }),
    weekend: dow === 0 || dow === 6,
  }
}

export default function AbsenImportModal({
  open,
  onClose,
  tanggalDokumen,
  onPick,
}: AbsenImportModalProps) {
  const [text, setText] = useState("")
  const [entries, setEntries] = useState<AbsenEntry[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState(true)

  const period = useMemo(() => getLemburPeriod(tanggalDokumen || new Date()), [tanggalDokumen])
  const periodLabel = useMemo(() => {
    const f = (s: string) => format(new Date(`${s}T00:00:00`), "d MMM yyyy", { locale: localeId })
    return `${f(period.start)} – ${f(period.end)}`
  }, [period])

  // Muat daftar tersimpan pada rising edge `open`
  // (menyesuaikan state saat render, bukan lewat effect — pola yang sama
  // dipakai GitlabSettings.tsx).
  const [wasOpen, setWasOpen] = useState(false)
  if (open && !wasOpen) {
    setWasOpen(true)
    const saved = loadAbsenText()
    const parsed = saved.trim() ? parseAbsenText(saved).entries : []
    setText(saved)
    setSelected(new Set())
    setEntries(parsed)
    setEditing(parsed.length === 0)
  } else if (!open && wasOpen) {
    setWasOpen(false)
  }

  const handleProses = () => {
    const { entries: parsed, skipped, duplicates } = parseAbsenText(text)
    if (parsed.length === 0) {
      toast.error("Tidak ada tanggal yang bisa dibaca dari teks itu")
      return
    }
    setEntries(parsed)
    setSelected(new Set())
    setEditing(false)
    saveAbsenText(text)

    const catatan: string[] = []
    if (skipped > 0) catatan.push(`${skipped} baris dilewati`)
    if (duplicates > 0) catatan.push(`${duplicates} tanggal duplikat dibuang`)
    toast.success(
      `${parsed.length} tanggal terbaca` + (catatan.length ? ` (${catatan.join(", ")})` : "")
    )
  }

  const toggle = (tanggal: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(tanggal)) {
        next.delete(tanggal)
      } else {
        if (next.size >= MAX_TANGGAL) {
          toast.error(`Maksimal ${MAX_TANGGAL} tanggal`)
          return prev
        }
        next.add(tanggal)
      }
      return next
    })
  }

  const pilihDalamPeriode = () => {
    const kandidat = entries.filter((e) => isInPeriod(e.tanggal, period))
    setSelected(new Set(kandidat.slice(0, MAX_TANGGAL).map((e) => e.tanggal)))
  }

  const handleGunakan = () => {
    const picked = entries.filter((e) => selected.has(e.tanggal))
    if (picked.length === 0) {
      toast.error("Pilih setidaknya satu tanggal")
      return
    }
    onPick(picked)
    toast.success(`${picked.length} tanggal dimasukkan ke uraian kegiatan`)
    onClose()
  }

  const handleHapusDaftar = () => {
    clearAbsenText()
    setText("")
    setEntries([])
    setSelected(new Set())
    setEditing(true)
    toast.success("Daftar absen dihapus")
  }

  const jumlahDalamPeriode = entries.filter((e) => isInPeriod(e.tanggal, period)).length

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <CalendarClock className="h-4 w-4 text-blue-600" />
            Pilih Tanggal dari Daftar Absen
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-[11px] text-blue-700">
            Periode lembur: <span className="font-semibold">{periodLabel}</span>
            {" · "}Maksimal {MAX_TANGGAL} tanggal
          </p>

          {editing ? (
            <>
              <div className="space-y-1.5">
                <label
                  htmlFor="absen-text"
                  className="text-[11px] font-semibold uppercase tracking-wide text-gray-500"
                >
                  Tempel daftar absen
                </label>
                <textarea
                  id="absen-text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={9}
                  spellCheck={false}
                  className="w-full resize-y rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-xs leading-relaxed text-gray-700 outline-none transition-colors focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
                />
                <p className="text-[10px] leading-relaxed text-gray-400">
                  Satu baris per tanggal — tanggal, jam masuk, jam pulang, status. Contoh:
                  <br />
                  <span className="font-mono text-gray-500">
                    {CONTOH.split("\n")[0].replace(/\t/g, "    ")}
                  </span>
                </p>
              </div>

              <button
                type="button"
                onClick={handleProses}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:bg-blue-800"
              >
                <ListChecks className="h-4 w-4" />
                Proses Daftar
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-gray-500">
                  <span className="font-semibold text-gray-700">{selected.size}</span>/{MAX_TANGGAL} tanggal dipilih
                  {jumlahDalamPeriode > 0 && (
                    <span className="text-gray-400"> · {jumlahDalamPeriode} dalam periode</span>
                  )}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={pilihDalamPeriode}
                    className="rounded-lg px-2 py-1 text-[11px] font-medium text-blue-600 transition-colors hover:bg-blue-50"
                  >
                    Pilih dalam periode
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelected(new Set())}
                    className="rounded-lg px-2 py-1 text-[11px] font-medium text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-600"
                  >
                    Kosongkan
                  </button>
                </div>
              </div>

              {entries.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-6 text-center text-gray-400">
                  <Inbox className="h-7 w-7" />
                  <p className="text-sm">Belum ada tanggal.</p>
                </div>
              ) : (
                <div className="max-h-80 space-y-1.5 overflow-y-auto pr-1">
                  {entries.map((e) => {
                    const { hari, tanggalPanjang, weekend } = labelTanggal(e.tanggal)
                    const isSel = selected.has(e.tanggal)
                    const luar = !isInPeriod(e.tanggal, period)
                    const penuh = !isSel && selected.size >= MAX_TANGGAL
                    return (
                      <label
                        key={e.tanggal}
                        className={`flex items-center gap-2.5 rounded-lg border p-2.5 transition-colors ${
                          isSel
                            ? "border-blue-300 bg-blue-50/60"
                            : penuh
                              ? "cursor-not-allowed border-gray-100 opacity-50"
                              : "cursor-pointer border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSel}
                          disabled={penuh}
                          onChange={() => toggle(e.tanggal)}
                          className="h-4 w-4 shrink-0 accent-blue-600"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-2">
                            <span className="text-sm font-medium text-gray-800">
                              {tanggalPanjang}
                            </span>
                            <span
                              className={`text-[11px] ${weekend ? "font-semibold text-amber-600" : "text-gray-400"}`}
                            >
                              {hari}
                            </span>
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-gray-400">
                            <span className="font-mono text-gray-600">
                              {e.jamMasuk || "--:--"} – {e.jamKeluar || "--:--"}
                            </span>
                            {e.status && <span>· {e.status}</span>}
                            {luar && (
                              <span className="inline-flex items-center gap-0.5 rounded-full bg-orange-50 px-1.5 py-0.5 font-medium text-orange-600">
                                <AlertCircle className="h-2.5 w-2.5" /> di luar periode
                              </span>
                            )}
                          </div>
                        </div>
                      </label>
                    )
                  })}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm font-medium text-gray-600 shadow-sm transition-all hover:bg-gray-50"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Ubah daftar
                </button>
                <button
                  type="button"
                  onClick={handleHapusDaftar}
                  title="Hapus daftar absen tersimpan"
                  className="flex items-center justify-center rounded-xl border border-gray-200 bg-white px-3 text-gray-400 shadow-sm transition-all hover:bg-red-50 hover:text-red-500"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={handleGunakan}
                  disabled={selected.size === 0}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-700 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <ListChecks className="h-4 w-4" />
                  Gunakan {selected.size} tanggal
                </button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
