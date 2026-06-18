import { GoogleGenerativeAI } from "@google/generative-ai"
import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json()

    if (!text || typeof text !== "string" || text.trim().length < 5) {
      return NextResponse.json(
        { error: "Teks terlalu pendek untuk dirapikan (minimal 5 karakter)" },
        { status: 400 }
      )
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: "API key belum dikonfigurasi" },
        { status: 500 }
      )
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" })

    const prompt = `Kamu adalah asisten untuk menulis laporan kerja mingguan dalam Bahasa Indonesia yang profesional dan formal. Ubah teks berikut menjadi satu kalimat laporan yang jelas dan profesional, tanpa mengubah makna aslinya. Balas hanya dengan kalimat hasil tanpa tambahan apapun.\n\nTeks: ${text.trim()}`

    // 15-second timeout via Promise.race
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("REQUEST_TIMEOUT")), 15000)
    )

    const generate = model.generateContent(prompt)
    const result = await Promise.race([generate, timeout])

    const enhanced = result.response.text().trim()
    return NextResponse.json({ enhanced })
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error)
    const errStatus = (error as { status?: number })?.status

    console.error("AI enhance error:", { message: errMsg, status: errStatus, raw: error })

    if (errMsg === "REQUEST_TIMEOUT") {
      return NextResponse.json(
        { error: "Request timeout (15 detik). Coba lagi." },
        { status: 504 }
      )
    }
    if (errStatus === 429) {
      return NextResponse.json(
        { error: "Terlalu banyak request. Coba lagi dalam beberapa detik." },
        { status: 429 }
      )
    }

    // Return actual error for debugging
    return NextResponse.json(
      { error: errMsg || "Gagal memproses teks. Silakan coba lagi." },
      { status: errStatus ?? 500 }
    )
  }
}
