import "../styles/globals.css";
import type { ReactNode } from "react";
import { Header } from "../components/Header";
import { KioskLanguageProvider } from "../lib/kioskLanguage";

export const metadata = {
  title: "MediKiosk — AI Clinical Intake Platform",
  description: "AI-assisted clinical intake, document digitization, and physician workflow platform.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#f4f7f8] text-ink flex flex-col">
        <KioskLanguageProvider>
          <Header />
          <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-6 md:py-8">{children}</main>
        </KioskLanguageProvider>
      </body>
    </html>
  );
}

