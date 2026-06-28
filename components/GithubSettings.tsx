"use client"

import { useState } from "react"
import { loadGithubConfig, saveGithubConfig, clearGithubConfig } from "@/lib/storage"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Github, ShieldAlert, Trash2, Check } from "lucide-react"
import { toast } from "sonner"

const DEFAULT_API_URL = "https://api.github.com"

interface GithubSettingsProps {
  open: boolean
  onClose: () => void
  onSaved?: () => void
}

export default function GithubSettings({ open, onClose, onSaved }: GithubSettingsProps) {
  const [url, setUrl] = useState(DEFAULT_API_URL)
  const [token, setToken] = useState("")
  const [hasConfig, setHasConfig] = useState(false)
  const [wasOpen, setWasOpen] = useState(false)

  // Sync form from saved config on the rising edge of `open`.
  if (open && !wasOpen) {
    setWasOpen(true)
    const cfg = loadGithubConfig()
    setUrl(cfg?.url ?? DEFAULT_API_URL)
    setToken(cfg?.token ?? "")
    setHasConfig(cfg !== null)
  } else if (!open && wasOpen) {
    setWasOpen(false)
  }

  const handleSave = () => {
    const trimmedUrl = (url.trim() || DEFAULT_API_URL).replace(/\/+$/, "")
    const trimmedToken = token.trim()
    if (!trimmedToken) {
      toast.error("Personal Access Token wajib diisi")
      return
    }
    if (!/^https?:\/\//.test(trimmedUrl)) {
      toast.error("URL harus diawali http:// atau https://")
      return
    }
    saveGithubConfig({ url: trimmedUrl, token: trimmedToken })
    setHasConfig(true)
    toast.success("Koneksi GitHub disimpan")
    onSaved?.()
    onClose()
  }

  const handleClear = () => {
    clearGithubConfig()
    setUrl(DEFAULT_API_URL)
    setToken("")
    setHasConfig(false)
    toast.success("Koneksi GitHub dihapus")
    onSaved?.()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Github className="h-4 w-4 text-gray-800" />
            Koneksi GitHub
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="github-url" className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              URL API GitHub
            </Label>
            <Input
              id="github-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://api.github.com"
              className="h-11 rounded-xl border-gray-200 bg-gray-50 focus:bg-white transition-colors"
            />
            <p className="text-[11px] text-gray-400">
              Default <span className="font-mono">https://api.github.com</span>. Untuk GitHub Enterprise:{" "}
              <span className="font-mono">https://host/api/v3</span>.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="github-token" className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Personal Access Token
            </Label>
            <Input
              id="github-token"
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
              className="h-11 rounded-xl border-gray-200 bg-gray-50 focus:bg-white transition-colors font-mono"
            />
          </div>

          <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-100 px-3 py-2.5">
            <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed text-amber-700">
              Token disimpan di browser Anda (localStorage) dan hanya dikirim ke GitHub melalui server aplikasi ini.
              Gunakan PAT dengan scope <span className="font-mono font-semibold">repo</span> (atau{" "}
              <span className="font-mono font-semibold">public_repo</span> untuk repo publik) dan masa berlaku terbatas.
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
