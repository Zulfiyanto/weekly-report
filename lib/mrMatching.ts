/** Baris lembur yang bisa jadi tujuan pengisian. */
export interface MatchTarget {
  id: string
  tanggal: string // yyyy-MM-dd
}

export const DEFAULT_TOLERANCE_DAYS = 3

const DAY_MS = 86_400_000

/** Selisih hari antara dua tanggal yyyy-MM-dd (dihitung di UTC agar bebas zona waktu). */
export function selisihHari(a: string, b: string): number {
  const ta = Date.parse(`${a}T00:00:00Z`)
  const tb = Date.parse(`${b}T00:00:00Z`)
  if (isNaN(ta) || isNaN(tb)) return Number.POSITIVE_INFINITY
  return Math.round(Math.abs(ta - tb) / DAY_MS)
}

export interface MrAssignment<T> {
  item: T
  /** Baris tujuan, null bila tidak ada yang cukup dekat. */
  targetId: string | null
  /** Selisih hari ke baris tujuan (Infinity bila tidak ada tujuan). */
  jarak: number
}

export interface MatchResult<T> {
  /** Urut sama dengan input, supaya bisa ditampilkan berdampingan dengan daftar MR. */
  assignments: MrAssignment<T>[]
  /** targetId → item yang jatuh ke baris itu, urut menaik berdasarkan tanggal item. */
  perTarget: Map<string, T[]>
  unmatched: T[]
}

/**
 * Cocokkan tiap item ke baris lembur yang tanggalnya paling dekat.
 * Item yang jarak terdekatnya melebihi `toleranceDays` dianggap tanpa pasangan.
 * Bila ada dua baris berjarak sama, baris yang tanggalnya lebih awal dipakai.
 */
export function matchByDate<T>(
  items: T[],
  getTanggal: (item: T) => string,
  targets: MatchTarget[],
  toleranceDays: number = DEFAULT_TOLERANCE_DAYS
): MatchResult<T> {
  const valid = targets.filter((t) => t.tanggal)
  const urutTarget = [...valid].sort((a, b) => a.tanggal.localeCompare(b.tanggal))

  const assignments: MrAssignment<T>[] = items.map((item) => {
    const tanggal = getTanggal(item)
    if (!tanggal || urutTarget.length === 0) {
      return { item, targetId: null, jarak: Number.POSITIVE_INFINITY }
    }
    let best: MatchTarget | null = null
    let bestJarak = Number.POSITIVE_INFINITY
    for (const t of urutTarget) {
      const d = selisihHari(tanggal, t.tanggal)
      if (d < bestJarak) {
        bestJarak = d
        best = t
      }
    }
    if (!best || bestJarak > toleranceDays) {
      return { item, targetId: null, jarak: bestJarak }
    }
    return { item, targetId: best.id, jarak: bestJarak }
  })

  const perTarget = new Map<string, T[]>()
  const unmatched: T[] = []
  for (const a of assignments) {
    if (a.targetId === null) {
      unmatched.push(a.item)
      continue
    }
    const list = perTarget.get(a.targetId)
    if (list) list.push(a.item)
    else perTarget.set(a.targetId, [a.item])
  }
  for (const list of perTarget.values()) {
    list.sort((x, y) => getTanggal(x).localeCompare(getTanggal(y)))
  }

  return { assignments, perTarget, unmatched }
}

export interface BagiSisaResult<T> {
  perTarget: Map<string, T[]>
  /** Baris yang terisi dari sisa, bukan dari kedekatan tanggal. */
  dariSisa: Set<string>
  /** Item yang tetap tidak terpakai (hanya bila tidak ada baris kosong sama sekali). */
  belumTerpakai: T[]
}

/**
 * Isi baris yang masih kosong dengan MENGABAIKAN kedekatan tanggal, memakai:
 *   1. item yang tidak dapat pasangan tanggal sama sekali, lalu
 *   2. item berlebih dari baris yang menumpuk — baris yang kebagian banyak item
 *      toh hanya menampilkan beberapa saja, jadi kelebihannya lebih berguna
 *      dipindah ke baris kosong daripada terbuang.
 * Baris yang menyumbang tetap menyisakan minimal satu item.
 * Pembagiannya bergiliran supaya tiap baris kosong kebagian satu dulu.
 */
export function bagikanSisa<T>(
  perTarget: Map<string, T[]>,
  targets: MatchTarget[],
  sisa: T[],
  urutkan?: (a: T, b: T) => number
): BagiSisaResult<T> {
  const hasil = new Map<string, T[]>([...perTarget].map(([k, v]) => [k, [...v]]))
  const dariSisa = new Set<string>()

  const kosong = targets
    .filter((t) => t.tanggal && (hasil.get(t.id)?.length ?? 0) === 0)
    .sort((a, b) => a.tanggal.localeCompare(b.tanggal))

  if (kosong.length === 0) {
    return { perTarget: hasil, dariSisa, belumTerpakai: sisa }
  }

  const antrian = urutkan ? [...sisa].sort(urutkan) : [...sisa]

  // Belum cukup untuk semua baris kosong → ambil kelebihan dari baris terpadat
  while (antrian.length < kosong.length) {
    let terpadat: string | null = null
    let jumlah = 1
    for (const [id, list] of hasil) {
      if (list.length > jumlah) {
        jumlah = list.length
        terpadat = id
      }
    }
    if (!terpadat) break
    const item = hasil.get(terpadat)!.pop()
    if (!item) break
    antrian.push(item)
  }

  if (antrian.length === 0) {
    return { perTarget: hasil, dariSisa, belumTerpakai: [] }
  }

  antrian.forEach((item, i) => {
    const target = kosong[i % kosong.length]
    const list = hasil.get(target.id)
    if (list) list.push(item)
    else hasil.set(target.id, [item])
    dariSisa.add(target.id)
  })

  return { perTarget: hasil, dariSisa, belumTerpakai: [] }
}
