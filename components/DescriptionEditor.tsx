"use client"

import { useRef, useState } from "react"
import { Textarea } from "@/components/ui/textarea"
import MarkdownPreview from "./MarkdownPreview"
import { hasMarkdown, autoFormatList } from "@/lib/markdown"
import { Bold, Italic, Code, SquareCode, List, ListOrdered, Heading, Eye, Pencil } from "lucide-react"
import { toast } from "sonner"

interface DescriptionEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  maxLength?: number
  rows?: number
}

export default function DescriptionEditor({
  value,
  onChange,
  placeholder,
  disabled,
  maxLength,
  rows = 2,
}: DescriptionEditorProps) {
  const taRef = useRef<HTMLTextAreaElement>(null)
  const [tab, setTab] = useState<"write" | "preview">("write")

  const commit = (next: string, selStart: number, selEnd: number) => {
    const clipped = maxLength ? next.slice(0, maxLength) : next
    onChange(clipped)
    requestAnimationFrame(() => {
      const ta = taRef.current
      if (!ta) return
      ta.focus()
      ta.setSelectionRange(Math.min(selStart, clipped.length), Math.min(selEnd, clipped.length))
    })
  }

  // Wrap the current selection in a symmetric token, e.g. **bold** or `code`.
  const wrap = (token: string) => {
    const ta = taRef.current
    if (!ta) return
    const { selectionStart: s, selectionEnd: e } = ta
    const sel = value.slice(s, e)
    const next = value.slice(0, s) + token + sel + token + value.slice(e)
    commit(next, s + token.length, e + token.length)
  }

  // Prefix each selected line, e.g. "- " bullets or "1. " numbered.
  const prefixLines = (prefix: string | ((n: number) => string)) => {
    const ta = taRef.current
    if (!ta) return
    const { selectionStart: s, selectionEnd: e } = ta
    const lineStart = value.lastIndexOf("\n", s - 1) + 1
    let lineEnd = value.indexOf("\n", e)
    if (lineEnd === -1) lineEnd = value.length
    const segment = value.slice(lineStart, lineEnd)
    const newSegment = segment
      .split("\n")
      .map((ln, i) => (typeof prefix === "function" ? prefix(i + 1) : prefix) + ln)
      .join("\n")
    const next = value.slice(0, lineStart) + newSegment + value.slice(lineEnd)
    commit(next, lineStart, lineStart + newSegment.length)
  }

  // Auto-format pasted multi-line text into a markdown list.
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pasted = e.clipboardData.getData("text")
    if (!pasted) return
    const formatted = autoFormatList(pasted)
    if (formatted === pasted) return // single line / already clean → default paste
    e.preventDefault()
    const ta = taRef.current
    if (!ta) return
    const { selectionStart: s, selectionEnd: en } = ta
    const next = value.slice(0, s) + formatted + value.slice(en)
    const caret = s + formatted.length
    commit(next, caret, caret)
    toast.success("Deskripsi otomatis diformat jadi daftar", { duration: 1500 })
  }

  const insertCodeBlock = () => {
    const ta = taRef.current
    if (!ta) return
    const { selectionStart: s, selectionEnd: e } = ta
    const sel = value.slice(s, e) || "code"
    const block = "```\n" + sel + "\n```"
    const next = value.slice(0, s) + block + value.slice(e)
    commit(next, s + 4, s + 4 + sel.length)
  }

  const ToolBtn = ({
    onClick,
    title,
    children,
  }: {
    onClick: () => void
    title: string
    children: React.ReactNode
  }) => (
    <button
      type="button"
      onMouseDown={(ev) => ev.preventDefault()} // keep textarea selection
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="flex h-6 w-6 items-center justify-center rounded text-gray-400 transition-colors hover:bg-blue-100 hover:text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  )

  return (
    <div className="space-y-1.5">
      {/* Toolbar + tab toggle */}
      <div className="flex items-center justify-between">
        <div className={`flex items-center gap-0.5 ${tab === "preview" ? "pointer-events-none opacity-40" : ""}`}>
          <ToolBtn onClick={() => prefixLines("### ")} title="Judul"><Heading className="h-3.5 w-3.5" /></ToolBtn>
          <ToolBtn onClick={() => wrap("**")} title="Tebal (**teks**)"><Bold className="h-3.5 w-3.5" /></ToolBtn>
          <ToolBtn onClick={() => wrap("*")} title="Miring (*teks*)"><Italic className="h-3.5 w-3.5" /></ToolBtn>
          <ToolBtn onClick={() => wrap("`")} title="Kode inline (`kode`)"><Code className="h-3.5 w-3.5" /></ToolBtn>
          <ToolBtn onClick={insertCodeBlock} title="Blok kode (```)"><SquareCode className="h-3.5 w-3.5" /></ToolBtn>
          <span className="mx-0.5 h-4 w-px bg-gray-200" />
          <ToolBtn onClick={() => prefixLines("- ")} title="Daftar poin"><List className="h-3.5 w-3.5" /></ToolBtn>
          <ToolBtn onClick={() => prefixLines((n) => `${n}. `)} title="Daftar bernomor"><ListOrdered className="h-3.5 w-3.5" /></ToolBtn>
        </div>

        <button
          type="button"
          onClick={() => setTab((t) => (t === "write" ? "preview" : "write"))}
          className="flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
        >
          {tab === "write" ? (
            <><Eye className="h-3 w-3" /> Pratinjau</>
          ) : (
            <><Pencil className="h-3 w-3" /> Tulis</>
          )}
        </button>
      </div>

      {/* Editor / Preview */}
      {tab === "write" ? (
        <Textarea
          ref={taRef}
          value={value}
          onChange={(e) => onChange(maxLength ? e.target.value.slice(0, maxLength) : e.target.value)}
          onPaste={handlePaste}
          placeholder={placeholder}
          rows={rows}
          maxLength={maxLength}
          disabled={disabled}
          className="resize-none border-0 bg-transparent p-0 text-sm leading-relaxed shadow-none placeholder:text-gray-300 focus-visible:ring-0"
        />
      ) : (
        <div className="min-h-[2.5rem] rounded-lg border border-dashed border-gray-200 bg-white/60 p-2.5">
          <MarkdownPreview text={value} />
        </div>
      )}

      {tab === "write" && (
        <>
          {hasMarkdown(value) && (
            <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50/60 p-2.5">
              <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-gray-400">
                Pratinjau
              </p>
              <MarkdownPreview text={value} />
            </div>
          )}
          <p className="text-[10px] text-gray-400">
            Tip: bungkus kata dengan{" "}
            <code className="rounded bg-gray-100 px-1 font-mono text-gray-600">`backtick`</code> untuk
            gaya kode (mis. <code className="rounded bg-gray-100 px-1 font-mono text-gray-600">body</code>).
          </p>
        </>
      )}
    </div>
  )
}
