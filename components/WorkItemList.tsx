"use client"

import { useState } from "react"
import type { WorkItem, WorkTag } from "@/lib/types"
import { deleteImage } from "@/lib/imageStorage"
import { TAG_COLORS, generateTagId, resolveLabelsToTags } from "@/lib/tags"
import { Trash2, Sparkles, GripVertical, Plus, BookmarkPlus, Tags } from "lucide-react"
import DescriptionEditor from "./DescriptionEditor"
import ItemImages from "./ItemImages"
import { toast } from "sonner"

const MAX_DESC = 2000
const MAX_TITLE = 80

interface WorkItemListProps {
  items: WorkItem[]
  onChange: (items: WorkItem[]) => void
  onSaveTemplate: (description: string) => void
  allTags: WorkTag[]
  onTagsChange: (tags: WorkTag[]) => void
}

function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

// ── Main component ────────────────────────────────────────────────────────────
export default function WorkItemList({ items, onChange, onSaveTemplate, allTags, onTagsChange }: WorkItemListProps) {
  const [showAddTag, setShowAddTag] = useState<string | null>(null) // item id
  const [newTagLabel, setNewTagLabel] = useState("")
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[5])
  const [generatingLabelFor, setGeneratingLabelFor] = useState<string | null>(null)

  const addItem = () => {
    onChange([...items, { id: generateId(), title: "", description: "", isEnhancing: false, imageKeys: [], tags: [] }])
  }

  const updateItem = (id: string, patch: Partial<WorkItem>) => {
    onChange(items.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }

  const removeItem = (id: string) => {
    if (items.length <= 1) return
    const item = items.find((i) => i.id === id)
    if (item?.imageKeys.length) {
      item.imageKeys.forEach((key) => deleteImage(key))
    }
    onChange(items.filter((item) => item.id !== id))
  }

  const enhanceItem = async (id: string) => {
    const item = items.find((i) => i.id === id)
    if (!item || item.description.trim().length < 5) return

    updateItem(id, { isEnhancing: true })

    try {
      const res = await fetch("/api/ai-enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: item.description }),
        signal: AbortSignal.timeout(15000),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Gagal memproses AI.")
      updateItem(id, { description: data.enhanced, isEnhancing: false })
      toast.success("Teks berhasil dirapikan oleh AI")
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.name === "TimeoutError"
            ? "Request AI timeout (15 detik). Coba lagi."
            : err.message
          : "Terjadi kesalahan."
      toast.error(msg)
      updateItem(id, { isEnhancing: false })
    }
  }

  const generateLabel = async (id: string) => {
    const item = items.find((i) => i.id === id)
    if (!item || (!item.title.trim() && !item.description.trim())) return

    setGeneratingLabelFor(id)
    try {
      const res = await fetch("/api/ai-label", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: item.title, description: item.description }),
        signal: AbortSignal.timeout(15000),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Gagal generate label.")

      const suggestedLabels: string[] = data.labels
      const { tags: updatedTags, tagIds: newTagIds } = resolveLabelsToTags(suggestedLabels, allTags)

      onTagsChange(updatedTags)
      const mergedTags = [...new Set([...item.tags, ...newTagIds])]
      updateItem(id, { tags: mergedTags })
      toast.success(`${suggestedLabels.length} label berhasil di-generate`)
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.name === "TimeoutError"
            ? "Request timeout. Coba lagi."
            : err.message
          : "Terjadi kesalahan."
      toast.error(msg)
    } finally {
      setGeneratingLabelFor(null)
    }
  }

  const toggleTag = (itemId: string, tagId: string) => {
    const item = items.find((i) => i.id === itemId)
    if (!item) return
    const tags = item.tags.includes(tagId)
      ? item.tags.filter((t) => t !== tagId)
      : [...item.tags, tagId]
    updateItem(itemId, { tags })
  }

  const handleAddTag = (itemId: string) => {
    const label = newTagLabel.trim()
    if (!label) return
    const newTag: WorkTag = {
      id: generateTagId(),
      label: label.slice(0, 20),
      color: newTagColor,
      isDefault: false,
    }
    onTagsChange([...allTags, newTag])
    const item = items.find((i) => i.id === itemId)
    if (item) updateItem(itemId, { tags: [...item.tags, newTag.id] })
    setShowAddTag(null)
    setNewTagLabel("")
    setNewTagColor(TAG_COLORS[5])
  }

  const handleDeleteTag = (tagId: string) => {
    onTagsChange(allTags.filter((t) => t.id !== tagId))
    onChange(items.map((item) => ({ ...item, tags: item.tags.filter((t) => t !== tagId) })))
  }

  return (
    <div className="space-y-3">
      {items.length === 0 && (
        <div className="rounded-xl border-2 border-dashed border-gray-100 py-12 text-center">
          <p className="text-sm text-gray-400">Belum ada item pekerjaan.</p>
        </div>
      )}

      {items.map((item, idx) => {
        const charCount = item.description.length
        const isNearLimit = charCount > MAX_DESC * 0.8
        const isAtLimit = charCount >= MAX_DESC
        const canEnhance = !item.isEnhancing && item.description.trim().length >= 5
        const isGeneratingLabel = generatingLabelFor === item.id
        const canGenerateLabel = !isGeneratingLabel && (item.title.trim().length > 0 || item.description.trim().length > 0)

        return (
          <div
            key={item.id}
            className="group rounded-xl bg-gray-50 border border-gray-100 hover:border-blue-100 hover:bg-blue-50/30 transition-all overflow-hidden"
          >
            {/* Number badge + content + actions */}
            <div className="flex gap-3 p-4">
              {/* Number */}
              <div className="flex flex-col items-center gap-1.5 shrink-0 pt-0.5">
                <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center">
                  <span className="text-xs font-bold text-blue-600">{idx + 1}</span>
                </div>
                <GripVertical className="h-3.5 w-3.5 text-gray-300 group-hover:text-gray-400 transition-colors" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 space-y-2">
                {/* Title input */}
                <input
                  type="text"
                  value={item.title}
                  onChange={(e) => updateItem(item.id, { title: e.target.value.slice(0, MAX_TITLE) })}
                  placeholder={`Judul task ${idx + 1}...`}
                  maxLength={MAX_TITLE}
                  disabled={item.isEnhancing}
                  className={`w-full text-sm font-semibold bg-transparent border-0 border-b pb-1 outline-none placeholder:font-normal transition-colors ${
                    !item.title.trim()
                      ? "border-red-200 placeholder:text-red-300 focus:border-red-400"
                      : "border-gray-200 placeholder:text-gray-300 focus:border-blue-400"
                  }`}
                />

                {/* Description editor (markdown: lists, code, bold/italic) */}
                <DescriptionEditor
                  value={item.description}
                  onChange={(v) => updateItem(item.id, { description: v })}
                  placeholder={`Deskripsikan pekerjaan ${idx + 1}...`}
                  rows={2}
                  maxLength={MAX_DESC}
                  disabled={item.isEnhancing}
                />
                <span className={`text-[10px] tabular-nums float-right ${
                  isAtLimit ? "text-red-500 font-semibold" : isNearLimit ? "text-orange-400" : "text-gray-300"
                }`}>
                  {charCount}/{MAX_DESC}
                </span>
              </div>

              {/* Actions column */}
              <div className="flex flex-col gap-1 pt-0.5 shrink-0">
                <button
                  type="button"
                  onClick={() => enhanceItem(item.id)}
                  disabled={!canEnhance}
                  title="Rapikan dengan AI"
                  className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
                >
                  {item.isEnhancing ? (
                    <span className="h-3 w-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  ) : (
                    <Sparkles className="h-3 w-3" />
                  )}
                  <span className="hidden sm:inline">{item.isEnhancing ? "Proses" : "Rapikan"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => generateLabel(item.id)}
                  disabled={!canGenerateLabel}
                  title="Generate label dengan AI"
                  className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
                >
                  {isGeneratingLabel ? (
                    <span className="h-3 w-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  ) : (
                    <Tags className="h-3 w-3" />
                  )}
                  <span className="hidden sm:inline">{isGeneratingLabel ? "Proses" : "Label"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => onSaveTemplate(item.description)}
                  disabled={!item.description.trim()}
                  title="Simpan sebagai template"
                  className="flex items-center justify-center rounded-lg p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <BookmarkPlus className="h-3.5 w-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  disabled={items.length <= 1}
                  title="Hapus item"
                  className="flex items-center justify-center rounded-lg p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Tag section */}
            <div className="px-4 pb-3 pt-2 border-t border-gray-100/80 pl-14">
              <div className="flex flex-wrap gap-1.5 items-center">
                {allTags.map((tag) => {
                  const selected = item.tags.includes(tag.id)
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTag(item.id, tag.id)}
                      className="group/tag relative inline-flex items-center gap-0.5 rounded-full px-2.5 py-0.5 text-xs font-medium transition-all"
                      style={
                        selected
                          ? {
                              backgroundColor: tag.color,
                              color: "white",
                              boxShadow: `0 0 0 2px white, 0 0 0 3.5px ${tag.color}`,
                            }
                          : {
                              backgroundColor: tag.color + "18",
                              color: tag.color,
                              border: `1px solid ${tag.color}50`,
                            }
                      }
                    >
                      {tag.label}
                      {!tag.isDefault && (
                        <span
                          role="button"
                          onClick={(e) => { e.stopPropagation(); handleDeleteTag(tag.id) }}
                          className="hidden group-hover/tag:inline-flex items-center justify-center w-3 h-3 rounded-full bg-black/15 hover:bg-black/30 ml-0.5 text-[9px] leading-none"
                        >
                          ×
                        </span>
                      )}
                    </button>
                  )
                })}

                {/* Add tag button */}
                <button
                  type="button"
                  onClick={() => {
                    setShowAddTag(item.id)
                    setNewTagLabel("")
                    setNewTagColor(TAG_COLORS[5])
                  }}
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs text-gray-400 border border-dashed border-gray-300 hover:border-blue-400 hover:text-blue-500 transition-colors"
                >
                  <Plus className="h-3 w-3" />
                  Tag baru
                </button>
              </div>

              {/* Inline add-tag form */}
              {showAddTag === item.id && (
                <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-white p-2.5 border border-gray-200 shadow-sm">
                  <input
                    autoFocus
                    value={newTagLabel}
                    onChange={(e) => setNewTagLabel(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddTag(item.id)
                      if (e.key === "Escape") setShowAddTag(null)
                    }}
                    placeholder="Nama tag..."
                    maxLength={20}
                    className="text-xs px-2 py-1 rounded border border-gray-200 bg-gray-50 flex-1 min-w-[100px] outline-none focus:border-blue-400"
                  />
                  <div className="flex gap-1.5 items-center">
                    {TAG_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setNewTagColor(color)}
                        className="w-4 h-4 rounded-full transition-transform shrink-0"
                        style={{
                          backgroundColor: color,
                          transform: newTagColor === color ? "scale(1.35)" : "scale(1)",
                          boxShadow: newTagColor === color ? `0 0 0 1.5px white, 0 0 0 3px ${color}` : "none",
                        }}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAddTag(item.id)}
                    disabled={!newTagLabel.trim()}
                    className="text-xs px-2.5 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 transition-colors"
                  >
                    Tambah
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowAddTag(null); setNewTagLabel("") }}
                    className="text-xs px-2.5 py-1 rounded text-gray-500 hover:bg-gray-100 transition-colors"
                  >
                    Batal
                  </button>
                </div>
              )}
            </div>

            {/* Image section */}
            <div className="px-4 pb-4 pt-1 border-t border-gray-100/80 pl-14">
              <ItemImages
                imageKeys={item.imageKeys}
                onKeysChange={(keys) => updateItem(item.id, { imageKeys: keys })}
              />
            </div>
          </div>
        )
      })}

      <button
        type="button"
        onClick={addItem}
        className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 py-3.5 text-sm text-gray-500 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50/40 transition-all font-medium"
      >
        <Plus className="h-4 w-4" />
        Tambah Item Pekerjaan
      </button>
    </div>
  )
}
