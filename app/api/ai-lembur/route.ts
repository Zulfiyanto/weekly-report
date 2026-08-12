import { NextRequest, NextResponse } from "next/server"

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
const GROQ_MODEL = "llama-3.3-70b-versatile"

/** Uraian dijaga ringkas (sel tabel sempit); keterangan bukti boleh lebih panjang. */
export const MAX_URAIAN_CHARS = 130
export const MAX_KETERANGAN_CHARS = 220

const ATURAN_UMUM = `Kamu menulis isi dokumen resmi "Laporan Pelaksanaan Lembur" milik seorang pekerja IT di Indonesia.
Aturan wajib:
- Selalu Bahasa Indonesia baku dan formal.
- Tulis sebagai kegiatan yang SUDAH dikerjakan saat lembur, bukan sebagai judul commit atau catatan teknis.
- Jangan pakai jargon Git: dilarang menulis "MR", "merge request", "commit", "branch", "repo", "PR", "hotfix", "bug fix" (pakai "perbaikan"), dan dilarang menulis prefix seperti feat/fix/chore/refactor.
- Jangan pakai markdown, tanda kutip, tanda bintang, backtick, emoji, atau penomoran.
- Jangan menyebut tanggal atau jam.
- Balas HANYA dengan hasilnya, tanpa penjelasan atau kalimat pembuka.`

function konteksPekerjaan(pekerjaan?: string): string {
  return pekerjaan?.trim() ? `\nNama pekerjaan/proyek: ${pekerjaan.trim()}.` : ""
}

const PROMPT_MR = (pekerjaan?: string) => `${ATURAN_UMUM}${konteksPekerjaan(pekerjaan)}

Pengguna memberi catatan teknis hasil pekerjaan. Ubah menjadi dua teks:
1. "uraian" — SATU frasa kegiatan lembur yang padat, maksimal ${MAX_URAIAN_CHARS} karakter. Ringkas saja inti pekerjaannya; buang detail teknis yang tidak perlu. Awali dengan kata kerja, contoh: "Perbaikan tampilan jadwal kapal pada modul Vessel Schedule".
2. "keterangan" — penjelasan bukti/tangkapan layar dalam DUA sampai TIGA kalimat lengkap, ${Math.round(MAX_KETERANGAN_CHARS * 0.5)}–${MAX_KETERANGAN_CHARS} karakter. Jelaskan bagian aplikasi mana yang dikerjakan, apa yang diubah atau diuji, dan hasil akhirnya. Contoh: "Menampilkan halaman Jadwal Kapal setelah perbaikan tata letak kolom. Estimasi kedatangan dan keberangkatan kini tampil pada kolom yang tepat. Hasil pengujian menunjukkan data tampil sesuai."

Balas HANYA JSON valid dengan bentuk: {"uraian":"...","keterangan":"..."}`

async function panggilGroq(
  apiKey: string,
  systemPrompt: string,
  userContent: string,
  jsonMode: boolean
): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 20000)
  let res: Response
  try {
    res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 0.4,
        ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
      }),
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timer)
  }

  if (!res.ok) {
    const detail = await res.text()
    console.error("Groq API error:", { status: res.status, detail })
    throw Object.assign(new Error("groq"), { status: res.status })
  }

  const data = await res.json()
  const isi = data?.choices?.[0]?.message?.content?.trim()
  if (!isi) throw Object.assign(new Error("kosong"), { status: 502 })
  return isi
}

/** Buang sisa markdown/kutip dan ratakan jadi satu baris. */
function bersihkan(teks: string, maks: number): string {
  return teks
    .replace(/[*_`#>]/g, "")
    .replace(/^["'\s]+|["'\s.]+$/g, "")
    .replace(/\s*\n+\s*/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, maks)
}

function parseJson(isi: string): unknown {
  try {
    return JSON.parse(isi)
  } catch {
    const m = isi.match(/\{[\s\S]*\}/)
    if (!m) return null
    try {
      return JSON.parse(m[0])
    } catch {
      return null
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const mode = body?.mode

    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "API key belum dikonfigurasi" }, { status: 500 })
    }

    // ── Mode "mr": catatan teknis MR → uraian + keterangan ──────────────────
    if (mode === "mr") {
      const text = typeof body.text === "string" ? body.text.trim() : ""
      if (text.length < 5) {
        return NextResponse.json({ error: "Teks terlalu pendek" }, { status: 400 })
      }
      const isi = await panggilGroq(apiKey, PROMPT_MR(body.pekerjaan), text.slice(0, 4000), true)
      const j = parseJson(isi) as { uraian?: string; keterangan?: string } | null
      if (!j?.uraian) {
        return NextResponse.json({ error: "Tidak ada hasil dari AI" }, { status: 502 })
      }
      const uraian = bersihkan(j.uraian, MAX_URAIAN_CHARS)
      return NextResponse.json({
        uraian,
        keterangan: bersihkan(j.keterangan || uraian, MAX_KETERANGAN_CHARS),
      })
    }

    return NextResponse.json({ error: "Mode tidak dikenal" }, { status: 400 })
  } catch (error: unknown) {
    const isAbort = error instanceof Error && error.name === "AbortError"
    const status = (error as { status?: number })?.status
    console.error("AI lembur error:", error)

    if (isAbort) {
      return NextResponse.json({ error: "Request timeout (20 detik). Coba lagi." }, { status: 504 })
    }
    if (status === 429) {
      return NextResponse.json(
        { error: "Terlalu banyak request. Coba lagi dalam beberapa detik." },
        { status: 429 }
      )
    }
    return NextResponse.json({ error: "Gagal memproses teks. Silakan coba lagi." }, { status: 500 })
  }
}
