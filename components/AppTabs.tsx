"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { FileText, Clock } from "lucide-react"

const TABS = [
  { href: "/", label: "Weekly Report", icon: FileText },
  { href: "/lembur", label: "Laporan Lembur", icon: Clock },
]

export default function AppTabs() {
  const pathname = usePathname()

  return (
    <nav className="mb-5 flex gap-1 rounded-xl border border-gray-100 bg-white p-1 shadow-sm">
      {TABS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href
        return (
          <Link
            key={href}
            href={href}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all ${
              active
                ? "bg-blue-700 text-white shadow-sm"
                : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
