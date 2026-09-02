import Link from "next/link";

export default function Home() {
  return (
    <div className="space-y-10 py-4 max-w-6xl mx-auto">
      {/* Hero Welcome Banner */}
      <div className="bg-white border border-slate-200 rounded-3xl p-8 md:p-12 shadow-xs relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="relative z-10 max-w-2xl">
          <span className="text-xs font-bold font-mono tracking-widest text-emerald-700 uppercase block mb-2">
            WELCOME TO MEDIKIOSK
          </span>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-slate-900 mb-3">
            MediKiosk Platform
          </h1>
          <p className="text-slate-600 text-base md:text-lg leading-relaxed">
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
        <div className="mb-6 px-1">
          <h2 className="text-sm font-mono font-bold uppercase tracking-widest text-slate-500">
            SELECT MAIN PORTAL
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
          {/* Portal 1: Patient Kiosk */}
          <Link
            href="/patient"
            target="_blank"
            rel="noopener noreferrer"
            className="group bg-white border-2 border-slate-200 hover:border-emerald-500 rounded-3xl p-6 transition-all duration-200 transform hover:-translate-y-1.5 shadow-xs hover:shadow-xl flex flex-col text-center items-center justify-between"
          >
            <div>
              {/* Enlarged Icon */}
              <div className="w-20 h-20 rounded-2xl bg-emerald-50 border-2 border-emerald-100 flex items-center justify-center text-3xl mb-4 group-hover:bg-emerald-600 group-hover:text-white group-hover:border-emerald-600 transition-all duration-200 shadow-sm group-hover:scale-105 mx-auto">
                🏥
              </div>
              <div className="text-[11px] font-mono uppercase tracking-wider text-emerald-700 font-black mb-1">
                PORTAL 1 • TERMINAL
              </div>
              <h2 className="text-xl font-black text-slate-900 mb-2 group-hover:text-emerald-800 transition-colors">
                Patient Kiosk
              </h2>
              <p className="text-slate-600 text-xs leading-relaxed font-medium">
                5-stage accessible patient intake with English/Hindi localization, first-time consent, touch or voice guidance, and instant token generation.
              </p>
            </div>
          </Link>

          {/* Portal 2: Doctor Station */}
          <Link
            href="/doctor"
            target="_blank"
            rel="noopener noreferrer"
            className="group bg-white border-2 border-slate-200 hover:border-blue-500 rounded-3xl p-6 transition-all duration-200 transform hover:-translate-y-1.5 shadow-xs hover:shadow-xl flex flex-col text-center items-center justify-between"
          >
            <div>
              {/* Enlarged Icon */}
              <div className="w-20 h-20 rounded-2xl bg-blue-50 border-2 border-blue-100 flex items-center justify-center text-3xl mb-4 group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600 transition-all duration-200 shadow-sm group-hover:scale-105 mx-auto">
                👨‍⚕️
              </div>
              <div className="text-[11px] font-mono uppercase tracking-wider text-blue-700 font-black mb-1">
                PORTAL 2 • CONSULTATION
              </div>
              <h2 className="text-xl font-black text-slate-900 mb-2 group-hover:text-blue-800 transition-colors">
                Doctor Station
              </h2>
              <p className="text-slate-600 text-xs leading-relaxed font-medium">
                Live upcoming token queue, patient call management, clinical summary verification, and document inspection.
              </p>
            </div>
          </Link>

          {/* Portal 3: Nurse Station */}
          <Link
            href="/nurse"
            target="_blank"
            rel="noopener noreferrer"
            className="group bg-white border-2 border-slate-200 hover:border-teal-500 rounded-3xl p-6 transition-all duration-200 transform hover:-translate-y-1.5 shadow-xs hover:shadow-xl flex flex-col text-center items-center justify-between"
          >
            <div>
              {/* Enlarged Icon */}
              <div className="w-20 h-20 rounded-2xl bg-teal-50 border-2 border-teal-100 flex items-center justify-center text-3xl mb-4 group-hover:bg-teal-600 group-hover:text-white group-hover:border-teal-600 transition-all duration-200 shadow-sm group-hover:scale-105 mx-auto">
                👩‍⚕️
              </div>
              <div className="text-[11px] font-mono uppercase tracking-wider text-teal-700 font-black mb-1">
                PORTAL 3 • NURSE DESK
              </div>
              <h2 className="text-xl font-black text-slate-900 mb-2 group-hover:text-teal-800 transition-colors">
                Nurse Station
              </h2>
              <p className="text-slate-600 text-xs leading-relaxed font-medium">
                Live patient queue monitoring, token tracking, and patient past medicinal history lookup via ID card scan or number entry.
              </p>
            </div>
          </Link>

          {/* Portal 4: Token Display */}
          <Link
            href="/tokens"
            target="_blank"
            rel="noopener noreferrer"
            className="group bg-white border-2 border-slate-200 hover:border-purple-500 rounded-3xl p-6 transition-all duration-200 transform hover:-translate-y-1.5 shadow-xs hover:shadow-xl flex flex-col text-center items-center justify-between"
          >
            <div>
              {/* Enlarged Icon */}
              <div className="w-20 h-20 rounded-2xl bg-purple-50 border-2 border-purple-100 flex items-center justify-center text-3xl mb-4 group-hover:bg-purple-600 group-hover:text-white group-hover:border-purple-600 transition-all duration-200 shadow-sm group-hover:scale-105 mx-auto">
                📺
              </div>
              <div className="text-[11px] font-mono uppercase tracking-wider text-purple-700 font-black mb-1">
                PORTAL 4 • WAITING TV
              </div>
              <h2 className="text-xl font-black text-slate-900 mb-2 group-hover:text-purple-800 transition-colors">
                Token Display
              </h2>
              <p className="text-slate-600 text-xs leading-relaxed font-medium">
                Dedicated 2-column live waiting-room TV display with simultaneous doctor calling, audio chime, and real-time sync.
              </p>
            </div>
          </Link>

          {/* Portal 5: Hospital Admin */}
          <Link
            href="/admin"
            target="_blank"
            rel="noopener noreferrer"
            className="group bg-white border-2 border-slate-200 hover:border-slate-800 rounded-3xl p-6 transition-all duration-200 transform hover:-translate-y-1.5 shadow-xs hover:shadow-xl flex flex-col text-center items-center justify-between"
          >
            <div>
              {/* Enlarged Icon */}
              <div className="w-20 h-20 rounded-2xl bg-slate-100 border-2 border-slate-200 flex items-center justify-center text-3xl mb-4 group-hover:bg-slate-900 group-hover:text-white group-hover:border-slate-900 transition-all duration-200 shadow-sm group-hover:scale-105 mx-auto">
                ⚙️
              </div>
              <div className="text-[11px] font-mono uppercase tracking-wider text-slate-600 font-black mb-1">
                PORTAL 5 • ADMIN
              </div>
              <h2 className="text-xl font-black text-slate-900 mb-2 group-hover:text-slate-900 transition-colors">
                Hospital Admin
              </h2>
              <p className="text-slate-600 text-xs leading-relaxed font-medium">
                Physician and nurse accounts management, patient records audit, emergency triage rules, and room controls.
              </p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
