"use client";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function Header() {
  const pathname = usePathname();
  const isPatient = pathname?.startsWith("/patient");
  const isDoctor = pathname?.startsWith("/doctor");
  const isAdmin = pathname?.startsWith("/admin");

  return (
    <header className="sticky top-0 z-50 bg-[#083f4f] text-slate-100 border-b-4 border-[#1b8a7a] px-6 py-3.5 flex items-center justify-between shadow-md">
      {/* Brand / Title section */}
      <div className="flex items-center gap-3">
        {isAdmin || pathname === "/" ? (
          <Link
            href="/"
            className="font-extrabold tracking-wide text-base flex items-center gap-2 hover:opacity-90 transition"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-[#1b8a7a] inline-block shadow-sm" />
            MEDIKIOSK
          </Link>
        ) : (
          <div className="font-extrabold tracking-wide text-base flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#1b8a7a] inline-block shadow-sm" />
            MEDIKIOSK
          </div>
        )}

        {isPatient && (
          <span className="text-xs text-teal-300 font-semibold border-l border-slate-600 pl-3">
            Patient Intake Terminal
          </span>
        )}

        {isDoctor && (
          <span className="text-xs text-blue-300 font-semibold border-l border-slate-600 pl-3">
            Physician Consultation Workspace
          </span>
        )}

        {isAdmin && (
          <span className="text-xs text-amber-300 font-semibold border-l border-slate-600 pl-3">
            Hospital Admin Console
          </span>
        )}

        {pathname === "/" && (
          <span className="text-xs text-slate-300 hidden md:inline border-l border-slate-600 pl-3">
            AI Clinical Intake & Physician Workflow Platform
          </span>
        )}
      </div>

      {/* Navigation section - Restricted per user role */}
      <nav className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm font-bold">
        {isPatient && (
          <div className="flex items-center gap-2 bg-teal-950/60 border border-teal-500/30 text-teal-300 px-3 py-1.5 rounded-lg text-xs font-mono">
            <span>🔒</span> Secure Kiosk Terminal
          </div>
        )}

        {isDoctor && (
          <div className="flex items-center gap-2 bg-blue-950/60 border border-blue-500/30 text-blue-300 px-3 py-1.5 rounded-lg text-xs font-mono">
            <span>🩺</span> Doctor Portal
          </div>
        )}

        {isAdmin && (
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="py-1.5 px-3 bg-white/10 hover:bg-white/20 rounded-lg transition text-slate-200"
            >
              ← Portals Home
            </Link>
            <a
              href="/patient"
              target="_blank"
              rel="noopener noreferrer"
              className="py-1.5 px-3 bg-teal-800/80 hover:bg-teal-700 text-teal-100 rounded-lg transition flex items-center gap-1"
            >
              <span>🏥</span> Patient Kiosk ↗
            </a>
            <a
              href="/doctor"
              target="_blank"
              rel="noopener noreferrer"
              className="py-1.5 px-3 bg-blue-800/80 hover:bg-blue-700 text-blue-100 rounded-lg transition flex items-center gap-1"
            >
              <span>👨‍⚕️</span> Doctor Station ↗
            </a>
          </div>
        )}

        {pathname === "/" && (
          <div className="text-xs font-mono text-teal-200/80">
            Select a portal to launch in a new window
          </div>
        )}
      </nav>
    </header>
  );
}
