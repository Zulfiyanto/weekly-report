import type { Metadata } from "next"
import LemburForm from "@/components/LemburForm"

export const metadata: Metadata = {
  title: "Laporan Lembur",
  description: "Susun Laporan Pelaksanaan Lembur resmi dan generate PDF siap tanda tangan.",
}

export default function LemburPage() {
  return <LemburForm />
}
