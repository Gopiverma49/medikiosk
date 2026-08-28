import "../styles/globals.css";
import type { ReactNode } from "react";
import Link from "next/link";

export const metadata = {
  title: "MediKiosk — AI Clinical Intake Platform",
  description: "AI-assisted clinical intake, document digitization, and physician workflow platform.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#f4f7f8] text-ink flex flex-col">
        <header className="sticky top-0 z-50 bg-[#083f4f] text-slate-100 border-b-4 border-[#1b8a7a] px-6 py-3.5 flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3">
            <Link href="/" className="font-extrabold tracking-wide text-base flex items-center gap-2 hover:opacity-90 transition">
              <span className="w-2.5 h-2.5 rounded-full bg-[#1b8a7a] inline-block shadow-sm" />
              MEDIKIOSK
            </Link>
            <span className="text-xs text-slate-300 hidden md:inline border-l border-slate-600 pl-3">
              AI Clinical Intake & Physician Workflow Platform
            </span>
          </div>
          <nav className="flex items-center gap-2 sm:gap-4 text-xs sm:text-sm font-bold">
            <Link href="/patient" className="py-1.5 px-3 rounded-lg hover:bg-white/10 transition flex items-center gap-1.5">
              <span>🏥</span> Patient
            </Link>
            <Link href="/doctor" className="py-1.5 px-3 rounded-lg hover:bg-white/10 transition flex items-center gap-1.5">
              <span>👨‍⚕️</span> Doctor
            </Link>
            <Link href="/admin" className="py-1.5 px-3 rounded-lg hover:bg-white/10 transition flex items-center gap-1.5">
              <span>⚙️</span> Admin
            </Link>
          </nav>
        </header>
        <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-6 md:py-8">{children}</main>
      </body>
    </html>
  );
}
