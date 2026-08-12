import { Document, Page, Text, View, StyleSheet, Image, pdf } from "@react-pdf/renderer"
import { format } from "date-fns"
import { id } from "date-fns/locale"
import { ensureFonts } from "./pdfGenerator"
import type { LemburProfile } from "./types"

// ── Palet dokumen resmi — sengaja tanpa tema warna ────────────────────────────
const INK = "#111827"
const INK_SOFT = "#374151"
const MUTED = "#6b7280"
const LINE = "#9ca3af"
const HEAD_BG = "#f3f4f6"
const ZEBRA_BG = "#fafafa"

const BORDER = `0.75pt solid ${LINE}`

// Lebar kolom tabel kegiatan & tabel evidence
const COL = { no: "7%", uraian: "43%", tanggal: "20%", waktu: "15%", lokasi: "15%" } as const
const EV_COL = { no: "7%", dok: "58%", ket: "35%" } as const

const styles = StyleSheet.create({
  page: {
    fontFamily: "Roboto",
    fontSize: 10,
    color: INK_SOFT,
    backgroundColor: "#ffffff",
    paddingTop: 40,
    paddingHorizontal: 40,
    paddingBottom: 56,
    // Catatan: jangan taruh `lineHeight` di sini. Nilai lineHeight pada style
    // Page membuat footer ber-`position: absolute` gagal dirender oleh react-pdf.
    // Atur lineHeight per style teks di bawah.
  },

  // ── Judul ──────────────────────────────────────────────────────────────────
  title: {
    fontSize: 15,
    fontWeight: 700,
    color: INK,
    textAlign: "center",
    letterSpacing: 0.5,
  },
  titleRule: {
    marginTop: 6,
    marginBottom: 18,
    borderBottom: `1pt solid ${INK}`,
  },

  // ── Paragraf pembuka ───────────────────────────────────────────────────────
  paragraph: { fontSize: 10, color: INK_SOFT, marginBottom: 4, lineHeight: 1.5 },
  /** Nilai isian — bergaris bawah, meniru titik-titik isian dokumen asli. */
  fill: { color: INK, fontWeight: 500, borderBottom: `0.75pt solid ${INK}` },

  // ── Blok identitas ─────────────────────────────────────────────────────────
  identityBlock: { marginTop: 8, marginBottom: 12 },
  identityRow: { flexDirection: "row", marginBottom: 3 },
  identityLabel: { width: 96, fontSize: 10, color: INK_SOFT, lineHeight: 1.5 },
  identityColon: { width: 10, fontSize: 10, color: INK_SOFT, lineHeight: 1.5 },
  identityValue: { flex: 1, fontSize: 10, color: INK, fontWeight: 500, lineHeight: 1.5 },

  // ── Tabel ──────────────────────────────────────────────────────────────────
  table: {
    borderTop: BORDER,
    borderLeft: BORDER,
    marginBottom: 18,
  },
  row: { flexDirection: "row" },
  rowZebra: { backgroundColor: ZEBRA_BG },
  headRow: { backgroundColor: HEAD_BG },
  cell: {
    borderRight: BORDER,
    borderBottom: BORDER,
    paddingVertical: 5,
    paddingHorizontal: 5,
    justifyContent: "flex-start",
  },
  headCellText: {
    fontSize: 9.5,
    fontWeight: 700,
    color: INK,
    textAlign: "center",
  },
  cellText: { fontSize: 9.5, color: INK_SOFT, lineHeight: 1.45 },
  cellTextCenter: { fontSize: 9.5, color: INK_SOFT, textAlign: "center", lineHeight: 1.45 },

  // ── Evidence ───────────────────────────────────────────────────────────────
  sectionLabel: {
    fontSize: 10,
    fontWeight: 700,
    color: INK,
    marginBottom: 6,
  },
  evidenceImage: {
    width: "100%",
    maxHeight: 210,
    objectFit: "contain",
    marginBottom: 4,
  },

  // ── Tanda tangan ───────────────────────────────────────────────────────────
  signWrapper: { flexDirection: "row", marginTop: 28 },
  signCol: { width: "50%", alignItems: "center" },
  signRole: { fontSize: 10, color: INK_SOFT },
  signGap: { height: 62 },
  /** Ruang tanda tangan — tingginya sama dengan signGap agar kedua kolom sejajar. */
  signImageBox: {
    height: 62,
    width: "100%",
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  // width 100% + contain: tanda tangan selebar apa pun tetap terkurung di kolomnya
  signImage: { width: "100%", height: 58, objectFit: "contain" },
  signName: {
    fontSize: 10,
    fontWeight: 700,
    color: INK,
    borderTop: `0.75pt solid ${INK}`,
    paddingTop: 3,
    paddingHorizontal: 14,
    textAlign: "center",
  },

  // ── Footer ─────────────────────────────────────────────────────────────────
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 40,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  footerText: { fontSize: 8, color: MUTED },
})

// ── Formatter ─────────────────────────────────────────────────────────────────

/** "2026-07-18" → "18 Juli 2026" */
export function formatTanggalIndo(dateStr: string): string {
  if (!dateStr) return "-"
  try {
    return format(new Date(`${dateStr}T00:00:00`), "d MMMM yyyy", { locale: id })
  } catch {
    return dateStr
  }
}

/** "2026-08-12" → { hari: "12", bulan: "Agustus", tahun: "2026" } */
export function splitTanggalDokumen(dateStr: string): { hari: string; bulan: string; tahun: string } {
  if (!dateStr) return { hari: "-", bulan: "-", tahun: "-" }
  try {
    const d = new Date(`${dateStr}T00:00:00`)
    return {
      hari: format(d, "d", { locale: id }),
      bulan: format(d, "MMMM", { locale: id }),
      tahun: format(d, "yyyy", { locale: id }),
    }
  } catch {
    return { hari: dateStr, bulan: "-", tahun: "-" }
  }
}

/** ("10:00", "17:00") → "10.00 - 17.00" */
export function formatWaktu(jamMulai: string, jamSelesai: string): string {
  const a = (jamMulai || "").replace(":", ".")
  const b = (jamSelesai || "").replace(":", ".")
  if (!a && !b) return "-"
  if (!b) return a
  if (!a) return b
  return `${a} - ${b}`
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface LemburPDFItem {
  id: string
  uraian: string
  tanggal: string      // yyyy-MM-dd
  jamMulai: string     // HH:mm
  jamSelesai: string   // HH:mm
  lokasi: string
  keterangan: string
  images: string[]     // data URL
}

export interface LemburPDFProps extends LemburProfile {
  tanggalDokumen: string
  items: LemburPDFItem[]
  /** Data URL PNG tanda tangan; bila kosong ruangnya dibiarkan untuk tanda tangan basah. */
  ttdPekerja?: string
  ttdManager?: string
}

/** Ruang tanda tangan: gambar bila ada, kalau tidak ruang kosong setinggi sama. */
function RuangTtd({ src }: { src?: string }) {
  if (!src) return <View style={styles.signGap} />
  return (
    <View style={styles.signImageBox}>
      {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf <Image> tidak punya prop alt */}
      <Image src={src} style={styles.signImage} />
    </View>
  )
}

// ── Dokumen ───────────────────────────────────────────────────────────────────

function ActivityTableHeader() {
  return (
    <View style={[styles.row, styles.headRow]} fixed>
      <View style={[styles.cell, { width: COL.no }]}><Text style={styles.headCellText}>No</Text></View>
      <View style={[styles.cell, { width: COL.uraian }]}><Text style={styles.headCellText}>Uraian Kegiatan</Text></View>
      <View style={[styles.cell, { width: COL.tanggal }]}><Text style={styles.headCellText}>Tanggal</Text></View>
      <View style={[styles.cell, { width: COL.waktu }]}><Text style={styles.headCellText}>Waktu</Text></View>
      <View style={[styles.cell, { width: COL.lokasi }]}><Text style={styles.headCellText}>Lokasi</Text></View>
    </View>
  )
}

function EvidenceTableHeader() {
  // Sengaja TIDAK `fixed`: barisnya tinggi (satu screenshot per baris) sehingga
  // tabelnya menjulur, dan header fixed ikut tercetak sendirian di halaman
  // terakhir tanpa baris apa pun di bawahnya.
  return (
    <View style={[styles.row, styles.headRow]}>
      <View style={[styles.cell, { width: EV_COL.no }]}><Text style={styles.headCellText}>No</Text></View>
      <View style={[styles.cell, { width: EV_COL.dok }]}><Text style={styles.headCellText}>Dokumentasi</Text></View>
      <View style={[styles.cell, { width: EV_COL.ket }]}><Text style={styles.headCellText}>Keterangan</Text></View>
    </View>
  )
}

export function LemburReportPDF({
  nama,
  nipp,
  jabatan,
  namaPekerjaan,
  namaManager,
  tanggalDokumen,
  items,
  ttdPekerja,
  ttdManager,
}: LemburPDFProps) {
  const { hari, bulan, tahun } = splitTanggalDokumen(tanggalDokumen)
  const evidenceItems = items.filter((it) => it.images.length > 0)

  return (
    <Document>
      <Page size="A4" style={styles.page} wrap>

        {/* ── Judul ── */}
        <Text style={styles.title}>LAPORAN PELAKSANAAN LEMBUR</Text>
        <View style={styles.titleRule} />

        {/* ── Paragraf pembuka ── */}
        <Text style={styles.paragraph}>
          Dokumen dibuat pada hari ini tanggal <Text style={styles.fill}>{hari}</Text>
          {" "}bulan <Text style={styles.fill}>{bulan}</Text>
          {" "}tahun <Text style={styles.fill}>{tahun}</Text>.
        </Text>
        <Text style={styles.paragraph}>
          Telah dilaksanakan Lembur Pekerjaan <Text style={styles.fill}>{namaPekerjaan || "-"}</Text>.
        </Text>
        <Text style={styles.paragraph}>Yang dilaksanakan oleh :</Text>

        {/* ── Identitas ── */}
        <View style={styles.identityBlock}>
          <View style={styles.identityRow}>
            <Text style={styles.identityLabel}>Nama dan NIPP</Text>
            <Text style={styles.identityColon}>:</Text>
            <Text style={styles.identityValue}>
              {nama || "-"}{nipp ? ` / ${nipp}` : ""}
            </Text>
          </View>
          <View style={styles.identityRow}>
            <Text style={styles.identityLabel}>Jabatan</Text>
            <Text style={styles.identityColon}>:</Text>
            <Text style={styles.identityValue}>{jabatan || "-"}</Text>
          </View>
        </View>

        <Text style={[styles.paragraph, { marginBottom: 8 }]}>
          Dengan uraian kegiatan sebagai berikut:
        </Text>

        {/* ── Tabel kegiatan ── */}
        <View style={styles.table}>
          <ActivityTableHeader />
          {items.map((item, idx) => (
            <View
              key={item.id}
              style={[styles.row, ...(idx % 2 === 1 ? [styles.rowZebra] : [])]}
              wrap={false}
            >
              <View style={[styles.cell, { width: COL.no }]}>
                <Text style={styles.cellTextCenter}>{idx + 1}</Text>
              </View>
              <View style={[styles.cell, { width: COL.uraian }]}>
                <Text style={styles.cellText}>{item.uraian}</Text>
              </View>
              <View style={[styles.cell, { width: COL.tanggal }]}>
                <Text style={styles.cellTextCenter}>{formatTanggalIndo(item.tanggal)}</Text>
              </View>
              <View style={[styles.cell, { width: COL.waktu }]}>
                <Text style={styles.cellTextCenter}>{formatWaktu(item.jamMulai, item.jamSelesai)}</Text>
              </View>
              <View style={[styles.cell, { width: COL.lokasi }]}>
                <Text style={styles.cellTextCenter}>{item.lokasi}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* ── Tabel evidence ── */}
        {evidenceItems.length > 0 && (
          // Mulai di halaman baru: barisnya tinggi (berisi screenshot), sehingga bila
          // dibiarkan mengalir, header tabelnya kerap tertinggal sendirian di akhir halaman.
          <View break>
            <Text style={styles.sectionLabel}>Evidence Pelaksanaan Lembur:</Text>
            <View style={styles.table}>
              <EvidenceTableHeader />
              {evidenceItems.map((item, idx) => (
                <View key={item.id} style={styles.row} wrap={false}>
                  <View style={[styles.cell, { width: EV_COL.no }]}>
                    <Text style={styles.cellTextCenter}>{idx + 1}</Text>
                  </View>
                  <View style={[styles.cell, { width: EV_COL.dok }]}>
                    {item.images.map((src, i) => (
                      // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf <Image> tidak punya prop alt
                      <Image key={i} src={src} style={styles.evidenceImage} />
                    ))}
                  </View>
                  <View style={[styles.cell, { width: EV_COL.ket }]}>
                    <Text style={styles.cellText}>{item.keterangan || item.uraian}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── Tanda tangan ── */}
        <View style={styles.signWrapper} wrap={false}>
          <View style={styles.signCol}>
            <Text style={styles.signRole}>Mengetahui,</Text>
            <Text style={styles.signRole}>Manager Unit Kerja</Text>
            <RuangTtd src={ttdManager} />
            <Text style={styles.signName}>{namaManager || "-"}</Text>
          </View>
          <View style={styles.signCol}>
            <Text style={styles.signRole}>Pekerja</Text>
            {/* Baris kosong agar nama sejajar dengan kolom kiri yang punya dua baris jabatan */}
            <Text style={styles.signRole}> </Text>
            <RuangTtd src={ttdPekerja} />
            <Text style={styles.signName}>{nama || "-"}</Text>
          </View>
        </View>

        {/* ── Footer ── */}
        <View style={styles.footer} fixed>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) => `Halaman ${pageNumber} dari ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  )
}

export async function generateLemburPDF(data: LemburPDFProps): Promise<Blob> {
  ensureFonts()
  return await pdf(<LemburReportPDF {...data} />).toBlob()
}

export function getLemburPDFFileName(nama: string, tanggalDokumen: string): string {
  const n = nama.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "")
  const tgl = tanggalDokumen ? tanggalDokumen.slice(0, 10) : "tanggal"
  return `laporan-lembur_${n}_${tgl}.pdf`
}
