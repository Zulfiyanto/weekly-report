"use client"

import { useEffect, useState } from "react"
import type { WorkItem, WorkTag, GitlabMR } from "@/lib/types"
import { loadGitlabConfig } from "@/lib/storage"
import { resolveLabelsToTags } from "@/lib/tags"
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
} from "lucide-react"
import { toast } from "sonner"

const MAX_DESC = 500
const MAX_TITLE = 80

function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

interface GitlabImportModalProps {
  open: boolean
  onClose: () => void
  periodeAwal: string
  periodeAkhir: string
  allTags: WorkTag[]
  onTagsChange: (tags: WorkTag[]) => void
  onImport: (items: WorkItem[]) => void
  onOpenSettings: () => void
}

export default function GitlabImportModal({
  open,
  onClose,
  periodeAwal,
  periodeAkhir,
  allTags,
  onTagsChange,
  onImport,
  onOpenSettings,
}: GitlabImportModalProps) {
  const [hasConfig, setHasConfig] = useState(false)
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [mrs, setMrs] = useState<GitlabMR[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [aiEnabled, setAiEnabled] = useState(true)
  const [isFetching, setIsFetching] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [progress, setProgress] = useState("")
  const [fetched, setFetched] = useState(false)

  // ── Reset state on open ──────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return
    setHasConfig(loadGitlabConfig() !== null)
    setDateFrom(periodeAwal || "")
    setDateTo(periodeAkhir || "")
    setMrs([])
    setSelected(new Set())
    setFetched(false)
    setProgress("")
  }, [open, periodeAwal, periodeAkhir])

  // ── Fetch MRs ────────────────────────────────────────────────────────────
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
      const res = await fetch("/api/gitlab/merge-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: cfg.url, token: cfg.token, dateFrom, dateTo }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Gagal mengambil merge request")

      const list: GitlabMR[] = data.mergeRequests ?? []
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

  // ── Enhance a single description via existing AI route ─────────────────────
  const enhanceText = async (text: string): Promise<string> => {
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

  // ── Import selected MRs as work items ──────────────────────────────────────
  const handleImport = async () => {
    const chosen = mrs.filter((mr) => selected.has(mr.id))
    if (chosen.length === 0) {
      toast.error("Pilih setidaknya satu merge request")
      return
    }

    setIsImporting(true)
    let workingTags = [...allTags]
    const newItems: WorkItem[] = []

    try {
      for (let i = 0; i < chosen.length; i++) {
        const mr = chosen[i]
        const baseDesc = (mr.description?.trim() || mr.title).slice(0, MAX_DESC)
        let description = baseDesc

        if (aiEnabled && baseDesc.trim().length >= 5) {
          setProgress(`Merapikan dengan AI ${i + 1}/${chosen.length}...`)
          try {
            const enhanced = await enhanceText(baseDesc)
            if (enhanced?.trim()) description = enhanced.trim().slice(0, MAX_DESC)
          } catch {
            // Biarkan deskripsi mentah bila AI gagal untuk item ini
          }
        }

        const { tags: updatedTags, tagIds } = resolveLabelsToTags(mr.labels, workingTags)
        workingTags = updatedTags

        newItems.push({
          id: generateId(),
          title: mr.title.slice(0, MAX_TITLE),
          description,
          isEnhancing: false,
          imageKeys: [],
          tags: tagIds,
        })
      }

      if (workingTags.length !== allTags.length) onTagsChange(workingTags)
      onImport(newItems)
      toast.success(`${newItems.length} item berhasil di-import dari GitLab`)
      onClose()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal meng-import")
    } finally {
      setIsImporting(false)
      setProgress("")
    }
  }

  const selectedCount = selected.size

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <GitlabIcon className="h-4 w-4 text-orange-600" />
            Import dari GitLab
          </DialogTitle>
        </DialogHeader>

        {!hasConfig ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <Settings className="h-8 w-8 text-gray-300" />
            <p className="text-sm text-gray-500">
              Koneksi GitLab belum dikonfigurasi.
            </p>
            <button
              type="button"
              onClick={() => {
                onClose()
                onOpenSettings()
              }}
              className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              <Settings className="h-4 w-4" />
              Buka Pengaturan GitLab
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Date range */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="gl-from" className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Merged dari
                </Label>
                <Input
                  id="gl-from"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="h-10 rounded-xl border-gray-200 bg-gray-50"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="gl-to" className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Merged sampai
                </Label>
                <Input
                  id="gl-to"
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
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-orange-200 bg-orange-50 py-2.5 text-sm font-semibold text-orange-700 hover:bg-orange-100 disabled:opacity-60 transition-colors"
            >
              {isFetching ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Mengambil MR...</>
              ) : (
                <><GitlabIcon className="h-4 w-4" />Ambil Merge Request</>
              )}
            </button>

            {/* MR list */}
            {fetched && mrs.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-6 text-center text-gray-400">
                <Inbox className="h-7 w-7" />
                <p className="text-sm">Tidak ada MR merged dalam periode ini.</p>
              </div>
            )}

            {mrs.length > 0 && (
              <>
                <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                  {mrs.map((mr) => {
                    const isSel = selected.has(mr.id)
                    return (
                      <label
                        key={mr.id}
                        className={`flex gap-2.5 rounded-lg border p-3 cursor-pointer transition-colors ${
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
                          <p className="text-sm font-medium text-gray-800 leading-snug">{mr.title}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-gray-400">
                            {mr.projectPath && <span className="font-mono">{mr.projectPath}</span>}
                            <span>· merged {new Date(mr.mergedAt).toLocaleDateString("id-ID")}</span>
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
                          {mr.labels.length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {mr.labels.map((l) => (
                                <span
                                  key={l}
                                  className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500"
                                >
                                  {l}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </label>
                    )
                  })}
                </div>

                {/* AI toggle */}
                <label className="flex items-center gap-2 rounded-lg bg-violet-50 border border-violet-100 px-3 py-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={aiEnabled}
                    onChange={(e) => setAiEnabled(e.target.checked)}
                    className="h-4 w-4 accent-violet-600"
                  />
                  <Sparkles className="h-3.5 w-3.5 text-violet-600" />
                  <span className="text-xs font-medium text-violet-700">
                    Rapikan deskripsi dengan AI saat import
                  </span>
                </label>

                {/* Import button */}
                <button
                  type="button"
                  onClick={handleImport}
                  disabled={isImporting || selectedCount === 0}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 py-3 text-white font-semibold text-sm shadow-lg hover:bg-blue-800 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                >
                  {isImporting ? (
                    <><Loader2 className="h-4 w-4 animate-spin" />{progress || "Mengimport..."}</>
                  ) : (
                    <><Download className="h-4 w-4" />Import {selectedCount} item</>
                  )}
                </button>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
