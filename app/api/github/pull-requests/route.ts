import { NextRequest, NextResponse } from "next/server"
import type { GithubPR } from "@/lib/types"

export const runtime = "nodejs"

interface GithubSearchItem {
  id: number
  number: number
  title: string
  body: string | null
  html_url: string
  labels: Array<{ name: string } | string>
  repository_url: string
  pull_request?: { merged_at: string | null }
}

interface GithubSearchResponse {
  items?: GithubSearchItem[]
}

function repoFromUrl(repositoryUrl: string): string {
  // https://api.github.com/repos/owner/repo  ->  owner/repo
  const m = repositoryUrl.match(/\/repos\/([^/]+\/[^/]+)$/)
  return m ? m[1] : ""
}

export async function POST(req: NextRequest) {
  try {
    const { url, token, dateFrom, dateTo } = await req.json()

    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Token GitHub wajib diisi" }, { status: 400 })
    }
    if (!dateFrom || !dateTo) {
      return NextResponse.json(
        { error: "Rentang tanggal periode harus diisi" },
        { status: 400 }
      )
    }

    const baseUrl = (url && typeof url === "string" ? url : "https://api.github.com")
      .trim()
      .replace(/\/+$/, "")

    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "weekly-report-app",
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15000)

    try {
      // 1) Ambil username dari token agar bisa memfilter author.
      const userRes = await fetch(`${baseUrl}/user`, {
        headers,
        signal: controller.signal,
      })
      if (userRes.status === 401) {
        return NextResponse.json(
          { error: "Token GitHub tidak valid atau sudah kadaluarsa" },
          { status: 401 }
        )
      }
      if (!userRes.ok) {
        return NextResponse.json(
          { error: `GitHub merespons dengan status ${userRes.status}` },
          { status: userRes.status }
        )
      }
      const user = (await userRes.json()) as { login?: string }
      const login = user.login
      if (!login) {
        return NextResponse.json(
          { error: "Tidak bisa membaca username GitHub dari token" },
          { status: 502 }
        )
      }

      // 2) Cari PR milik user yang merged dalam rentang tanggal.
      const q = `type:pr author:${login} is:merged merged:${dateFrom}..${dateTo}`
      const params = new URLSearchParams({
        q,
        per_page: "100",
        sort: "updated",
        order: "desc",
      })
      const searchRes = await fetch(`${baseUrl}/search/issues?${params.toString()}`, {
        headers,
        signal: controller.signal,
      })
      if (!searchRes.ok) {
        return NextResponse.json(
          { error: `GitHub merespons dengan status ${searchRes.status}` },
          { status: searchRes.status }
        )
      }

      const data = (await searchRes.json()) as GithubSearchResponse
      const items = data.items ?? []

      const pullRequests: GithubPR[] = items
        .map((it) => ({
          id: it.id,
          number: it.number,
          title: it.title,
          description: it.body ?? "",
          webUrl: it.html_url,
          labels: Array.isArray(it.labels)
            ? it.labels.map((l) => (typeof l === "string" ? l : l.name)).filter(Boolean)
            : [],
          mergedAt: it.pull_request?.merged_at ?? "",
          repo: repoFromUrl(it.repository_url),
        }))
        .filter((pr) => pr.mergedAt)
        .sort((a, b) => new Date(b.mergedAt).getTime() - new Date(a.mergedAt).getTime())

      return NextResponse.json({ pullRequests })
    } finally {
      clearTimeout(timer)
    }
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error)
    console.error("GitHub PR fetch error:", errMsg)

    if (error instanceof Error && error.name === "AbortError") {
      return NextResponse.json(
        { error: "Request ke GitHub timeout (15 detik). Coba lagi." },
        { status: 504 }
      )
    }

    return NextResponse.json(
      { error: "Gagal menghubungi GitHub. Periksa URL API dan koneksi Anda." },
      { status: 502 }
    )
  }
}
