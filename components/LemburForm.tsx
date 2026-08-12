"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { lemburSchema, type LemburFormValues } from "@/lib/validation"
import {
  saveLemburDraft,
  loadLemburDraft,
  clearLemburDraft,
  saveLemburProfile,
  loadLemburProfile,
  loadLemburTtd,
  saveLemburTtd,
  type LemburTtd,
} from "@/lib/storage"
import { LEMBUR_LOKASI, type LemburItem, type LemburLokasi } from "@/lib/types"
import { deleteImages, loadImages } from "@/lib/imageStorage"
import {
  generateLemburPDF,
  getLemburPDFFileName,
  type LemburPDFItem,
  type LemburPDFProps,
} from "@/lib/lemburPdf"
import type { AbsenEntry } from "@/lib/absenParser"
import LemburItemList, { createLemburItem } from "./LemburItemList"
import LemburPreviewModal from "./LemburPreviewModal"
import LemburGitlabImportModal, { type LemburFillPatch } from "./LemburGitlabImportModal"
import AbsenImportModal, { MAX_TANGGAL } from "./AbsenImportModal"
import SignaturePad from "./SignaturePad"
import GitlabSettings from "./GitlabSettings"
import DraftIndicator from "./DraftIndicator"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  FileText,
  Eye,
  User,
  ListChecks,
  Loader2,
  AlertCircle,
  CalendarDays,
  Clock,
  MapPin,
  GitlabIcon,
  Settings,
  Wand2,
  CalendarClock,
  PenLine,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"

const MAX_URAIAN_ITEM = 300
const MAX_BUKTI_PER_BARIS = 5

export default function LemburForm() {
  const [items, setItems] = useState<LemburItem[]>([createLemburItem()])
  const [jamDefaultMulai, setJamDefaultMulai] = useState("")
  const [jamDefaultSelesai, setJamDefaultSelesai] = useState("")
  const [lokasiDefault, setLokasiDefault] = useState<LemburLokasi | "">("")
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [previewData, setPreviewData] = useState<LemburPDFProps | null>(null)
  const [isClient, setIsClient] = useState(false)
  const [gitlabImportOpen, setGitlabImportOpen] = useState(false)
  const [gitlabSettingsOpen, setGitlabSettingsOpen] = useState(false)
  const [absenOpen, setAbsenOpen] = useState(false)
  const [ttd, setTtd] = useState<LemburTtd>({})
  const [ttdEdit, setTtdEdit] = useState<"pekerja" | "manager" | null>(null)

  const form = useForm<LemburFormValues>({
    resolver: zodResolver(lemburSchema),
    defaultValues: {
      nama: "",
      nipp: "",
      jabatan: "",
      namaPekerjaan: "",
      namaManager: "",
      tanggalDokumen: "",
    },
  })

  const { register, watch, setValue, formState: { errors } } = form
  const watchedValues = watch()

  /** Baris yang sudah punya tanggal tapi uraiannya masih kosong. */
  const barisKosong = items.filter((i) => i.tanggal && !i.uraian.trim()).length

  // ── Client init ────────────────────────────────────────────────────────────
  useEffect(() => {
    setIsClient(true)
    setTtd(loadLemburTtd())
    const draft = loadLemburDraft()
    if (draft) {
      setValue("nama", draft.nama ?? "")
      setValue("nipp", draft.nipp ?? "")
      setValue("jabatan", draft.jabatan ?? "")
      setValue("namaPekerjaan", draft.namaPekerjaan ?? "")
      setValue("namaManager", draft.namaManager ?? "")
      setValue("tanggalDokumen", draft.tanggalDokumen ?? "")
      setJamDefaultMulai(draft.jamDefaultMulai ?? "")
      setJamDefaultSelesai(draft.jamDefaultSelesai ?? "")
      setLokasiDefault(draft.lokasiDefault ?? "")
      if (draft.items.length > 0) setItems(draft.items)
      setDraftSavedAt(draft.savedAt)
      toast.success("Draft lembur terakhir berhasil dimuat")
      return
    }
    // Tanpa draft: pulihkan identitas dari profile (bertahan walau draft dihapus)
    const profile = loadLemburProfile()
    if (profile) {
      setValue("nama", profile.nama)
      setValue("nipp", profile.nipp)
      setValue("jabatan", profile.jabatan)
      setValue("namaPekerjaan", profile.namaPekerjaan)
      setValue("namaManager", profile.namaManager)
    }
  }, [setValue])

  // ── Auto-save draft (1s debounce) ─────────────────────────────────────────
  const saveDraftNow = useCallback(() => {
    if (!isClient) return
    saveLemburDraft({
      nama: watchedValues.nama,
      nipp: watchedValues.nipp,
      jabatan: watchedValues.jabatan,
      namaPekerjaan: watchedValues.namaPekerjaan,
      namaManager: watchedValues.namaManager,
      tanggalDokumen: watchedValues.tanggalDokumen,
      jamDefaultMulai,
      jamDefaultSelesai,
      lokasiDefault,
      items,
    })
    setDraftSavedAt(new Date().toISOString())
  }, [
    isClient,
    watchedValues.nama,
    watchedValues.nipp,
    watchedValues.jabatan,
    watchedValues.namaPekerjaan,
    watchedValues.namaManager,
    watchedValues.tanggalDokumen,
    jamDefaultMulai,
    jamDefaultSelesai,
    lokasiDefault,
    items,
  ])

  useEffect(() => {
    if (!isClient) return
    const timeout = setTimeout(saveDraftNow, 1000)
    return () => clearTimeout(timeout)
  }, [saveDraftNow, isClient])

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  const handleGenerateRef = useRef<() => void>(() => {})

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault()
        handleGenerateRef.current()
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault()
        saveDraftNow()
        toast.success("Draft disimpan", { duration: 1500 })
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [saveDraftNow])

  // ── Clear draft ────────────────────────────────────────────────────────────
  const handleClearDraft = useCallback(async () => {
    const allKeys = items.flatMap((i) => i.imageKeys)
    if (allKeys.length > 0) await deleteImages(allKeys)
    clearLemburDraft()
    setValue("tanggalDokumen", "")
    setItems([
      createLemburItem({
        jamMulai: jamDefaultMulai,
        jamSelesai: jamDefaultSelesai,
        lokasi: lokasiDefault,
      }),
    ])
    setDraftSavedAt(null)
    toast.success("Draft lembur berhasil dihapus — identitas tetap tersimpan")
  }, [items, setValue, jamDefaultMulai, jamDefaultSelesai, lokasiDefault])

  // ── Terapkan jam & lokasi default ke semua baris ──────────────────────────
  // Hanya menimpa field default yang sudah diisi, supaya klik tombol ini tidak
  // mengosongkan nilai per-baris yang sudah terlanjur diisi manual.
  const applyDefaultsToAll = () => {
    if (!jamDefaultMulai && !jamDefaultSelesai && !lokasiDefault) {
      toast.error("Isi jam atau lokasi default terlebih dahulu")
      return
    }
    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        ...(jamDefaultMulai ? { jamMulai: jamDefaultMulai } : {}),
        ...(jamDefaultSelesai ? { jamSelesai: jamDefaultSelesai } : {}),
        ...(lokasiDefault ? { lokasi: lokasiDefault } : {}),
      }))
    )
    toast.success("Default diterapkan ke semua baris")
  }

  // ── GitLab import handler ──────────────────────────────────────────────────
  const handleGitlabImport = useCallback((newItems: LemburItem[]) => {
    if (newItems.length === 0) return
    setItems((prev) => {
      const onlyEmptyDefault =
        prev.length === 1 && !prev[0].uraian.trim() && prev[0].imageKeys.length === 0
      return onlyEmptyDefault ? newItems : [...prev, ...newItems]
    })
  }, [])

  // ── MR mengisi uraian baris lembur yang sudah bertanggal ───────────────────
  const handleGitlabFill = useCallback((patches: LemburFillPatch[]) => {
    if (patches.length === 0) return
    setItems((prev) =>
      prev.map((item) => {
        const p = patches.find((x) => x.id === item.id)
        if (!p) return item
        // Uraian yang sudah terisi manual tidak dibuang — hasil MR ditambahkan di belakangnya
        const uraian = item.uraian.trim()
          ? `${item.uraian.trim()}; ${p.uraian}`.slice(0, MAX_URAIAN_ITEM)
          : p.uraian
        return {
          ...item,
          uraian,
          keterangan: item.keterangan.trim() || p.keterangan,
          imageKeys: [...item.imageKeys, ...p.imageKeys].slice(0, MAX_BUKTI_PER_BARIS),
        }
      })
    )
  }, [])

  // ── Tanggal terpilih dari daftar absen → baris kegiatan ────────────────────
  const handleAbsenPick = useCallback(
    (picked: AbsenEntry[]) => {
      if (picked.length === 0) return
      const newItems: LemburItem[] = picked.map((e) => ({
        ...createLemburItem({ lokasi: lokasiDefault }),
        tanggal: e.tanggal,
        jamMulai: e.jamMasuk,
        jamSelesai: e.jamKeluar,
      }))
      setItems((prev) => {
        const kosong =
          prev.length === 1 &&
          !prev[0].uraian.trim() &&
          !prev[0].tanggal &&
          prev[0].imageKeys.length === 0
        const next = kosong ? newItems : [...prev, ...newItems]
        if (next.length > MAX_TANGGAL) {
          toast.warning(
            `Sekarang ada ${next.length} baris — skema lembur Anda maksimal ${MAX_TANGGAL} hari`
          )
        }
        return next
      })
    },
    [lokasiDefault]
  )

  // ── Tanda tangan ───────────────────────────────────────────────────────────
  const simpanTtd = useCallback((peran: "pekerja" | "manager", dataUrl: string | null) => {
    setTtd((prev) => {
      const next = { ...prev, [peran]: dataUrl ?? undefined }
      saveLemburTtd(next)
      return next
    })
  }, [])


  // ── Build PDF data ─────────────────────────────────────────────────────────
  const buildLemburPDFData = useCallback(
    async (values: LemburFormValues): Promise<LemburPDFProps | null> => {
      // Baris yang benar-benar kosong (belum disentuh) diabaikan; tapi baris yang
      // sudah punya tanggal WAJIB punya uraian — jangan sampai hilang diam-diam
      // dari PDF hanya karena uraiannya belum diisi.
      const terpakai = items.filter((i) => i.uraian.trim() || i.tanggal)
      if (terpakai.length === 0) {
        toast.error("Tambahkan setidaknya satu baris kegiatan")
        return null
      }
      const tanpaUraian = terpakai.findIndex((i) => !i.uraian.trim())
      if (tanpaUraian !== -1) {
        toast.error(
          `Baris ${tanpaUraian + 1} belum ada uraian kegiatannya — isi manual atau pakai "Lengkapi Baris Kosong"`
        )
        return null
      }
      const filled = terpakai
      const incomplete = filled.findIndex(
        (i) => !i.tanggal || !i.jamMulai || !i.jamSelesai || !i.lokasi
      )
      if (incomplete !== -1) {
        toast.error(
          `Baris ${incomplete + 1}: tanggal, jam mulai, jam selesai, dan lokasi harus diisi`
        )
        return null
      }

      const pdfItems: LemburPDFItem[] = await Promise.all(
        filled.map(async (item) => ({
          id: item.id,
          uraian: item.uraian.trim(),
          tanggal: item.tanggal,
          jamMulai: item.jamMulai,
          jamSelesai: item.jamSelesai,
          lokasi: item.lokasi,
          keterangan: item.keterangan.trim() || item.uraian.trim(),
          images: item.imageKeys.length > 0 ? await loadImages(item.imageKeys) : [],
        }))
      )

      return {
        nama: values.nama,
        nipp: values.nipp,
        jabatan: values.jabatan,
        namaPekerjaan: values.namaPekerjaan,
        namaManager: values.namaManager,
        tanggalDokumen: values.tanggalDokumen,
        items: pdfItems,
        ttdPekerja: ttd.pekerja,
        ttdManager: ttd.manager,
      }
    },
    [items, ttd]
  )

  // ── Preview ────────────────────────────────────────────────────────────────
  const handlePreview = useCallback(async () => {
    const valid = await form.trigger()
    if (!valid) return
    const data = await buildLemburPDFData(form.getValues())
    if (!data) return
    setPreviewData(data)
    setIsPreviewing(true)
  }, [form, buildLemburPDFData])

  // ── Download ───────────────────────────────────────────────────────────────
  const handleDownload = useCallback(async (data: LemburPDFProps) => {
    setIsGenerating(true)
    try {
      const blob = await generateLemburPDF(data)
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = getLemburPDFFileName(data.nama, data.tanggalDokumen)
      a.click()
      URL.revokeObjectURL(url)

      saveLemburProfile({
        nama: data.nama,
        nipp: data.nipp,
        jabatan: data.jabatan,
        namaPekerjaan: data.namaPekerjaan,
        namaManager: data.namaManager,
      })
      toast.success("PDF lembur berhasil digenerate dan didownload!")
    } catch (err) {
      console.error(err)
      toast.error("Gagal generate PDF. Silakan coba lagi.")
    } finally {
      setIsGenerating(false)
    }
  }, [])

  const handleGenerate = useCallback(async () => {
    const valid = await form.trigger()
    if (!valid) return
    const data = await buildLemburPDFData(form.getValues())
    if (!data) return
    await handleDownload(data)
  }, [form, buildLemburPDFData, handleDownload])

  useEffect(() => {
    handleGenerateRef.current = handleGenerate
  }, [handleGenerate])

  const errText = (msg?: string) =>
    msg ? (
      <p className="flex items-center gap-1 text-xs text-red-500">
        <AlertCircle className="h-3 w-3" />{msg}
      </p>
    ) : null

  const fieldClass = (hasError: boolean) =>
    `h-11 rounded-xl border-gray-200 bg-gray-50 focus:bg-white transition-colors ${
      hasError ? "border-red-400 bg-red-50" : ""
    }`

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="space-y-5">

        {/* ── Header ── */}
        <div className="relative overflow-hidden rounded-2xl bg-blue-700 shadow-xl">
          <div className="absolute inset-0 opacity-10"
            style={{ backgroundImage: "radial-gradient(circle at 20% 50%, #60a5fa 0%, transparent 50%), radial-gradient(circle at 80% 20%, #a78bfa 0%, transparent 40%)" }} />
          <div className="relative z-10 px-8 py-7 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2.5 mb-1.5">
                <div className="rounded-lg bg-white/15 p-1.5">
                  <Clock className="h-5 w-5 text-white" />
                </div>
                <h1 className="text-xl font-bold text-white tracking-tight">Laporan Pelaksanaan Lembur</h1>
              </div>
              <p className="text-blue-200 text-sm leading-relaxed">
                Susun dokumen lembur resmi & generate PDF siap tanda tangan.
              </p>
            </div>
            <div className="hidden sm:flex flex-col items-end gap-1 text-right">
              <span className="text-[10px] text-blue-300 font-medium uppercase tracking-wider">Shortcut</span>
              <span className="text-xs text-blue-200 bg-white/10 rounded px-2 py-0.5 font-mono">Ctrl+Enter → Generate</span>
              <span className="text-xs text-blue-200 bg-white/10 rounded px-2 py-0.5 font-mono">Ctrl+S → Save Draft</span>
            </div>
          </div>
        </div>

        {/* ── Draft Indicator ── */}
        {isClient && <DraftIndicator savedAt={draftSavedAt} onClear={handleClearDraft} />}

        {/* ── Identitas & Dokumen ── */}
        <div className="rounded-2xl bg-white shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-50 bg-gray-50/50">
            <div className="rounded-lg bg-blue-100 p-1.5">
              <User className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-800 text-sm">Identitas & Dokumen</h2>
              <p className="text-xs text-gray-400 mt-0.5">Muncul di bagian pembuka dan blok tanda tangan</p>
            </div>
          </div>
          <div className="px-6 py-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="lbr-nama" className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Nama Pekerja
                </Label>
                <Input
                  id="lbr-nama"
                  {...register("nama")}
                  className={fieldClass(!!errors.nama)}
                />
                {errText(errors.nama?.message)}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lbr-nipp" className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  NIPP
                </Label>
                <Input
                  id="lbr-nipp"
                  {...register("nipp")}
                  className={fieldClass(!!errors.nipp)}
                />
                {errText(errors.nipp?.message)}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="lbr-jabatan" className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Jabatan
                </Label>
                <Input
                  id="lbr-jabatan"
                  {...register("jabatan")}
                  className={fieldClass(!!errors.jabatan)}
                />
                {errText(errors.jabatan?.message)}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lbr-pekerjaan" className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Lembur Pekerjaan
                </Label>
                <Input
                  id="lbr-pekerjaan"
                  {...register("namaPekerjaan")}
                  className={fieldClass(!!errors.namaPekerjaan)}
                />
                {errText(errors.namaPekerjaan?.message)}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="lbr-manager" className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Manager Unit Kerja
                </Label>
                <Input
                  id="lbr-manager"
                  {...register("namaManager")}
                  className={fieldClass(!!errors.namaManager)}
                />
                {errText(errors.namaManager?.message)}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lbr-tanggal-dok" className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  <CalendarDays className="h-3 w-3" /> Tanggal Dokumen
                </Label>
                <Input
                  id="lbr-tanggal-dok"
                  type="date"
                  {...register("tanggalDokumen")}
                  className={fieldClass(!!errors.tanggalDokumen)}
                />
                {errText(errors.tanggalDokumen?.message)}
              </div>
            </div>
          </div>
        </div>

        {/* ── Tanda tangan ── */}
        <div className="rounded-2xl bg-white shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-50 bg-gray-50/50">
            <div className="rounded-lg bg-blue-100 p-1.5">
              <PenLine className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-800 text-sm">Tanda Tangan</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Opsional — kosongkan bila mau ditandatangani basah
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 px-6 py-5">
            {([
              { peran: "pekerja", label: "Pekerja", nama: watchedValues.nama },
              { peran: "manager", label: "Manager Unit Kerja", nama: watchedValues.namaManager },
            ] as const).map(({ peran, label, nama }) => {
              const src = ttd[peran]
              return (
                <div key={peran} className="space-y-1.5">
                  <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {label}
                  </Label>
                  <div className="flex h-24 items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-2">
                    {src ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={src} alt={`Tanda tangan ${label}`} className="max-h-full max-w-full object-contain" />
                    ) : (
                      <span className="text-xs text-gray-300">Belum ada</span>
                    )}
                  </div>
                  <p className="truncate text-[11px] text-gray-400">{nama || "—"}</p>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => setTtdEdit(peran)}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-blue-200 bg-white py-2 text-xs font-medium text-blue-700 transition-all hover:bg-blue-50"
                    >
                      <PenLine className="h-3 w-3" />
                      {src ? "Ubah" : "Buat"}
                    </button>
                    {src && (
                      <button
                        type="button"
                        onClick={() => simpanTtd(peran, null)}
                        title="Hapus tanda tangan"
                        className="flex items-center justify-center rounded-lg border border-gray-200 bg-white px-2.5 text-gray-400 transition-all hover:bg-red-50 hover:text-red-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Default jam & lokasi ── */}
        <div className="rounded-2xl bg-white shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-50 bg-gray-50/50">
            <div className="rounded-lg bg-blue-100 p-1.5">
              <Clock className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-800 text-sm">Jam & Lokasi Default</h2>
              <p className="text-xs text-gray-400 mt-0.5">Dipakai untuk baris baru dan hasil import</p>
            </div>
          </div>
          <div className="px-6 py-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="lbr-jam-mulai" className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Jam Mulai
                </Label>
                <Input
                  id="lbr-jam-mulai"
                  type="time"
                  value={jamDefaultMulai}
                  onChange={(e) => setJamDefaultMulai(e.target.value)}
                  className="h-11 rounded-xl border-gray-200 bg-gray-50 focus:bg-white transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lbr-jam-selesai" className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Jam Selesai
                </Label>
                <Input
                  id="lbr-jam-selesai"
                  type="time"
                  value={jamDefaultSelesai}
                  onChange={(e) => setJamDefaultSelesai(e.target.value)}
                  className="h-11 rounded-xl border-gray-200 bg-gray-50 focus:bg-white transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <MapPin className="h-3 w-3" /> Lokasi
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {LEMBUR_LOKASI.map((lok) => (
                  <button
                    key={lok}
                    type="button"
                    onClick={() => setLokasiDefault(lok)}
                    className={`rounded-full px-3.5 py-2 text-xs font-medium transition-all ${
                      lokasiDefault === lok
                        ? "bg-blue-700 text-white shadow-sm"
                        : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                    }`}
                  >
                    {lok}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={applyDefaultsToAll}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-blue-200 bg-white py-2.5 text-sm font-medium text-blue-700 hover:bg-blue-50 shadow-sm transition-all"
            >
              <Wand2 className="h-4 w-4" />
              Terapkan ke Semua Baris
            </button>
          </div>
        </div>

        {/* ── Kegiatan ── */}
        <div className="rounded-2xl bg-white shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-50 bg-gray-50/50">
            <div className="rounded-lg bg-blue-100 p-1.5">
              <ListChecks className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-800 text-sm">Uraian Kegiatan</h2>
              <p className="text-xs text-gray-400 mt-0.5">Lampirkan screenshot untuk tabel evidence</p>
            </div>
          </div>
          <div className="px-6 py-5 space-y-4">
            <button
              type="button"
              onClick={() => setAbsenOpen(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50/60 py-3 text-sm font-semibold text-blue-700 transition-all hover:bg-blue-100"
            >
              <CalendarClock className="h-4 w-4" />
              Pilih Tanggal dari Daftar Absen
            </button>

            {barisKosong > 0 && (
              <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2.5 text-xs text-amber-800">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  <span className="font-semibold">{barisKosong} baris</span> belum ada uraiannya.
                  Import dari GitLab akan mengisinya dari merge request yang belum terpakai, atau
                  tulis manual.
                </span>
              </p>
            )}
            <LemburItemList
              items={items}
              onChange={setItems}
              defaultJamMulai={jamDefaultMulai}
              defaultJamSelesai={jamDefaultSelesai}
              defaultLokasi={lokasiDefault}
            />
          </div>
        </div>

        {/* ── Aksi ── */}
        <div className="space-y-2.5">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handlePreview}
              disabled={isGenerating}
              className="flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-white py-4 text-blue-700 font-semibold text-sm hover:bg-blue-50 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed transition-all"
            >
              <Eye className="h-4 w-4" />
              Preview PDF
            </button>

            <button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating}
              className="flex items-center justify-center gap-2 rounded-xl bg-blue-700 py-4 text-white font-semibold text-sm shadow-lg hover:bg-blue-800 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-150"
            >
              {isGenerating ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Generating...</>
              ) : (
                <><FileText className="h-4 w-4" />Generate PDF</>
              )}
            </button>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setGitlabImportOpen(true)}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-orange-200 bg-white py-3 text-sm font-medium text-orange-700 hover:bg-orange-50 shadow-sm transition-all"
            >
              <GitlabIcon className="h-4 w-4" />
              {items.some((i) => i.tanggal) ? "Isi Uraian dari GitLab" : "Import Kegiatan dari GitLab"}
            </button>
            <button
              type="button"
              onClick={() => setGitlabSettingsOpen(true)}
              title="Pengaturan koneksi GitLab"
              className="flex items-center justify-center rounded-xl border border-gray-200 bg-white px-3 text-gray-500 hover:bg-gray-50 hover:text-gray-700 shadow-sm transition-all"
            >
              <Settings className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {previewData && (
        <LemburPreviewModal
          open={isPreviewing}
          data={previewData}
          onClose={() => setIsPreviewing(false)}
          onDownload={() => handleDownload(previewData)}
          isDownloading={isGenerating}
        />
      )}

      <SignaturePad
        open={ttdEdit !== null}
        onClose={() => setTtdEdit(null)}
        title={ttdEdit === "manager" ? "Tanda Tangan Manager Unit Kerja" : "Tanda Tangan Pekerja"}
        initial={ttdEdit ? ttd[ttdEdit] : undefined}
        onSave={(dataUrl) => ttdEdit && simpanTtd(ttdEdit, dataUrl)}
      />

      <AbsenImportModal
        open={absenOpen}
        onClose={() => setAbsenOpen(false)}
        tanggalDokumen={watchedValues.tanggalDokumen}
        onPick={handleAbsenPick}
      />

      <LemburGitlabImportModal
        open={gitlabImportOpen}
        onClose={() => setGitlabImportOpen(false)}
        defaultJamMulai={jamDefaultMulai}
        defaultJamSelesai={jamDefaultSelesai}
        defaultLokasi={lokasiDefault}
        namaPekerjaan={watchedValues.namaPekerjaan}
        targets={items
          .filter((i) => i.tanggal)
          .map((i) => ({ id: i.id, tanggal: i.tanggal }))}
        onFill={handleGitlabFill}
        onImport={handleGitlabImport}
        onOpenSettings={() => setGitlabSettingsOpen(true)}
      />
      <GitlabSettings
        open={gitlabSettingsOpen}
        onClose={() => setGitlabSettingsOpen(false)}
      />
    </>
  )
}
