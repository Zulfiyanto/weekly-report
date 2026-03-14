import { Document, Page, Text, View, StyleSheet, Image, Font, pdf } from "@react-pdf/renderer"
import { format } from "date-fns"
import { id } from "date-fns/locale"

// ── Register Roboto font ──────────────────────────────────────────────────────
Font.register({
  family: "Roboto",
  fonts: [
    { src: "https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxP.ttf", fontWeight: 400 },
    { src: "https://fonts.gstatic.com/s/roboto/v30/KFOlCnqEu92Fr1MmEU9vAw.ttf", fontWeight: 500 },
    { src: "https://fonts.gstatic.com/s/roboto/v30/KFOlCnqEu92Fr1MmWUlfBBc9.ttf", fontWeight: 700 },
    { src: "https://fonts.gstatic.com/s/roboto/v30/KFOkCnqEu92Fr1Mu51xIIzc.ttf", fontWeight: 400, fontStyle: "italic" },
  ],
})

const BLUE = "#1d4ed8"
const BLUE_LIGHT = "#eff6ff"
const BLUE_MID = "#dbeafe"
const TEXT_DARK = "#111827"
const TEXT_MID = "#374151"
const TEXT_MUTED = "#6b7280"
const BORDER = "#e5e7eb"
const WHITE = "#ffffff"

const styles = StyleSheet.create({
  page: {
    fontFamily: "Roboto",
    fontSize: 10,
    color: TEXT_MID,
    backgroundColor: WHITE,
    paddingBottom: 56,
  },

  // ── Header ──────────────────────────────────────────────────────────────────
  header: {
    backgroundColor: BLUE,
    paddingVertical: 28,
    paddingHorizontal: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: { flex: 1 },
  headerTitle: {
    fontFamily: "Roboto",
    fontWeight: 700,
    fontSize: 26,
    color: WHITE,
    letterSpacing: 3,
  },
  headerSub: {
    fontSize: 9,
    color: "#bfdbfe",
    marginTop: 3,
    letterSpacing: 1,
  },
  headerBadge: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  headerBadgeText: {
    fontSize: 8,
    color: WHITE,
    fontWeight: 500,
    letterSpacing: 0.5,
  },

  // ── Meta Box ─────────────────────────────────────────────────────────────────
  metaWrapper: {
    marginHorizontal: 44,
    marginTop: 22,
    marginBottom: 24,
    backgroundColor: BLUE_LIGHT,
    borderRadius: 8,
    borderLeft: `3pt solid ${BLUE}`,
    padding: 14,
  },
  metaRow: { flexDirection: "row", marginBottom: 5 },
  metaLabel: {
    width: 64,
    fontSize: 9,
    fontWeight: 700,
    color: BLUE,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  metaColon: { width: 10, fontSize: 10, color: TEXT_MUTED },
  metaValue: { flex: 1, fontSize: 10, color: TEXT_DARK, fontWeight: 500 },

  // ── Section ──────────────────────────────────────────────────────────────────
  sectionWrapper: { paddingHorizontal: 44, marginBottom: 20 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
    paddingBottom: 6,
    borderBottom: `1.5pt solid ${BLUE_MID}`,
  },
  sectionAccent: {
    width: 3,
    height: 14,
    backgroundColor: BLUE,
    borderRadius: 2,
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: TEXT_DARK,
    letterSpacing: 1,
  },

  // ── Work Item ─────────────────────────────────────────────────────────────────
  workItemBlock: { marginBottom: 14 },
  workItemRow: { flexDirection: "row", alignItems: "flex-start" },
  workItemBadge: {
    width: 20,
    height: 20,
    backgroundColor: BLUE_MID,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    marginTop: 1,
    flexShrink: 0,
  },
  workItemBadgeText: {
    fontSize: 8,
    fontWeight: 700,
    color: BLUE,
  },
  workItemText: {
    flex: 1,
    fontSize: 10,
    color: TEXT_MID,
    lineHeight: 1.65,
  },

  // ── Images ───────────────────────────────────────────────────────────────────
  itemImagesWrapper: { marginTop: 10, marginLeft: 30 },
  itemImageContainer: {
    width: "100%",
    marginBottom: 8,
    borderRadius: 6,
    overflow: "hidden",
    border: `1pt solid ${BORDER}`,
  },
  itemImage: { width: "100%", objectFit: "contain" },
  itemImageCaption: {
    fontSize: 7,
    color: TEXT_MUTED,
    textAlign: "center",
    paddingVertical: 4,
    backgroundColor: "#f9fafb",
  },

  // ── Empty ────────────────────────────────────────────────────────────────────
  emptyText: { fontSize: 10, color: TEXT_MUTED, fontStyle: "italic" },

  // ── Footer ───────────────────────────────────────────────────────────────────
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#f9fafb",
    borderTop: `1pt solid ${BORDER}`,
    paddingHorizontal: 44,
    paddingVertical: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerText: { fontSize: 8, color: TEXT_MUTED },
  footerPage: { fontSize: 8, color: TEXT_MUTED },
})

export interface PDFWorkItem {
  id: string
  description: string
  images: string[]
}

export interface PDFDocProps {
  nama: string
  periodeAwal: string
  periodeAkhir: string
  items: PDFWorkItem[]
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "-"
  try {
    return format(new Date(dateStr), "dd MMMM yyyy", { locale: id })
  } catch {
    return dateStr
  }
}

function formatDateShort(dateStr: string): string {
  if (!dateStr) return "-"
  try {
    return format(new Date(dateStr), "dd MMM yyyy", { locale: id })
  } catch {
    return dateStr
  }
}

export function WeeklyReportPDF({ nama, periodeAwal, periodeAkhir, items }: PDFDocProps) {
  const periodeLabel = `${formatDateShort(periodeAwal)} – ${formatDateShort(periodeAkhir)}`

  return (
    <Document>
      <Page size="A4" style={styles.page}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>WEEKLY REPORT</Text>
            <Text style={styles.headerSub}>LAPORAN KERJA MINGGUAN</Text>
          </View>
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>{periodeLabel}</Text>
          </View>
        </View>

        {/* ── Meta ── */}
        <View style={styles.metaWrapper}>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Nama</Text>
            <Text style={styles.metaColon}>:</Text>
            <Text style={styles.metaValue}>{nama || "-"}</Text>
          </View>
          <View style={[styles.metaRow, { marginBottom: 0 }]}>
            <Text style={styles.metaLabel}>Periode</Text>
            <Text style={styles.metaColon}>:</Text>
            <Text style={styles.metaValue}>
              {formatDate(periodeAwal)} – {formatDate(periodeAkhir)}
            </Text>
          </View>
        </View>

        {/* ── Ringkasan Pekerjaan ── */}
        <View style={styles.sectionWrapper}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionAccent} />
            <Text style={styles.sectionTitle}>RINGKASAN PEKERJAAN</Text>
          </View>

          {items.length === 0 ? (
            <Text style={styles.emptyText}>Tidak ada pekerjaan yang dicatat.</Text>
          ) : (
            items.map((item, idx) => (
              <View key={item.id} style={styles.workItemBlock}>
                <View style={styles.workItemRow}>
                  <View style={styles.workItemBadge}>
                    <Text style={styles.workItemBadgeText}>{idx + 1}</Text>
                  </View>
                  <Text style={styles.workItemText}>{item.description}</Text>
                </View>

                {item.images.length > 0 && (
                  <View style={styles.itemImagesWrapper}>
                    {item.images.map((src, imgIdx) => (
                      <View key={imgIdx} style={styles.itemImageContainer}>
                        <Image src={src} style={styles.itemImage} />
                        <Text style={styles.itemImageCaption}>
                          Bukti {idx + 1}.{imgIdx + 1}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ))
          )}
        </View>

        {/* ── Footer ── */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Weekly Report — {nama} — {periodeLabel}</Text>
          <Text
            style={styles.footerPage}
            render={({ pageNumber, totalPages }) => `Halaman ${pageNumber} dari ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  )
}

export async function generatePDF(data: PDFDocProps): Promise<Blob> {
  const blob = await pdf(<WeeklyReportPDF {...data} />).toBlob()
  return blob
}

export function getPDFFileName(nama: string, periodeAwal: string, periodeAkhir: string): string {
  const n = nama.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "")
  const start = periodeAwal ? periodeAwal.slice(0, 10) : "start"
  const end = periodeAkhir ? periodeAkhir.slice(0, 10) : "end"
  return `weekly-report_${n}_${start}_${end}.pdf`
}
