import Link from "next/link";

export default function Home() {
  return (
    <div className="space-y-8 py-2 max-w-6xl mx-auto">
      {/* Hero Welcome Banner */}
      <div className="bg-white border border-slate-200 rounded-3xl p-8 md:p-12 shadow-xs relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="relative z-10 max-w-2xl">
          <span className="text-xs font-bold font-mono tracking-widest text-emerald-700 uppercase block mb-2">
            WELCOME TO MEDIKIOSK
          </span>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-slate-900 mb-3">
            MediKiosk Platform
          </h1>
          <p className="text-slate-600 text-sm md:text-base leading-relaxed">
            AI-assisted multilingual clinical intake, document digitization, contradiction detection, and physician verification workspace for high-density hospital outpatient departments.
          </p>
        </div>

        {/* Right: Hospital Building Watermark Illustration */}
        <div className="hidden lg:flex items-center justify-center text-emerald-600/10 pointer-events-none pr-4">
          <svg
            className="w-48 h-48"
            fill="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M4.5 21a1.5 1.5 0 0 1-1.5-1.5V6a1.5 1.5 0 0 1 1.5-1.5h15A1.5 1.5 0 0 1 21 6v13.5a1.5 1.5 0 0 1-1.5 1.5h-15ZM10.5 7.5v3h-3v3h3v3h3v-3h3v-3h-3v-3h-3Z" />
          </svg>
        </div>
      </div>

      {/* 4 Main Portals */}
      <div>
        <div className="flex items-center justify-between mb-4 px-1">
          <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-slate-400">
            SELECT MAIN PORTAL
          </h2>
          <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
            <span>🔒</span> Each portal opens securely in a dedicated tab
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Portal 1: Patient Kiosk */}
          <Link
            href="/patient"
            target="_blank"
            rel="noopener noreferrer"
            className="group bg-white border border-slate-200 hover:border-emerald-500 rounded-3xl p-7 transition transform hover:-translate-y-1 shadow-xs hover:shadow-md flex flex-col justify-between text-center items-center"
          >
            <div className="flex flex-col items-center w-full">
              {/* Enlarged Icon */}
              <div className="w-18 h-18 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-3xl mb-4 group-hover:bg-emerald-600 group-hover:text-white transition shadow-2xs">
                🏥
              </div>
              <div className="text-[11px] font-mono uppercase tracking-wider text-emerald-700 font-extrabold mb-1">
                PORTAL 1 • TERMINAL
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">
                Patient Kiosk
              </h2>
              <p className="text-slate-500 text-xs leading-relaxed mb-6">
                5-stage accessible patient intake with English/Hindi localization, touch or voice guidance, and instant token generation.
              </p>
            </div>
            <div className="w-full">
              <div className="w-full py-2.5 px-4 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border border-emerald-100">
                <span>Launch Intake</span>
                <span>›</span>
              </div>
            </div>
          </Link>

          {/* Portal 2: Doctor Station */}
          <Link
            href="/doctor"
            target="_blank"
            rel="noopener noreferrer"
            className="group bg-white border border-slate-200 hover:border-blue-500 rounded-3xl p-7 transition transform hover:-translate-y-1 shadow-xs hover:shadow-md flex flex-col justify-between text-center items-center"
          >
            <div className="flex flex-col items-center w-full">
              {/* Enlarged Icon */}
              <div className="w-18 h-18 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-3xl mb-4 group-hover:bg-blue-600 group-hover:text-white transition shadow-2xs">
                👨‍⚕️
              </div>
              <div className="text-[11px] font-mono uppercase tracking-wider text-blue-700 font-extrabold mb-1">
                PORTAL 2 • CONSULTATION
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">
                Doctor Station
              </h2>
              <p className="text-slate-500 text-xs leading-relaxed mb-6">
                Live upcoming token queue, patient call management, clinical summary verification, and document inspection.
              </p>
            </div>
            <div className="w-full">
              <div className="w-full py-2.5 px-4 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border border-blue-100">
                <span>Open Station</span>
                <span>›</span>
              </div>
            </div>
          </Link>

          {/* Portal 3: Token Display */}
          <Link
            href="/tokens"
            target="_blank"
            rel="noopener noreferrer"
            className="group bg-white border border-slate-200 hover:border-purple-500 rounded-3xl p-7 transition transform hover:-translate-y-1 shadow-xs hover:shadow-md flex flex-col justify-between text-center items-center"
          >
            <div className="flex flex-col items-center w-full">
              {/* Enlarged Icon */}
              <div className="w-18 h-18 rounded-full bg-purple-50 border border-purple-100 flex items-center justify-center text-3xl mb-4 group-hover:bg-purple-600 group-hover:text-white transition shadow-2xs">
                📺
              </div>
              <div className="text-[11px] font-mono uppercase tracking-wider text-purple-700 font-extrabold mb-1">
                PORTAL 3 • WAITING TV
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">
                Token Display
              </h2>
              <p className="text-slate-500 text-xs leading-relaxed mb-6">
                Dedicated 2-column live waiting-room TV display with simultaneous doctor calling, audio chime, and real-time sync.
              </p>
            </div>
            <div className="w-full">
              <div className="w-full py-2.5 px-4 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border border-purple-100">
                <span>Launch Display</span>
                <span>›</span>
              </div>
            </div>
          </Link>

          {/* Portal 4: Hospital Admin */}
          <Link
            href="/admin"
            target="_blank"
            rel="noopener noreferrer"
            className="group bg-white border border-slate-200 hover:border-slate-800 rounded-3xl p-7 transition transform hover:-translate-y-1 shadow-xs hover:shadow-md flex flex-col justify-between text-center items-center"
          >
            <div className="flex flex-col items-center w-full">
              {/* Enlarged Icon */}
              <div className="w-18 h-18 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-3xl mb-4 group-hover:bg-slate-900 group-hover:text-white transition shadow-2xs">
                ⚙️
              </div>
              <div className="text-[11px] font-mono uppercase tracking-wider text-slate-600 font-extrabold mb-1">
                PORTAL 4 • ADMIN
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">
                Hospital Admin
              </h2>
              <p className="text-slate-500 text-xs leading-relaxed mb-6">
                Physician account management, patient records audit, emergency triage rules, and AI evaluation benchmarks.
              </p>
            </div>
            <div className="w-full">
              <div className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border border-slate-200">
                <span>Admin Settings</span>
                <span>›</span>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
