"use client"

import { parseMarkdown, type InlineToken } from "@/lib/markdown"

function Inline({ tokens }: { tokens: InlineToken[] }) {
  return (
    <>
      {tokens.map((tk, i) => {
        if (tk.type === "bold")
          return <strong key={i} className="font-semibold text-gray-900">{tk.value}</strong>
        if (tk.type === "italic")
          return <em key={i} className="italic">{tk.value}</em>
        if (tk.type === "code")
          return (
            <code
              key={i}
              className="rounded border border-gray-200 bg-gray-100 px-1.5 py-0.5 font-mono text-[0.85em] text-gray-800"
            >
              {tk.value}
            </code>
          )
        return <span key={i}>{tk.value}</span>
      })}
    </>
  )
}

export default function MarkdownPreview({
  text,
  className,
}: {
  text: string
  className?: string
}) {
  const blocks = parseMarkdown(text)

  if (blocks.length === 0) {
    return <p className="text-sm italic text-gray-300">Belum ada deskripsi…</p>
  }

  return (
    <div className={`space-y-1.5 text-sm leading-relaxed text-gray-700 ${className ?? ""}`}>
      {blocks.map((block, i) => {
        switch (block.type) {
          case "heading": {
            const cls =
              block.level <= 1
                ? "text-[15px] font-bold text-gray-900"
                : block.level === 2
                  ? "text-sm font-bold text-gray-900"
                  : "text-sm font-semibold text-gray-800"
            return (
              <p key={i} className={`mt-1 ${cls}`}>
                <Inline tokens={block.content} />
              </p>
            )
          }
          case "bullet":
            return (
              <ul key={i} className="list-disc space-y-0.5 pl-5 marker:text-blue-400">
                {block.items.map((it, j) => (
                  <li key={j}><Inline tokens={it} /></li>
                ))}
              </ul>
            )
          case "numbered":
            return (
              <ol key={i} className="list-decimal space-y-0.5 pl-5 marker:text-blue-400 marker:font-semibold">
                {block.items.map((it, j) => (
                  <li key={j}><Inline tokens={it} /></li>
                ))}
              </ol>
            )
          case "code":
            return (
              <pre
                key={i}
                className="overflow-x-auto whitespace-pre-wrap rounded-md border border-gray-200 bg-gray-50 p-3 font-mono text-xs leading-relaxed text-gray-800"
              >
                <code>{block.code}</code>
              </pre>
            )
          default:
            return (
              <p key={i}>
                <Inline tokens={block.content} />
              </p>
            )
        }
      })}
    </div>
  )
}
