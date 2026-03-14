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
