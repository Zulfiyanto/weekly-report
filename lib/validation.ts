import { z } from "zod"

export const reportSchema = z.object({
  nama: z
    .string()
    .min(2, "Nama minimal 2 karakter")
    .max(100, "Nama maksimal 100 karakter"),
  periodeAwal: z.string().min(1, "Tanggal awal harus diisi"),
  periodeAkhir: z.string().min(1, "Tanggal akhir harus diisi"),
})

export type ReportFormValues = z.infer<typeof reportSchema>

export const lemburSchema = z.object({
  nama: z
    .string()
    .min(2, "Nama minimal 2 karakter")
    .max(100, "Nama maksimal 100 karakter"),
  nipp: z
    .string()
    .min(1, "NIPP harus diisi")
    .max(30, "NIPP maksimal 30 karakter"),
  jabatan: z
    .string()
    .min(1, "Jabatan harus diisi")
    .max(60, "Jabatan maksimal 60 karakter"),
  namaPekerjaan: z
    .string()
    .min(1, "Nama pekerjaan harus diisi")
    .max(100, "Nama pekerjaan maksimal 100 karakter"),
  namaManager: z
    .string()
    .min(2, "Nama manager minimal 2 karakter")
    .max(100, "Nama manager maksimal 100 karakter"),
  tanggalDokumen: z.string().min(1, "Tanggal dokumen harus diisi"),
})

export type LemburFormValues = z.infer<typeof lemburSchema>
