"use client"

import { useEffect, useState } from "react"
import type { WorkItem, WorkTag, GithubPR } from "@/lib/types"
import { loadGithubConfig } from "@/lib/storage"
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
  Github,
  Loader2,
  Download,
  Sparkles,
  Settings,
  ExternalLink,
  Inbox,
} from "lucide-react"
import { toast } from "sonner"

const MAX_DESC = 2000
const MAX_TITLE = 80

function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

interface GithubImportModalProps {
  open: boolean
  onClose: () => void
  periodeAwal: string
  periodeAkhir: string
  allTags: WorkTag[]
  onTagsChange: (tags: WorkTag[]) => void
  onImport: (items: WorkItem[]) => void
  onOpenSettings: () => void
}

export default function GithubImportModal({
  open,
  onClose,
  periodeAwal,
  periodeAkhir,
  allTags,
  onTagsChange,
  onImport,
  onOpenSettings,
}: GithubImportModalProps) {
  const [hasConfig, setHasConfig] = useState(false)
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [prs, setPrs] = useState<GithubPR[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [aiEnabled, setAiEnabled] = useState(true)
  const [isFetching, setIsFetching] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [progress, setProgress] = useState("")
  const [fetched, setFetched] = useState(false)

  // ── Reset state on open ──────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return
    setHasConfig(loadGithubConfig() !== null)
    setDateFrom(periodeAwal || "")
    setDateTo(periodeAkhir || "")
    setPrs([])
    setSelected(new Set())
    setFetched(false)
    setProgress("")
  }, [open, periodeAwal, periodeAkhir])

  // ── Fetch PRs ──────────────────────────────────────────────────────────────
  const handleFetch = async () => {
    const cfg = loadGithubConfig()
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
      const res = await fetch("/api/github/pull-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: cfg.url, token: cfg.token, dateFrom, dateTo }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Gagal mengambil pull request")

      const list: GithubPR[] = data.pullRequests ?? []
      setPrs(list)
      setSelected(new Set(list.map((pr) => pr.id)))
      setFetched(true)
      if (list.length === 0) {
        toast.info("Tidak ada PR yang merged dalam periode ini")
      } else {
        toast.success(`${list.length} pull request ditemukan`)
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal mengambil pull request")
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

  // ── Import selected PRs as work items ──────────────────────────────────────
  const handleImport = async () => {
    const chosen = prs.filter((pr) => selected.has(pr.id))
    if (chosen.length === 0) {
      toast.error("Pilih setidaknya satu pull request")
      return
    }

    setIsImporting(true)
    let workingTags = [...allTags]
    const newItems: WorkItem[] = []

    try {
      for (let i = 0; i < chosen.length; i++) {
        const pr = chosen[i]
        const baseDesc = (pr.description?.trim() || pr.title).slice(0, MAX_DESC)
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

        const { tags: updatedTags, tagIds } = resolveLabelsToTags(pr.labels, workingTags)
        workingTags = updatedTags

        newItems.push({
          id: generateId(),
          title: pr.title.slice(0, MAX_TITLE),
          description,
          isEnhancing: false,
          imageKeys: [],
          tags: tagIds,
        })
      }

      if (workingTags.length !== allTags.length) onTagsChange(workingTags)
      onImport(newItems)
      toast.success(`${newItems.length} item berhasil di-import dari GitHub`)
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
            <Github className="h-4 w-4 text-gray-800" />
            Import dari GitHub
          </DialogTitle>
        </DialogHeader>

        {!hasConfig ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <Settings className="h-8 w-8 text-gray-300" />
            <p className="text-sm text-gray-500">
              Koneksi GitHub belum dikonfigurasi.
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
              Buka Pengaturan GitHub
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Date range */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="gh-from" className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Merged dari
                </Label>
                <Input
                  id="gh-from"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="h-10 rounded-xl border-gray-200 bg-gray-50"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="gh-to" className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Merged sampai
                </Label>
                <Input
                  id="gh-to"
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
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-300 bg-gray-50 py-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-100 disabled:opacity-60 transition-colors"
            >
              {isFetching ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Mengambil PR...</>
              ) : (
                <><Github className="h-4 w-4" />Ambil Pull Request</>
              )}
            </button>

            {/* PR list */}
            {fetched && prs.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-6 text-center text-gray-400">
                <Inbox className="h-7 w-7" />
                <p className="text-sm">Tidak ada PR merged dalam periode ini.</p>
              </div>
            )}

            {prs.length > 0 && (
              <>
                <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                  {prs.map((pr) => {
                    const isSel = selected.has(pr.id)
                    return (
                      <label
                        key={pr.id}
                        className={`flex gap-2.5 rounded-lg border p-3 cursor-pointer transition-colors ${
                          isSel ? "border-blue-300 bg-blue-50/50" : "border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSel}
                          onChange={() => toggle(pr.id)}
                          className="mt-0.5 h-4 w-4 shrink-0 accent-blue-600"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-800 leading-snug">{pr.title}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-gray-400">
                            {pr.repo && <span className="font-mono">{pr.repo}</span>}
                            <span>· merged {new Date(pr.mergedAt).toLocaleDateString("id-ID")}</span>
                            <a
                              href={pr.webUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-0.5 text-blue-500 hover:underline"
                            >
                              #{pr.number} <ExternalLink className="h-2.5 w-2.5" />
                            </a>
                          </div>
                          {pr.labels.length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {pr.labels.map((l) => (
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
