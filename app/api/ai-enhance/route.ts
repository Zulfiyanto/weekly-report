import { NextRequest, NextResponse } from "next/server"

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
const GROQ_MODEL = "llama-3.3-70b-versatile"

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json()

    if (!text || typeof text !== "string" || text.trim().length < 5) {
      return NextResponse.json(
        { error: "Teks terlalu pendek untuk dirapikan (minimal 5 karakter)" },
        { status: 400 }
      )
    }

    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: "API key belum dikonfigurasi" },
        { status: 500 }
      )
    }

    const systemPrompt =
      "Kamu adalah asisten untuk menulis laporan kerja mingguan dalam Bahasa Indonesia yang profesional dan formal. Ubah teks dari pengguna menjadi satu kalimat laporan yang jelas dan profesional, tanpa mengubah makna aslinya. Balas hanya dengan kalimat hasil tanpa tambahan apapun, tanda kutip, atau penjelasan."

    // 15-second timeout via AbortController
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15000)

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
          temperature: 0.3,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: text.trim() },
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

      if (res.status === 429) {
        return NextResponse.json(
          { error: "Terlalu banyak request. Coba lagi dalam beberapa detik." },
          { status: 429 }
        )
      }
      return NextResponse.json(
        { error: "Gagal memproses teks. Silakan coba lagi." },
        { status: res.status }
      )
    }

    const data = await res.json()
    const enhanced = data?.choices?.[0]?.message?.content?.trim()

    if (!enhanced) {
      return NextResponse.json(
        { error: "Tidak ada hasil dari AI. Coba lagi." },
        { status: 502 }
      )
    }

    return NextResponse.json({ enhanced })
  } catch (error: unknown) {
    const isAbort = error instanceof Error && error.name === "AbortError"
    const errMsg = error instanceof Error ? error.message : String(error)

    console.error("AI enhance error:", { message: errMsg, raw: error })

    if (isAbort) {
      return NextResponse.json(
        { error: "Request timeout (15 detik). Coba lagi." },
        { status: 504 }
      )
    }

    return NextResponse.json(
      { error: "Gagal memproses teks. Silakan coba lagi." },
      { status: 500 }
    )
  }
}
