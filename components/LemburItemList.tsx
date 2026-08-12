"use client"

import { useState } from "react"
import { LEMBUR_LOKASI, type LemburItem, type LemburLokasi } from "@/lib/types"
import { deleteImage } from "@/lib/imageStorage"
import ItemImages from "./ItemImages"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Trash2,
  Plus,
  ChevronUp,
  ChevronDown,
  Paperclip,
  MapPin,
  CalendarDays,
  Clock,
} from "lucide-react"

const MAX_URAIAN = 300

interface LemburItemListProps {
  items: LemburItem[]
  onChange: (items: LemburItem[]) => void
  defaultJamMulai: string
  defaultJamSelesai: string
  defaultLokasi: LemburLokasi | ""
}

export function generateLemburItemId(): string {
  return "lbr_" + Math.random().toString(36).slice(2) + Date.now().toString(36)
}

/** Baris baru mewarisi default yang sudah diisi user; yang belum diisi tetap kosong. */
export function createLemburItem(
  defaults: { jamMulai?: string; jamSelesai?: string; lokasi?: LemburLokasi | "" } = {}
): LemburItem {
  return {
    id: generateLemburItemId(),
    uraian: "",
    tanggal: "",
    jamMulai: defaults.jamMulai ?? "",
    jamSelesai: defaults.jamSelesai ?? "",
    lokasi: defaults.lokasi ?? "",
    keterangan: "",
    imageKeys: [],
  }
}

export default function LemburItemList({
  items,
  onChange,
  defaultJamMulai,
  defaultJamSelesai,
  defaultLokasi,
}: LemburItemListProps) {
  const [expandedBukti, setExpandedBukti] = useState<Set<string>>(new Set())

  const updateItem = (id: string, patch: Partial<LemburItem>) => {
    onChange(items.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }

  const addItem = () => {
    onChange([
      ...items,
      createLemburItem({
        jamMulai: defaultJamMulai,
        jamSelesai: defaultJamSelesai,
        lokasi: defaultLokasi,
      }),
    ])
  }

  const removeItem = (id: string) => {
    if (items.length <= 1) return
    const item = items.find((i) => i.id === id)
    if (item?.imageKeys.length) item.imageKeys.forEach((key) => deleteImage(key))
    onChange(items.filter((i) => i.id !== id))
  }

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir
    if (target < 0 || target >= items.length) return
    const next = [...items]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  const toggleBukti = (id: string) => {
    setExpandedBukti((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="space-y-3">
      {items.map((item, idx) => {
        const buktiOpen = expandedBukti.has(item.id) || item.imageKeys.length > 0
        // Sudah punya tanggal tapi uraiannya belum diisi — tidak boleh ikut ke PDF
        const belumDiisi = !!item.tanggal && !item.uraian.trim()
        return (
          <div
            key={item.id}
            className={`overflow-hidden rounded-xl border bg-white ${
              belumDiisi ? "border-amber-300 ring-1 ring-amber-100" : "border-gray-200"
            }`}
          >
            {/* Row header */}
            <div
              className={`flex items-center gap-2 border-b px-3 py-2 ${
                belumDiisi ? "border-amber-100 bg-amber-50/70" : "border-gray-100 bg-gray-50/70"
              }`}
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[11px] font-bold text-blue-700">
                {idx + 1}
              </span>
              <span className="flex-1 truncate text-xs text-gray-400">
                {item.uraian.trim() || "Baris kegiatan baru"}
              </span>
              {belumDiisi && (
                <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                  uraian kosong
                </span>
              )}
              <button
                type="button"
                onClick={() => move(idx, -1)}
                disabled={idx === 0}
                title="Naikkan"
                className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => move(idx, 1)}
                disabled={idx === items.length - 1}
                title="Turunkan"
                className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => removeItem(item.id)}
                disabled={items.length <= 1}
                title="Hapus baris"
                className="rounded-md p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="space-y-3 px-3 py-3">
              {/* Uraian */}
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                  Uraian Kegiatan
                </Label>
                <textarea
                  value={item.uraian}
                  maxLength={MAX_URAIAN}
                  onChange={(e) => updateItem(item.id, { uraian: e.target.value })}
                  rows={2}
                  className="w-full resize-y rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 outline-none transition-colors focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
                />
                <p className="text-right text-[10px] text-gray-300">
                  {item.uraian.length}/{MAX_URAIAN}
                </p>
              </div>

              {/* Tanggal + jam */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                    <CalendarDays className="h-3 w-3" /> Tanggal
                  </Label>
                  <Input
                    type="date"
                    value={item.tanggal}
                    onChange={(e) => updateItem(item.id, { tanggal: e.target.value })}
                    className="h-10 rounded-lg border-gray-200 bg-gray-50 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                    <Clock className="h-3 w-3" /> Waktu
                  </Label>
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="time"
                      value={item.jamMulai}
                      onChange={(e) => updateItem(item.id, { jamMulai: e.target.value })}
                      className="h-10 rounded-lg border-gray-200 bg-gray-50 text-sm"
                    />
                    <span className="text-xs text-gray-300">–</span>
                    <Input
                      type="time"
                      value={item.jamSelesai}
                      onChange={(e) => updateItem(item.id, { jamSelesai: e.target.value })}
                      className="h-10 rounded-lg border-gray-200 bg-gray-50 text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Lokasi */}
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                  <MapPin className="h-3 w-3" /> Lokasi
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  {LEMBUR_LOKASI.map((lok) => (
                    <button
                      key={lok}
                      type="button"
                      onClick={() => updateItem(item.id, { lokasi: lok })}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                        item.lokasi === lok
                          ? "bg-blue-700 text-white shadow-sm"
                          : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                      }`}
                    >
                      {lok}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bukti & keterangan */}
              <div className="rounded-lg border border-dashed border-gray-200 px-3 py-2">
                <button
                  type="button"
                  onClick={() => toggleBukti(item.id)}
                  className="flex w-full items-center gap-2 text-left text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <Paperclip className="h-3.5 w-3.5" />
                  Bukti & keterangan
                  {item.imageKeys.length > 0 && (
                    <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                      {item.imageKeys.length}
                    </span>
                  )}
                  <span className="ml-auto">
                    {buktiOpen ? (
                      <ChevronUp className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                  </span>
                </button>

                {buktiOpen && (
                  <div className="mt-2 space-y-2">
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                        Keterangan
                      </Label>
                      <Input
                        value={item.keterangan}
                        onChange={(e) => updateItem(item.id, { keterangan: e.target.value })}
                        className="h-9 rounded-lg border-gray-200 bg-gray-50 text-xs"
                      />
                      <p className="text-[10px] text-gray-400">
                        Dipakai di tabel evidence. Bila kosong, uraian kegiatan yang dipakai.
                      </p>
                    </div>
                    <ItemImages
                      imageKeys={item.imageKeys}
                      onKeysChange={(keys) => updateItem(item.id, { imageKeys: keys })}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })}

      <button
        type="button"
        onClick={addItem}
        className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 py-3 text-sm font-medium text-gray-400 transition-all hover:border-blue-300 hover:bg-blue-50/50 hover:text-blue-600"
      >
        <Plus className="h-4 w-4" />
        Tambah Baris Kegiatan
      </button>
    </div>
  )
}
