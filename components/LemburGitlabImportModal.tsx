"use client"

import { useEffect, useMemo, useState } from "react"
import { format } from "date-fns"
import { id as localeId } from "date-fns/locale"
import type { GitlabMR, LemburItem, LemburLokasi } from "@/lib/types"
import { loadGitlabConfig } from "@/lib/storage"
import { extractImageRefs } from "@/lib/gitlabImages"
import {
  fetchMergeRequests,
  processMr,
  potongRapi,
  rapikanJudulMr,
  MAX_IMAGES_PER_ITEM,
} from "@/lib/gitlabImport"
import { markdownToPlainText } from "@/lib/markdown"
import {
  matchByDate,
  bagikanSisa,
  DEFAULT_TOLERANCE_DAYS,
  type MatchTarget,
} from "@/lib/mrMatching"
import { generateLemburItemId } from "./LemburItemList"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  GitlabIcon,
  Loader2,
  Download,
  Sparkles,
  Settings,
  ExternalLink,
  Inbox,
  ImageIcon,
  CornerDownRight,
} from "lucide-react"
import { toast } from "sonner"

/** Sel Uraian Kegiatan sempit, jadi dijaga pendek. */
const MAX_URAIAN = 160
/** Kolom Keterangan tabel evidence lebih lega — boleh beberapa kalimat. */
const MAX_KETERANGAN = 320

/** Perapi khusus laporan lembur — bukan /api/ai-enhance milik laporan mingguan. */
async function rapikanLembur(
  text: string,
  pekerjaan: string
): Promise<{ description: string; keterangan?: string }> {
  // Mengimpor belasan MR sekaligus gampang kena rate limit; sekali ulang cukup
  // menyelamatkan sebagian besar kasus.
  for (let percobaan = 0; ; percobaan++) {
    const res = await fetch("/api/ai-lembur", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "mr", text, pekerjaan }),
      signal: AbortSignal.timeout(25000),
    })
    const data = await res.json()
    if (res.ok) {
      return { description: data.uraian as string, keterangan: data.keterangan as string }
    }
    if (res.status === 429 && percobaan === 0) {
      await new Promise((r) => setTimeout(r, 2500))
      continue
    }
    throw new Error(data.error || "Gagal memproses AI")
  }
}

/** Perubahan yang diterapkan ke satu baris lembur yang sudah ada. */
export interface LemburFillPatch {
  id: string
  uraian: string
  keterangan: string
  imageKeys: string[]
}

interface LemburGitlabImportModalProps {
  open: boolean
  onClose: () => void
  defaultJamMulai: string
  defaultJamSelesai: string
  defaultLokasi: LemburLokasi | ""
  /** Nama pekerjaan/proyek — konteks untuk perapi AI. */
  namaPekerjaan: string
  /** Baris lembur yang sudah punya tanggal — jadi tujuan pencocokan MR. */
  targets: MatchTarget[]
  /** Mode isi: MR mengisi uraian baris yang sudah ada. */
  onFill: (patches: LemburFillPatch[]) => void
  /** Mode buat: dipakai bila belum ada baris bertanggal. */
  onImport: (items: LemburItem[]) => void
  onOpenSettings: () => void
}

/** Berapa kegiatan yang ditulis penuh saat beberapa MR jatuh di hari yang sama. */
const MAKS_GABUNG_URAIAN = 2
const MAKS_GABUNG_KETERANGAN = 3

/**
 * Gabung beberapa teks jadi satu sel tabel: buang duplikat, ambil paling banyak
 * `maksItem`, sisanya diringkas jadi "dll." supaya sel tidak meledak.
 */
function gabung(teks: string[], maksHuruf: number, maksItem: number, pemisah = "; "): string {
  const unik: string[] = []
  for (const t of teks) {
    const bersih = t.trim()
    if (!bersih) continue
    if (unik.some((u) => u.toLowerCase() === bersih.toLowerCase())) continue
    unik.push(bersih)
  }
  if (unik.length === 0) return ""
  const dipakai = unik.slice(0, maksItem)
  const sisa = unik.length - dipakai.length
  const hasil = dipakai.join(pemisah) + (sisa > 0 ? ` dll.` : "")
  return potongRapi(hasil, maksHuruf)
}

/** Berapa gambar yang dirujuk deskripsi sebuah MR. */
function jumlahGambar(mr: GitlabMR): number {
  return extractImageRefs(mr.description || "").length
}

/**
 * Urutkan MR dalam satu hari: yang punya screenshot didahulukan, lalu yang
 * gambarnya lebih banyak, baru urut tanggal. Karena teks dibatasi beberapa item
 * saja, ini memastikan yang tertulis adalah MR yang benar-benar ada buktinya.
 */
function utamakanBergambar(list: GitlabMR[]): GitlabMR[] {
  return [...list].sort((a, b) => {
    const ga = jumlahGambar(a)
    const gb = jumlahGambar(b)
    if (ga !== gb) return gb - ga
    return (a.mergedAt || "").localeCompare(b.mergedAt || "")
  })
}

/**
 * Teks uraian untuk satu MR. Bila AI diaktifkan tapi gagal, pakai judul MR —
 * jangan deskripsi mentahnya, karena isinya teks teknis panjang.
 */
function teksUraian(
  p: { description?: string; enhanced?: boolean } | undefined,
  mr: GitlabMR,
  ringkas: (s: string) => string
): string {
  if (p?.enhanced && p.description?.trim()) return ringkas(p.description)
  return ringkas(rapikanJudulMr(mr.title))
}

function tglPendek(tanggal: string): string {
  if (!tanggal) return "-"
  try {
    return format(new Date(`${tanggal}T00:00:00`), "d MMM", { locale: localeId })
  } catch {
    return tanggal
  }
}

export default function LemburGitlabImportModal({
  open,
  onClose,
  defaultJamMulai,
  defaultJamSelesai,
  defaultLokasi,
  namaPekerjaan,
  targets,
  onFill,
  onImport,
  onOpenSettings,
}: LemburGitlabImportModalProps) {
  const [hasConfig, setHasConfig] = useState(false)
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [mrs, setMrs] = useState<GitlabMR[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [aiEnabled, setAiEnabled] = useState(true)
  const [imagesEnabled, setImagesEnabled] = useState(true)
  const [toleransi, setToleransi] = useState(DEFAULT_TOLERANCE_DAYS)
  const [isFetching, setIsFetching] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [progress, setProgress] = useState("")
  const [fetched, setFetched] = useState(false)

  /** Ada baris bertanggal → MR mengisi baris itu, bukan bikin baris baru. */
  const modeIsi = targets.length > 0

  // ── Reset state on open ──────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return
    setHasConfig(loadGitlabConfig() !== null)
    setMrs([])
    setSelected(new Set())
    setFetched(false)
    setProgress("")
    // Seed rentang tanggal dari baris lembur yang ada, dilebarkan sesuai toleransi
    if (targets.length > 0) {
      const urut = targets.map((t) => t.tanggal).sort()
      // Format dari komponen lokal, bukan toISOString() — toISOString() menggeser
      // tanggal satu hari untuk zona waktu di timur UTC.
      const geser = (iso: string, hari: number) => {
        const d = new Date(`${iso}T00:00:00`)
        d.setDate(d.getDate() + hari)
        const p = (n: number) => String(n).padStart(2, "0")
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
      }
      setDateFrom(geser(urut[0], -toleransi))
      setDateTo(geser(urut[urut.length - 1], toleransi))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // ── Pencocokan MR terpilih ke baris lembur ────────────────────────────────
  const chosen = useMemo(() => mrs.filter((mr) => selected.has(mr.id)), [mrs, selected])

  const match = useMemo(
    () => matchByDate(chosen, (mr) => (mr.mergedAt ? mr.mergedAt.slice(0, 10) : ""), targets, toleransi),
    [chosen, targets, toleransi]
  )

  /**
   * MR yang tidak dapat pasangan tanggal dibagikan ke baris yang masih kosong —
   * mengabaikan kedekatan tanggal — supaya tidak ada baris yang tertinggal kosong.
   */
  const sebaran = useMemo(
    () =>
      bagikanSisa(match.perTarget, targets, match.unmatched, (a, b) => {
        const ga = jumlahGambar(a)
        const gb = jumlahGambar(b)
        if (ga !== gb) return gb - ga
        return (a.mergedAt || "").localeCompare(b.mergedAt || "")
      }),
    [match, targets]
  )

  /** mrId → tanggal baris tujuan, untuk badge di daftar MR. */
  const tujuanPerMr = useMemo(() => {
    const peta = new Map<number, { tanggal: string; dariSisa: boolean } | null>()
    for (const [targetId, list] of sebaran.perTarget) {
      const t = targets.find((x) => x.id === targetId)
      if (!t) continue
      for (const mr of list) {
        peta.set(mr.id, { tanggal: t.tanggal, dariSisa: sebaran.dariSisa.has(targetId) })
      }
    }
    for (const mr of sebaran.belumTerpakai) peta.set(mr.id, null)
    return peta
  }, [sebaran, targets])

  const barisTerisi = sebaran.perTarget.size
  const barisDariSisa = sebaran.dariSisa.size
  const jumlahBergambar = useMemo(() => mrs.filter((mr) => jumlahGambar(mr) > 0).length, [mrs])

  const handleFetch = async () => {
    const cfg = loadGitlabConfig()
    if (!cfg) {
      setHasConfig(false)
      return
    }
    if (!dateFrom || !dateTo) {
      toast.error("Isi rentang tanggal terlebih dahulu")
      return
    }

    setIsFetching(true)
    setFetched(false)
    try {
      const list = await fetchMergeRequests(cfg, dateFrom, dateTo)
      setMrs(list)
      setSelected(new Set(list.map((mr) => mr.id)))
      setFetched(true)
      if (list.length === 0) {
        toast.info("Tidak ada MR yang merged dalam periode ini")
      } else {
        toast.success(`${list.length} merge request ditemukan`)
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal mengambil merge request")
    } finally {
      setIsFetching(false)
    }
  }

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleApply = async () => {
    if (chosen.length === 0) {
      toast.error("Pilih setidaknya satu merge request")
      return
    }
    const cfg = loadGitlabConfig()
    if (!cfg) {
      setHasConfig(false)
      return
    }
    if (modeIsi && barisTerisi === 0) {
      toast.error("Tidak ada MR yang cocok dengan tanggal baris lembur — perlebar toleransi hari")
      return
    }

    setIsImporting(true)
    let totalImages = 0
    let failedImages = 0
    let gagalAi = 0

    // MR yang benar-benar diproses: pada mode isi, semua yang dapat baris tujuan —
    // baik lewat kedekatan tanggal maupun hasil pembagian sisa
    const diproses = modeIsi
      ? [...sebaran.perTarget.values()].flat()
      : chosen

    try {
      const hasil = new Map<number, Awaited<ReturnType<typeof processMr>>>()
      for (let i = 0; i < diproses.length; i++) {
        const mr = diproses[i]
        const processed = await processMr(cfg, mr, {
          aiEnabled,
          imagesEnabled,
          tags: [], // dokumen lembur tidak memakai tag
          enhance: (teks) => rapikanLembur(teks, namaPekerjaan),
          onProgress: (step) =>
            setProgress(
              step === "ai"
                ? `Merapikan dengan AI ${i + 1}/${diproses.length}...`
                : `Mengambil screenshot MR ${i + 1}/${diproses.length}...`
            ),
        })
        hasil.set(mr.id, processed)
        totalImages += processed.imageKeys.length
        failedImages += processed.failedImages
        if (aiEnabled && !processed.enhanced) gagalAi++
      }

      // Sel tabel PDF hanya menampung teks polos satu paragraf — buang markdown
      // (judul ##, **tebal**, backtick, bullet) lalu ratakan jadi satu baris.
      const ringkas = (teks: string) =>
        markdownToPlainText(teks)
          .replace(/^[-*]\s+/gm, "")
          .replace(/\s*\n+\s*/g, " ")
          .replace(/\s{2,}/g, " ")
          .trim()

      if (modeIsi) {
        const patches: LemburFillPatch[] = []
        for (const [targetId, listAsli] of sebaran.perTarget) {
          // MR yang punya screenshot didahulukan agar teks yang tertulis nyambung
          // dengan bukti yang benar-benar tampil di tabel evidence
          const list = utamakanBergambar(listAsli)
          const uraian = gabung(
            list.map((mr) => teksUraian(hasil.get(mr.id), mr, ringkas)),
            MAX_URAIAN,
            MAKS_GABUNG_URAIAN
          )
          const keterangan = gabung(
            list
              .filter((mr) => (hasil.get(mr.id)?.imageKeys.length ?? 0) > 0)
              .map((mr) => ringkas(hasil.get(mr.id)?.keterangan || rapikanJudulMr(mr.title)))
              .concat(
                // Bila tidak satu pun MR menghasilkan screenshot, tetap beri keterangan
                list.some((mr) => (hasil.get(mr.id)?.imageKeys.length ?? 0) > 0)
                  ? []
                  : list.map((mr) => ringkas(hasil.get(mr.id)?.keterangan || rapikanJudulMr(mr.title)))
              ),
            MAX_KETERANGAN,
            MAKS_GABUNG_KETERANGAN,
            " "
          )
          const imageKeys = list.flatMap((mr) => hasil.get(mr.id)?.imageKeys ?? [])
          patches.push({ id: targetId, uraian, keterangan, imageKeys })
        }
        onFill(patches)
        toast.success(
          `${diproses.length} MR mengisi ${patches.length} baris lembur` +
            (barisDariSisa > 0 ? ` (${barisDariSisa} dari MR sisa)` : "") +
            (totalImages > 0 ? ` · ${totalImages} screenshot` : "")
        )
        if (sebaran.belumTerpakai.length > 0) {
          toast.info(
            `${sebaran.belumTerpakai.length} MR tidak terpakai — semua baris lembur sudah terisi`
          )
        }
      } else {
        const newItems: LemburItem[] = diproses.map((mr) => {
          const p = hasil.get(mr.id)
          return {
            id: generateLemburItemId(),
            uraian: potongRapi(teksUraian(p, mr, ringkas), MAX_URAIAN),
            tanggal: mr.mergedAt ? mr.mergedAt.slice(0, 10) : "",
            jamMulai: defaultJamMulai,
            jamSelesai: defaultJamSelesai,
            lokasi: defaultLokasi,
            keterangan: potongRapi(
              ringkas(p?.keterangan || rapikanJudulMr(mr.title)),
              MAX_KETERANGAN
            ),
            imageKeys: p?.imageKeys ?? [],
          }
        })
        onImport(newItems)
        toast.success(
          `${newItems.length} baris kegiatan di-import dari GitLab` +
            (totalImages > 0 ? ` (${totalImages} screenshot)` : "")
        )
      }

      if (gagalAi > 0) {
        toast.warning(
          `${gagalAi} MR gagal dirapikan AI — judul MR-nya dipakai apa adanya. Coba ulangi beberapa saat lagi.`
        )
      }
      if (failedImages > 0) {
        toast.warning(`${failedImages} screenshot gagal diambil — cek token/akses GitLab`)
      }
      onClose()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal memproses merge request")
    } finally {
      setIsImporting(false)
      setProgress("")
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <GitlabIcon className="h-4 w-4 text-orange-600" />
            {modeIsi ? "Isi Uraian dari GitLab" : "Import Kegiatan dari GitLab"}
          </DialogTitle>
        </DialogHeader>

        {!hasConfig ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <Settings className="h-8 w-8 text-gray-300" />
            <p className="text-sm text-gray-500">Koneksi GitLab belum dikonfigurasi.</p>
            <button
              type="button"
              onClick={() => {
                onClose()
                onOpenSettings()
              }}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
            >
              <Settings className="h-4 w-4" />
              Buka Pengaturan GitLab
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-[11px] leading-relaxed text-blue-700">
              {modeIsi ? (
                <>
                  Ada <span className="font-semibold">{targets.length} baris lembur</span> bertanggal.
                  Tiap MR mengisi uraian baris yang tanggalnya paling dekat dengan tanggal merge. Baris
                  yang tidak kebagian akan diisi dari MR sisa tanpa melihat tanggal, supaya tidak ada
                  baris yang kosong. Tanggal dan jam baris tidak diubah.
                </>
              ) : (
                <>
                  Belum ada baris lembur bertanggal, jadi tiap MR akan jadi baris baru dengan tanggal
                  dari tanggal merge-nya. Pilih tanggal dari daftar absen dulu bila ingin MR mengisi
                  baris yang sudah ada.
                </>
              )}
            </p>

            {/* Dua kolom di layar lebar: pengaturan di kiri, daftar MR di kanan.
                Ditumpuk vertikal di layar sempit. */}
            <div className="grid gap-4 md:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] md:items-start">
              {/* ── Kolom kiri: pengaturan ── */}
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2 md:grid-cols-1">
                  <div className="space-y-1.5">
                    <Label htmlFor="lbr-gl-from" className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Merged dari
                    </Label>
                    <Input
                      id="lbr-gl-from"
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="h-10 rounded-xl border-gray-200 bg-gray-50"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="lbr-gl-to" className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Merged sampai
                    </Label>
                    <Input
                      id="lbr-gl-to"
                      type="date"
                      value={dateTo}
                      min={dateFrom}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="h-10 rounded-xl border-gray-200 bg-gray-50"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleFetch}
                  disabled={isFetching}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-orange-200 bg-orange-50 py-2.5 text-sm font-semibold text-orange-700 transition-colors hover:bg-orange-100 disabled:opacity-60"
                >
                  {isFetching ? (
                    <><Loader2 className="h-4 w-4 animate-spin" />Mengambil MR...</>
                  ) : (
                    <><GitlabIcon className="h-4 w-4" />Ambil Merge Request</>
                  )}
                </button>

                {mrs.length > 0 && (
                  <>
                    {modeIsi && (
                      <div className="space-y-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
                        <label className="flex items-center gap-2 text-[11px] font-medium text-gray-600">
                          Toleransi
                          <input
                            type="number"
                            min={0}
                            max={30}
                            value={toleransi}
                            onChange={(e) =>
                              setToleransi(Math.max(0, Math.min(30, Number(e.target.value) || 0)))
                            }
                            className="h-7 w-14 rounded-md border border-gray-200 bg-white px-2 text-center text-xs outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                          />
                          hari
                        </label>
                        <p className="text-[11px] leading-relaxed text-gray-500">
                          <span className="font-semibold text-gray-700">{barisTerisi}</span>/{targets.length} baris akan terisi
                          {barisDariSisa > 0 && (
                            <span className="text-violet-600"> · {barisDariSisa} dari MR sisa</span>
                          )}
                          {sebaran.belumTerpakai.length > 0 && (
                            <span className="text-orange-600"> · {sebaran.belumTerpakai.length} MR tidak terpakai</span>
                          )}
                        </p>
                      </div>
                    )}

                    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-violet-100 bg-violet-50 px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={aiEnabled}
                        onChange={(e) => setAiEnabled(e.target.checked)}
                        className="h-4 w-4 shrink-0 accent-violet-600"
                      />
                      <Sparkles className="h-3.5 w-3.5 shrink-0 text-violet-600" />
                      <span className="text-xs font-medium leading-snug text-violet-700">
                        Rapikan uraian dengan AI
                      </span>
                    </label>

                    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={imagesEnabled}
                        onChange={(e) => setImagesEnabled(e.target.checked)}
                        className="h-4 w-4 shrink-0 accent-emerald-600"
                      />
                      <ImageIcon className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                      <span className="text-xs font-medium leading-snug text-emerald-700">
                        Ambil screenshot (maks. {MAX_IMAGES_PER_ITEM}/MR)
                      </span>
                    </label>

                    <button
                      type="button"
                      onClick={handleApply}
                      disabled={isImporting || chosen.length === 0 || (modeIsi && barisTerisi === 0)}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isImporting ? (
                        <><Loader2 className="h-4 w-4 animate-spin" />{progress || "Memproses..."}</>
                      ) : modeIsi ? (
                        <><Download className="h-4 w-4" />Isi {barisTerisi} baris</>
                      ) : (
                        <><Download className="h-4 w-4" />Import {chosen.length} baris</>
                      )}
                    </button>
                  </>
                )}
              </div>

              {/* ── Kolom kanan: daftar MR ── */}
              <div className="min-w-0 space-y-2">
                {fetched && mrs.length === 0 && (
                  <div className="flex flex-col items-center gap-2 py-10 text-center text-gray-400">
                    <Inbox className="h-7 w-7" />
                    <p className="text-sm">Tidak ada MR merged dalam periode ini.</p>
                  </div>
                )}

                {!fetched && mrs.length === 0 && (
                  <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-gray-200 py-10 text-center text-gray-300">
                    <GitlabIcon className="h-7 w-7" />
                    <p className="text-xs">Daftar merge request muncul di sini</p>
                  </div>
                )}

                {mrs.length > 0 && (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                      <span className="text-gray-500">
                        <span className="font-semibold text-gray-700">{chosen.length}</span>/{mrs.length} MR dipilih
                        <span className="text-gray-400"> · {jumlahBergambar} punya screenshot</span>
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            setSelected(new Set(mrs.filter((mr) => jumlahGambar(mr) > 0).map((mr) => mr.id)))
                          }
                          disabled={jumlahBergambar === 0}
                          className="rounded-lg px-2 py-1 font-medium text-emerald-700 transition-colors hover:bg-emerald-50 disabled:opacity-40 disabled:hover:bg-transparent"
                        >
                          Hanya yang ada screenshot
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelected(new Set(mrs.map((mr) => mr.id)))}
                          className="rounded-lg px-2 py-1 font-medium text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-600"
                        >
                          Pilih semua
                        </button>
                      </div>
                    </div>

                    <div className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
                  {mrs.map((mr) => {
                    const isSel = selected.has(mr.id)
                    const imgCount = jumlahGambar(mr)
                    const tujuan = isSel ? tujuanPerMr.get(mr.id) : undefined
                    return (
                      <label
                        key={mr.id}
                        className={`flex cursor-pointer gap-2.5 rounded-lg border p-3 transition-colors ${
                          isSel ? "border-blue-300 bg-blue-50/50" : "border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSel}
                          onChange={() => toggle(mr.id)}
                          className="mt-0.5 h-4 w-4 shrink-0 accent-blue-600"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium leading-snug text-gray-800">{mr.title}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-gray-400">
                            {mr.projectPath && <span className="font-mono">{mr.projectPath}</span>}
                            <span>· merged {new Date(mr.mergedAt).toLocaleDateString("id-ID")}</span>
                            {imgCount > 0 && (
                              <span className="inline-flex items-center gap-0.5 text-emerald-600">
                                <ImageIcon className="h-2.5 w-2.5" /> {imgCount}
                              </span>
                            )}
                            <a
                              href={mr.webUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-0.5 text-blue-500 hover:underline"
                            >
                              !{mr.iid} <ExternalLink className="h-2.5 w-2.5" />
                            </a>
                          </div>
                          {modeIsi && isSel && (
                            <div className="mt-1.5">
                              {tujuan ? (
                                <span
                                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                    tujuan.dariSisa
                                      ? "bg-violet-100 text-violet-700"
                                      : "bg-blue-100 text-blue-700"
                                  }`}
                                >
                                  <CornerDownRight className="h-2.5 w-2.5" />
                                  {tglPendek(tujuan.tanggal)}
                                  {tujuan.dariSisa && " · isi baris kosong"}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-semibold text-orange-600">
                                  tidak terpakai
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </label>
                    )
                  })}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
