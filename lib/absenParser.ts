export interface AbsenEntry {
  tanggal: string     // yyyy-MM-dd
  jamMasuk: string    // HH:mm ("" bila tidak ada di teks)
  jamKeluar: string   // HH:mm ("" bila tidak ada di teks)
  status: string      // mis. "Hadir"
}

export interface ParseAbsenResult {
  entries: AbsenEntry[]
  /** Jumlah baris tidak kosong yang gagal dikenali. */
  skipped: number
  /** Jumlah baris yang dibuang karena tanggalnya duplikat. */
  duplicates: number
}

const pad = (n: number) => String(n).padStart(2, "0")

/** Tanggal di awal baris: 12-08-2026, 12/08/2026, 12.08.2026 */
const DATE_RE = /^\s*(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})\b/
/** Jam mana pun di sisa baris: 08:19 atau 08.19 */
const TIME_RE = /\b(\d{1,2})[:.](\d{2})\b/g

function isValidDate(d: number, m: number, y: number): boolean {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false
  const dt = new Date(y, m - 1, d)
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d
}

/**
 * Baca daftar absen yang ditempel user. Format yang diharapkan per baris:
 *   12-08-2026    08:19    20:16    Hadir
 * Pemisah bebas (tab atau spasi berapa pun), jam boleh pakai ":" atau ".".
 * Baris tanpa jam tetap diambil — jamnya dikosongkan supaya bisa diisi manual.
 * Hasil diurutkan menaik dan tanggal duplikat dibuang (yang pertama dipakai).
 */
export function parseAbsenText(text: string): ParseAbsenResult {
  const seen = new Set<string>()
  const entries: AbsenEntry[] = []
  let skipped = 0
  let duplicates = 0

  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue

    const dateMatch = line.match(DATE_RE)
    if (!dateMatch) {
      skipped++
      continue
    }

    const d = Number(dateMatch[1])
    const m = Number(dateMatch[2])
    const y = Number(dateMatch[3])
    if (!isValidDate(d, m, y)) {
      skipped++
      continue
    }
    const tanggal = `${y}-${pad(m)}-${pad(d)}`

    const rest = line.slice(dateMatch[0].length)
    TIME_RE.lastIndex = 0
    const times: string[] = []
    let tm: RegExpExecArray | null
    while ((tm = TIME_RE.exec(rest)) !== null) {
      const hh = Number(tm[1])
      const mm = Number(tm[2])
      if (hh <= 23 && mm <= 59) times.push(`${pad(hh)}:${pad(mm)}`)
    }

    if (seen.has(tanggal)) {
      duplicates++
      continue
    }
    seen.add(tanggal)

    // Sisa teks setelah tanggal & jam dibuang = kolom status
    const status = rest.replace(TIME_RE, " ").replace(/\s+/g, " ").trim()

    entries.push({
      tanggal,
      jamMasuk: times[0] ?? "",
      jamKeluar: times[1] ?? "",
      status,
    })
  }

  entries.sort((a, b) => a.tanggal.localeCompare(b.tanggal))
  return { entries, skipped, duplicates }
}

export interface LemburPeriod {
  start: string  // yyyy-MM-dd
  end: string    // yyyy-MM-dd
}

/**
 * Periode lembur yang memuat `refDate`: tanggal 16 sampai tanggal 15 bulan berikutnya.
 * Tanggal 1–15 masuk periode yang dimulai 16 bulan sebelumnya;
 * tanggal 16–31 masuk periode yang dimulai 16 bulan itu juga.
 *   12 Agustus 2026 → 16 Juli 2026 s/d 15 Agustus 2026
 *   20 Agustus 2026 → 16 Agustus 2026 s/d 15 September 2026
 */
export function getLemburPeriod(refDate: string | Date): LemburPeriod {
  const ref = typeof refDate === "string" ? new Date(`${refDate}T00:00:00`) : refDate
  const base = isNaN(ref.getTime()) ? new Date() : ref

  const y = base.getFullYear()
  const m = base.getMonth()
  const startMonthOffset = base.getDate() >= 16 ? 0 : -1

  const start = new Date(y, m + startMonthOffset, 16)
  const end = new Date(y, m + startMonthOffset + 1, 15)

  const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  return { start: iso(start), end: iso(end) }
}

export function isInPeriod(tanggal: string, period: LemburPeriod): boolean {
  return tanggal >= period.start && tanggal <= period.end
}
