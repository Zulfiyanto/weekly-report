import type { Metadata } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";
import AppTabs from "@/components/AppTabs";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Weekly Report Generator",
    template: "%s · Weekly Report Generator",
  },
  description: "Buat laporan kerja mingguan dan laporan lembur yang profesional, lalu generate PDF dengan mudah.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className={`${jakarta.variable} ${jetbrainsMono.variable}`}>
      <body className="antialiased">
        <main className="min-h-screen bg-[#f0f4f8] py-10 px-4">
          <div className="mx-auto max-w-2xl">
            <AppTabs />
            {children}
            <p className="text-center text-xs text-gray-400 mt-8">
              Weekly Report Generator · Data tersimpan lokal di browser Anda
            </p>
          </div>
        </main>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
