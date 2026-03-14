"use client"

import { useState } from "react"
import type { WorkTemplate } from "@/lib/types"
import { saveTemplate, deleteTemplate } from "@/lib/storage"
import { X, Plus, Tag } from "lucide-react"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"

interface TemplateChipsProps {
  templates: WorkTemplate[]
  onUseTemplate: (description: string) => void
  onTemplatesChange: (templates: WorkTemplate[]) => void
}

function generateTemplateId(): string {
  return "tpl_" + Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export default function TemplateChips({
  templates,
  onUseTemplate,
  onTemplatesChange,
}: TemplateChipsProps) {
  const [newLabel, setNewLabel] = useState("")
  const [showInput, setShowInput] = useState(false)

  const handleDelete = (template: WorkTemplate) => {
    if (template.isDefault) return
    deleteTemplate(template.id)
    onTemplatesChange(templates.filter((t) => t.id !== template.id))
    toast.success("Template dihapus")
  }

  const handleAdd = () => {
    const trimmed = newLabel.trim()
    if (!trimmed) {
      setShowInput(false)
      return
    }
    if (templates.find((t) => t.label.toLowerCase() === trimmed.toLowerCase())) {
      toast.error("Template dengan nama ini sudah ada")
      return
    }
    if (templates.length >= 20) {
      toast.error("Maksimal 20 template")
      return
    }
    const newTemplate: WorkTemplate = {
      id: generateTemplateId(),
      label: trimmed,
      description: trimmed,
      isDefault: false,
    }
    saveTemplate(newTemplate)
    onTemplatesChange([...templates, newTemplate])
    toast.success("Template disimpan")
    setNewLabel("")
    setShowInput(false)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Tag className="h-3.5 w-3.5" />
        <span>Template Cepat</span>
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        {templates.map((template) => (
          <div
            key={template.id}
            className={`group flex items-center gap-1 rounded-full border pl-3 pr-1.5 py-1 text-xs transition-colors ${
              template.isDefault
                ? "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                : "bg-violet-50 border-violet-200 text-violet-700 hover:bg-violet-100"
            }`}
          >
            <button
              type="button"
              onClick={() => onUseTemplate(template.description)}
              title={template.description}
              className="hover:font-medium transition-all"
            >
              {template.label}
            </button>
            {!template.isDefault && (
              <button
                type="button"
                onClick={() => handleDelete(template)}
                className="rounded-full p-0.5 hover:bg-violet-200 text-violet-400 hover:text-violet-700 transition-colors opacity-0 group-hover:opacity-100"
                title="Hapus template"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}

        {showInput ? (
          <div className="flex items-center gap-1.5">
            <Input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd()
                if (e.key === "Escape") {
                  setShowInput(false)
                  setNewLabel("")
                }
              }}
              placeholder="Nama template..."
              className="h-7 text-xs w-36 rounded-full"
              autoFocus
            />
            <button
              type="button"
              onClick={handleAdd}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              Simpan
            </button>
            <button
              type="button"
              onClick={() => {
                setShowInput(false)
                setNewLabel("")
              }}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Batal
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowInput(true)}
            className="flex items-center gap-1 rounded-full border border-dashed border-gray-300 px-3 py-1 text-xs text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors"
          >
            <Plus className="h-3 w-3" />
            Tambah Template
          </button>
        )}
      </div>
    </div>
  )
}
