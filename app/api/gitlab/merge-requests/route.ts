import { NextRequest, NextResponse } from "next/server"
import type { GitlabMR } from "@/lib/types"

export const runtime = "nodejs"

interface GitlabMRResponse {
  id: number
  iid: number
  project_id: number
  title: string
  description: string | null
  web_url: string
  labels: string[]
  merged_at: string | null
  references?: { full?: string }
}

export async function POST(req: NextRequest) {
  try {
    const { url, token, dateFrom, dateTo } = await req.json()

    if (!url || typeof url !== "string" || !token || typeof token !== "string") {
      return NextResponse.json(
        { error: "URL GitLab dan token wajib diisi" },
        { status: 400 }
      )
    }
    if (!dateFrom || !dateTo) {
      return NextResponse.json(
        { error: "Rentang tanggal periode harus diisi" },
        { status: 400 }
      )
    }

    const baseUrl = url.trim().replace(/\/+$/, "")
    const params = new URLSearchParams({
      scope: "created_by_me",
      state: "merged",
      updated_after: `${dateFrom}T00:00:00Z`,
      order_by: "updated_at",
      per_page: "100",
    })
    const endpoint = `${baseUrl}/api/v4/merge_requests?${params.toString()}`

    // 15-second timeout via AbortController
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15000)

    let res: Response
    try {
      res = await fetch(endpoint, {
        headers: { "PRIVATE-TOKEN": token },
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timer)
    }

    if (res.status === 401) {
      return NextResponse.json(
        { error: "Token GitLab tidak valid atau sudah kadaluarsa" },
        { status: 401 }
      )
    }
    if (!res.ok) {
      return NextResponse.json(
        { error: `GitLab merespons dengan status ${res.status}` },
        { status: res.status }
      )
    }

    const data = (await res.json()) as GitlabMRResponse[]

    // GitLab tidak menjamin filter merged date, jadi filter di sini.
    // Rentang inklusif: dateFrom 00:00 s/d dateTo 23:59:59.
    const from = new Date(`${dateFrom}T00:00:00Z`).getTime()
    const to = new Date(`${dateTo}T23:59:59Z`).getTime()

    const mergeRequests: GitlabMR[] = data
      .filter((mr) => {
        if (!mr.merged_at) return false
        const t = new Date(mr.merged_at).getTime()
        return t >= from && t <= to
      })
      .map((mr) => ({
        id: mr.id,
        iid: mr.iid,
        projectId: mr.project_id,
        title: mr.title,
        description: mr.description ?? "",
        webUrl: mr.web_url,
        labels: Array.isArray(mr.labels) ? mr.labels : [],
        mergedAt: mr.merged_at as string,
        projectPath: mr.references?.full?.split("!")[0] ?? "",
      }))
      .sort((a, b) => new Date(b.mergedAt).getTime() - new Date(a.mergedAt).getTime())

    return NextResponse.json({ mergeRequests })
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error)
    console.error("GitLab MR fetch error:", errMsg)

    if (error instanceof Error && error.name === "AbortError") {
      return NextResponse.json(
        { error: "Request ke GitLab timeout (15 detik). Coba lagi." },
        { status: 504 }
      )
    }

    return NextResponse.json(
      { error: "Gagal menghubungi GitLab. Periksa URL instance dan koneksi Anda." },
      { status: 502 }
    )
  }
}
