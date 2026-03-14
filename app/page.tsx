import ReportForm from "@/components/ReportForm"

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f0f4f8] py-10 px-4">
      <div className="mx-auto max-w-2xl">
        <ReportForm />
        <p className="text-center text-xs text-gray-400 mt-8">
          Weekly Report Generator · Data tersimpan lokal di browser Anda
        </p>
      </div>
    </main>
  )
}
