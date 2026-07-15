import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { ThirdwebProvider } from "thirdweb/react";

const plusJakartaSans = Plus_Jakarta_Sans({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Hasil Suara Pemilihan Umum — Republik Indonesia",
  description: "Dashboard Rekapitulasi Suara Nasional Real-time. Data hasil pemilu yang aman, transparan, dan akuntabel dari seluruh wilayah Indonesia.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
      {/* Script eksternal — menghapus atribut browser extension yang menyebabkan hydration mismatch */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="/bis-observer.js" />

      </head>
      <body className={plusJakartaSans.className} suppressHydrationWarning>
        <ThirdwebProvider>
          {children}
        </ThirdwebProvider>
      </body>
    </html>
  );
}
