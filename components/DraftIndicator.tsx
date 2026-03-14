"use client"

import { format } from "date-fns"
import { id } from "date-fns/locale"
import { Save, Trash2 } from "lucide-react"
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"

interface DraftIndicatorProps {
  savedAt: string | null
  onClear: () => void
}

export default function DraftIndicator({ savedAt, onClear }: DraftIndicatorProps) {
  const time = savedAt
    ? format(new Date(savedAt), "HH:mm", { locale: id })
    : null

  return (
    <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
      {/* Status */}
      <span>
        {time ? (
          <span className="flex items-center gap-1.5">
            <Save className="h-3.5 w-3.5 text-green-500" />
            <span className="text-green-600 font-medium">Draft tersimpan — {time}</span>
          </span>
        ) : (
          <span className="text-gray-400">Belum ada draft tersimpan</span>
        )}
      </span>

      {/* Delete with confirmation */}
      {time && (
        <Dialog>
          <DialogTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-1 text-gray-400 hover:text-red-500 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Hapus Draft
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Hapus Draft?</DialogTitle>
              <DialogDescription>
                Semua isian form dan gambar yang belum digenerate akan dihapus. Tindakan ini tidak dapat dibatalkan.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <button
                  type="button"
                  className="px-4 py-2 text-sm rounded-md border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  Batal
                </button>
              </DialogClose>
              <DialogClose asChild>
                <button
                  type="button"
                  onClick={onClear}
                  className="px-4 py-2 text-sm rounded-md bg-red-500 text-white hover:bg-red-600 transition-colors"
                >
                  Hapus Draft
                </button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
