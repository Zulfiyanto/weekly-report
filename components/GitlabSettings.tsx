"use client"

import { useState } from "react"
import { loadGitlabConfig, saveGitlabConfig, clearGitlabConfig } from "@/lib/storage"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { GitlabIcon, ShieldAlert, Trash2, Check } from "lucide-react"
import { toast } from "sonner"

interface GitlabSettingsProps {
  open: boolean
  onClose: () => void
  onSaved?: () => void
}

export default function GitlabSettings({ open, onClose, onSaved }: GitlabSettingsProps) {
  const [url, setUrl] = useState("")
  const [token, setToken] = useState("")
  const [hasConfig, setHasConfig] = useState(false)
  const [wasOpen, setWasOpen] = useState(false)

  // Sync form from saved config on the rising edge of `open`
  // (adjust state during render instead of via an effect).
  if (open && !wasOpen) {
    setWasOpen(true)
    const cfg = loadGitlabConfig()
    setUrl(cfg?.url ?? "")
    setToken(cfg?.token ?? "")
    setHasConfig(cfg !== null)
  } else if (!open && wasOpen) {
    setWasOpen(false)
  }

  const handleSave = () => {
    const trimmedUrl = url.trim().replace(/\/+$/, "")
    const trimmedToken = token.trim()
    if (!trimmedUrl || !trimmedToken) {
      toast.error("URL GitLab dan token wajib diisi")
      return
    }
    if (!/^https?:\/\//.test(trimmedUrl)) {
      toast.error("URL harus diawali http:// atau https://")
      return
    }
    saveGitlabConfig({ url: trimmedUrl, token: trimmedToken })
    setHasConfig(true)
    toast.success("Koneksi GitLab disimpan")
    onSaved?.()
    onClose()
  }

  const handleClear = () => {
    clearGitlabConfig()
    setUrl("")
    setToken("")
    setHasConfig(false)
    toast.success("Koneksi GitLab dihapus")
    onSaved?.()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <GitlabIcon className="h-4 w-4 text-orange-600" />
            Koneksi GitLab
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="gitlab-url" className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              URL Instance GitLab
            </Label>
            <Input
              id="gitlab-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://gitlab.kantor.co.id"
              className="h-11 rounded-xl border-gray-200 bg-gray-50 focus:bg-white transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="gitlab-token" className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Personal Access Token
            </Label>
            <Input
              id="gitlab-token"
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="glpat-xxxxxxxxxxxxxxxxxxxx"
              className="h-11 rounded-xl border-gray-200 bg-gray-50 focus:bg-white transition-colors font-mono"
            />
          </div>

          <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-100 px-3 py-2.5">
            <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed text-amber-700">
              Token disimpan di browser Anda (localStorage) dan hanya dikirim ke GitLab melalui server aplikasi ini.
              Gunakan PAT dengan scope minimal <span className="font-mono font-semibold">read_api</span> dan masa berlaku terbatas.
            </p>
          </div>

          <div className="flex justify-between gap-2 pt-1">
            {hasConfig ? (
              <button
                type="button"
                onClick={handleClear}
                className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Hapus koneksi
              </button>
            ) : (
              <span />
            )}
            <button
              type="button"
              onClick={handleSave}
              className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              <Check className="h-4 w-4" />
              Simpan
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
