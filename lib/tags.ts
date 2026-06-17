import type { WorkTag } from "./types"

export const TAG_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#14b8a6", "#3b82f6", "#8b5cf6", "#ec4899", "#6b7280",
]

export function generateTagId(): string {
  return "tag_" + Math.random().toString(36).slice(2) + Date.now().toString(36)
}

/**
 * Resolve a list of label strings into tag IDs, reusing existing tags
 * (case-insensitive match) and creating new ones as needed.
 * Returns the (possibly extended) full tag list and the resolved IDs
 * in label order, deduplicated.
 */
export function resolveLabelsToTags(
  labels: string[],
  existingTags: WorkTag[]
): { tags: WorkTag[]; tagIds: string[] } {
  let updated = [...existingTags]
  const tagIds: string[] = []

  for (const label of labels) {
    const trimmed = label.trim()
    if (!trimmed) continue
    const existing = updated.find((t) => t.label.toLowerCase() === trimmed.toLowerCase())
    if (existing) {
      if (!tagIds.includes(existing.id)) tagIds.push(existing.id)
    } else {
      const colorIdx = updated.length % TAG_COLORS.length
      const newTag: WorkTag = {
        id: generateTagId(),
        label: trimmed.slice(0, 20),
        color: TAG_COLORS[colorIdx],
        isDefault: false,
      }
      updated = [...updated, newTag]
      tagIds.push(newTag.id)
    }
  }

  return { tags: updated, tagIds }
}
