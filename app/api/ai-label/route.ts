import { GoogleGenerativeAI } from "@google/generative-ai"
import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const { title, description } = await req.json()

    if (!title && !description) {
      return NextResponse.json(
        { error: "Judul atau deskripsi harus diisi" },
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

    const content = [title, description].filter(Boolean).join(" — ")
    const prompt = `Kamu adalah asisten labeling untuk laporan kerja. Berikan maksimal 3 label/tag singkat (1-2 kata) yang paling relevan untuk item pekerjaan berikut. Label harus dalam Bahasa Indonesia, singkat, dan umum digunakan di lingkungan kerja (contoh: Meeting, Review, Dokumentasi, Development, Testing, Deployment, Koordinasi, Analisis, Desain, Laporan). Balas HANYA dengan JSON array string, tanpa penjelasan apapun. Contoh: ["Meeting","Review","Dokumentasi"]\n\nItem: ${content}`

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("REQUEST_TIMEOUT")), 15000)
    )

    const generate = model.generateContent(prompt)
    const result = await Promise.race([generate, timeout])

    const raw = result.response.text().trim()
    // Extract JSON array from response
    const match = raw.match(/\[[\s\S]*\]/)
    if (!match) throw new Error("Format respons tidak valid")

    const labels: string[] = JSON.parse(match[0])
    if (!Array.isArray(labels)) throw new Error("Format respons tidak valid")

    const cleaned = labels
      .filter((l) => typeof l === "string" && l.trim().length > 0)
      .map((l) => l.trim().slice(0, 20))
      .slice(0, 3)

    return NextResponse.json({ labels: cleaned })
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error)
    const errStatus = (error as { status?: number })?.status

    if (errMsg === "REQUEST_TIMEOUT") {
      return NextResponse.json(
        { error: "Request timeout. Coba lagi." },
        { status: 504 }
      )
    }
    if (errStatus === 429) {
      return NextResponse.json(
        { error: "Terlalu banyak request. Coba lagi." },
        { status: 429 }
      )
    }

    return NextResponse.json(
      { error: errMsg || "Gagal generate label." },
      { status: errStatus ?? 500 }
    )
  }
}
