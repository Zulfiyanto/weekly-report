import { Document, Page, Text, View, StyleSheet, Image, Font, pdf } from "@react-pdf/renderer"
import { format } from "date-fns"
import { id } from "date-fns/locale"
import { type PdfTheme, DEFAULT_THEME } from "./pdfThemes"

// ── Register Roboto font (local — avoids external URL warnings in PDF viewers) ─
let _fontsRegistered = false
function ensureFonts() {
  if (_fontsRegistered) return
  _fontsRegistered = true
  const base = typeof window !== "undefined" ? window.location.origin : ""
  Font.register({
    family: "Roboto",
    fonts: [
      { src: `${base}/fonts/Roboto-Regular.ttf`, fontWeight: 400 },
      { src: `${base}/fonts/Roboto-Medium.ttf`,  fontWeight: 500 },
      { src: `${base}/fonts/Roboto-Bold.ttf`,    fontWeight: 700 },
      { src: `${base}/fonts/Roboto-Italic.ttf`,  fontWeight: 400, fontStyle: "italic" },
    ],
  })
}

const TEXT_DARK = "#111827"
const TEXT_MID = "#374151"
const TEXT_MUTED = "#6b7280"
const BORDER = "#e5e7eb"
const WHITE = "#ffffff"

// ── Cache styles per theme id to avoid re-creating on every render ────────────
const stylesCache = new Map<string, ReturnType<typeof StyleSheet.create>>()

function makeStyles(theme: PdfTheme) {
  if (stylesCache.has(theme.id)) return stylesCache.get(theme.id)!

  const s = StyleSheet.create({
    page: {
      fontFamily: "Roboto",
      fontSize: 10,
      color: TEXT_MID,
      backgroundColor: WHITE,
      paddingTop: 0,
      paddingBottom: 64,
    },

    // ── Continuation header (page 2+) ──────────────────────────────────────────
    pageHeader: {
      backgroundColor: theme.primary,
      paddingVertical: 10,
      paddingHorizontal: 44,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 20,
    },
    pageHeaderTitle: {
      fontSize: 10,
      fontWeight: 700,
      color: WHITE,
      letterSpacing: 2,
    },
    pageHeaderSub: {
      fontSize: 8,
      color: theme.accentText,
    },

    // ── Header ────────────────────────────────────────────────────────────────
    header: {
      backgroundColor: theme.primary,
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
      color: theme.accentText,
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

    // ── Meta Box ──────────────────────────────────────────────────────────────
    metaWrapper: {
      marginHorizontal: 44,
      marginTop: 22,
      marginBottom: 24,
      backgroundColor: theme.primaryLight,
      borderRadius: 8,
      borderLeft: `3pt solid ${theme.primary}`,
      padding: 14,
    },
    metaRow: { flexDirection: "row", marginBottom: 5 },
    metaLabel: {
      width: 64,
      fontSize: 9,
      fontWeight: 700,
      color: theme.primary,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    metaColon: { width: 10, fontSize: 10, color: TEXT_MUTED },
    metaValue: { flex: 1, fontSize: 10, color: TEXT_DARK, fontWeight: 500 },

    // ── Section ───────────────────────────────────────────────────────────────
    sectionWrapper: { paddingHorizontal: 44, marginBottom: 20 },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 14,
      paddingBottom: 6,
      borderBottom: `1.5pt solid ${theme.primaryMid}`,
    },
    sectionAccent: {
      width: 3,
      height: 14,
      backgroundColor: theme.primary,
      borderRadius: 2,
      marginRight: 8,
    },
    sectionTitle: {
      fontSize: 11,
      fontWeight: 700,
      color: TEXT_DARK,
      letterSpacing: 1,
    },

    // ── Work Item ─────────────────────────────────────────────────────────────
    workItemBlock: { marginBottom: 14 },
    workItemRow: { flexDirection: "row", alignItems: "flex-start" },
    workItemBadge: {
      width: 20,
      height: 20,
      backgroundColor: theme.primaryMid,
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
      color: theme.primary,
    },
    workItemContent: { flex: 1 },
    workItemText: {
      fontSize: 10,
      color: TEXT_MID,
      lineHeight: 1.65,
    },

    // ── Tags & Title ──────────────────────────────────────────────────────────
    tagsRow: { flexDirection: "row", flexWrap: "wrap", marginBottom: 4 },
    tagChip: { borderRadius: 3, paddingHorizontal: 5, paddingVertical: 2, marginRight: 4, marginBottom: 2 },
    tagChipText: { fontSize: 7, fontWeight: 700, color: WHITE },
    workItemTitle: { fontSize: 10.5, fontWeight: 700, color: TEXT_DARK, marginBottom: 2 },

    // ── Images ────────────────────────────────────────────────────────────────
    itemImagesWrapper: { marginTop: 12 },
    itemImageContainer: {
      width: "100%",
      height: 260,
      marginBottom: 12,
      borderRadius: 6,
      border: `1pt solid ${BORDER}`,
      backgroundColor: "#f9fafb",
      overflow: "hidden",
    },
    itemImage: {
      width: "100%",
      height: 238,
      objectFit: "contain",
    },
    itemImageCaption: {
      fontSize: 7,
      color: TEXT_MUTED,
      textAlign: "center",
      paddingVertical: 4,
      backgroundColor: "#f0f4f8",
      borderTop: `1pt solid ${BORDER}`,
    },

    // ── Empty ─────────────────────────────────────────────────────────────────
    emptyText: { fontSize: 10, color: TEXT_MUTED, fontStyle: "italic" },

    // ── Footer ────────────────────────────────────────────────────────────────
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

  stylesCache.set(theme.id, s)
  return s
}

export interface PDFWorkItem {
  id: string
  title: string
  description: string
  images: string[]
  tags: Array<{ label: string; color: string }>
}

export interface PDFDocProps {
  nama: string
  periodeAwal: string
  periodeAkhir: string
  items: PDFWorkItem[]
  theme?: PdfTheme
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

export function WeeklyReportPDF({ nama, periodeAwal, periodeAkhir, items, theme }: PDFDocProps) {
  const t = theme ?? DEFAULT_THEME
  const styles = makeStyles(t)
  const periodeLabel = `${formatDateShort(periodeAwal)} – ${formatDateShort(periodeAkhir)}`

  return (
    <Document>
      <Page size="A4" style={styles.page} wrap>

        {/* ── Continuation header — only shows on page 2+ ── */}
        <View
          fixed
          style={styles.pageHeader}
          render={({ pageNumber }) =>
            pageNumber > 1 ? (
              <>
                <Text style={styles.pageHeaderTitle}>WEEKLY REPORT</Text>
                <Text style={styles.pageHeaderSub}>
                  {nama} · {periodeLabel}
                </Text>
              </>
            ) : null
          }
        />

        {/* ── Header (page 1 only) ── */}
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
        <View style={styles.sectionWrapper} wrap>
          <View style={styles.sectionHeader} wrap={false}>
            <View style={styles.sectionAccent} />
            <Text style={styles.sectionTitle}>RINGKASAN PEKERJAAN</Text>
          </View>

          {items.length === 0 ? (
            <Text style={styles.emptyText}>Tidak ada pekerjaan yang dicatat.</Text>
          ) : (
            items.map((item, idx) => (
              <View key={item.id} style={styles.workItemBlock} wrap>
                <View style={styles.workItemRow}>
                  {/* Number badge */}
                  <View style={styles.workItemBadge}>
                    <Text style={styles.workItemBadgeText}>{idx + 1}</Text>
                  </View>

                  {/* Content column */}
                  <View style={styles.workItemContent}>
                    {item.tags.length > 0 && (
                      <View style={styles.tagsRow}>
                        {item.tags.map((tag, i) => (
                          <View key={i} style={[styles.tagChip, { backgroundColor: tag.color }]}>
                            <Text style={styles.tagChipText}>{tag.label}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                    {item.title ? (
                      <Text style={styles.workItemTitle}>{item.title}</Text>
                    ) : null}
                    <Text style={styles.workItemText}>{item.description}</Text>

                    {item.images.length > 0 && (
                      <View style={styles.itemImagesWrapper}>
                        {item.images.map((src, imgIdx) => (
                          <View key={imgIdx} style={styles.itemImageContainer} wrap={false}>
                            <Image src={src} style={styles.itemImage} />
                            <Text style={styles.itemImageCaption}>
                              Bukti {idx + 1}.{imgIdx + 1}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                </View>
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
  ensureFonts()
  const blob = await pdf(<WeeklyReportPDF {...data} />).toBlob()
  return blob
}

export function getPDFFileName(nama: string, periodeAwal: string, periodeAkhir: string): string {
  const n = nama.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "")
  const start = periodeAwal ? periodeAwal.slice(0, 10) : "start"
  const end = periodeAkhir ? periodeAkhir.slice(0, 10) : "end"
  return `weekly-report_${n}_${start}_${end}.pdf`
}
