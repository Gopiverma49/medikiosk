"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function Header() {
  const pathname = usePathname();
  const isPatient = pathname?.startsWith("/patient");
  const isDoctor = pathname?.startsWith("/doctor");
  const isAdmin = pathname?.startsWith("/admin");
  const isTokens = pathname?.startsWith("/tokens");
  const isHome = pathname === "/";

  const [currentTime, setCurrentTime] = useState<string>("");
  const [currentDate, setCurrentDate] = useState<string>("");

  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      setCurrentTime(d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }));
      setCurrentDate(d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-slate-200 px-6 md:px-10 py-3.5 flex items-center justify-between shadow-xs">
      {/* Brand / Logo section */}
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="flex items-center gap-3 hover:opacity-95 transition"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-sm flex-shrink-0">
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M12 6v12m6-6H6"
              />
            </svg>
          </div>
          <div>
            <div className="text-xl font-bold tracking-tight text-slate-900 leading-tight">
              MediKiosk
            </div>
            <div className="text-xs text-slate-500 font-medium">
              Hospital Workflow Suite
            </div>
          </div>
        </Link>

        {isPatient && (
          <span className="text-xs font-bold text-teal-700 bg-teal-50 border border-teal-200 px-2.5 py-1 rounded-lg ml-3">
            Patient Intake Terminal
          </span>
        )}

        {isDoctor && (
          <span className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-lg ml-3">
            Physician Consultation Workspace
          </span>
        )}

        {isTokens && (
          <span className="text-xs font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2.5 py-1 rounded-lg ml-3">
            Waiting Area Token Display
          </span>
        )}

        {isAdmin && (
          <span className="text-xs font-bold text-slate-700 bg-slate-100 border border-slate-300 px-2.5 py-1 rounded-lg ml-3">
            Hospital Admin Console
          </span>
        )}
      </div>

      {/* Right: Live Clock on Home, and Role-specific Navigation */}
      <div className="flex items-center gap-4">
        {isHome && (
          <div className="flex items-center gap-2 text-right">
            <div className="text-sm font-bold text-slate-800 flex items-center gap-1.5 font-sans">
              <span className="text-emerald-600 text-sm">🕒</span>
              <span>{currentTime || "11:19 AM"}</span>
            </div>
            <span className="text-xs text-slate-400 font-medium hidden sm:inline">•</span>
            <div className="text-xs text-slate-500 font-medium hidden sm:inline">
              {currentDate || "Sun, Aug 30, 2026"}
            </div>
          </div>
        )}

        {isAdmin && (
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="py-1.5 px-3 bg-slate-100 hover:bg-slate-200 rounded-lg transition text-slate-700 text-xs font-bold"
            >
              ← Portals Home
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
