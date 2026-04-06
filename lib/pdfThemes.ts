export interface PdfTheme {
  id: string
  label: string
  primary: string
  primaryLight: string
  primaryMid: string
  accentText: string   // sub-header & badge text color in header
}

export const PDF_THEMES: PdfTheme[] = [
  {
    id: "blue",
    label: "Biru",
    primary: "#1d4ed8",
    primaryLight: "#eff6ff",
    primaryMid: "#dbeafe",
    accentText: "#bfdbfe",
  },
  {
    id: "emerald",
    label: "Hijau",
    primary: "#059669",
    primaryLight: "#ecfdf5",
    primaryMid: "#d1fae5",
    accentText: "#a7f3d0",
  },
  {
    id: "purple",
    label: "Ungu",
    primary: "#7c3aed",
    primaryLight: "#f5f3ff",
    primaryMid: "#ede9fe",
    accentText: "#ddd6fe",
  },
  {
    id: "slate",
    label: "Abu-abu",
    primary: "#475569",
    primaryLight: "#f8fafc",
    primaryMid: "#e2e8f0",
    accentText: "#cbd5e1",
  },
  {
    id: "rose",
    label: "Merah",
    primary: "#e11d48",
    primaryLight: "#fff1f2",
    primaryMid: "#ffe4e6",
    accentText: "#fecdd3",
  },
]

export const DEFAULT_THEME = PDF_THEMES[0]

export function getThemeById(id: string): PdfTheme {
  return PDF_THEMES.find((t) => t.id === id) ?? DEFAULT_THEME
}

// ─── Custom theme builder ─────────────────────────────────────────────────────

function mixWithWhite(hex: string, ratio: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const nr = Math.round(r + (255 - r) * ratio)
  const ng = Math.round(g + (255 - g) * ratio)
  const nb = Math.round(b + (255 - b) * ratio)
  return `#${nr.toString(16).padStart(2, "0")}${ng.toString(16).padStart(2, "0")}${nb.toString(16).padStart(2, "0")}`
}

export function buildCustomTheme(hex: string): PdfTheme {
  return {
    id: "custom",
    label: "Kustom",
    primary: hex,
    primaryLight: mixWithWhite(hex, 0.92),
    primaryMid: mixWithWhite(hex, 0.80),
    accentText: mixWithWhite(hex, 0.55),
  }
}
