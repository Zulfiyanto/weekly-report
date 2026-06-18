import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"

const MAX_BYTES = 10 * 1024 * 1024 // 10MB batas aman per gambar

export async function POST(req: NextRequest) {
  try {
    const { url, token, imageUrl } = await req.json()

    if (!url || typeof url !== "string" || !token || typeof token !== "string") {
      return NextResponse.json({ error: "Konfigurasi GitLab tidak lengkap" }, { status: 400 })
    }
    if (!imageUrl || typeof imageUrl !== "string") {
      return NextResponse.json({ error: "URL gambar wajib diisi" }, { status: 400 })
    }

    // Keamanan: hanya izinkan mengambil dari host GitLab yang dikonfigurasi
    // (mencegah token bocor ke host sembarangan / SSRF).
    let base: URL
    let target: URL
    try {
      base = new URL(url)
      target = new URL(imageUrl, base) // resolusi relatif terhadap base bila perlu
    } catch {
      return NextResponse.json({ error: "URL tidak valid" }, { status: 400 })
    }
    if (target.host !== base.host) {
      return NextResponse.json(
        { error: "URL gambar bukan dari host GitLab yang dikonfigurasi" },
        { status: 400 }
      )
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15000)

    let res: Response
    try {
      res = await fetch(target.toString(), {
        headers: { "PRIVATE-TOKEN": token },
        signal: controller.signal,
        redirect: "follow",
      })
    } finally {
      clearTimeout(timer)
    }

    if (res.status === 401 || res.status === 403) {
      return NextResponse.json(
        { error: "Tidak punya akses ke gambar ini (token/permission)" },
        { status: res.status }
      )
    }
    if (!res.ok) {
      return NextResponse.json(
        { error: `GitLab merespons status ${res.status}` },
        { status: res.status }
      )
    }

    const contentType = res.headers.get("content-type") || ""
    if (!contentType.startsWith("image/")) {
      return NextResponse.json(
        { error: "Respons bukan gambar (mungkin halaman login)" },
        { status: 415 }
      )
    }

    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.byteLength > MAX_BYTES) {
      return NextResponse.json({ error: "Gambar terlalu besar" }, { status: 413 })
    }

    const dataUrl = `data:${contentType};base64,${buf.toString("base64")}`
    return NextResponse.json({ dataUrl })
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "AbortError") {
      return NextResponse.json({ error: "Request gambar timeout (15 detik)" }, { status: 504 })
    }
    const msg = error instanceof Error ? error.message : String(error)
    console.error("GitLab image fetch error:", msg)
    return NextResponse.json({ error: "Gagal mengambil gambar dari GitLab" }, { status: 502 })
  }
}
