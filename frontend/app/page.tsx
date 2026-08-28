import Link from "next/link";

export default function Home() {
  return (
    <div className="space-y-8 py-2">
      {/* Hero Welcome */}
      <div className="bg-gradient-to-r from-[#083f4f] to-[#12586a] text-white rounded-3xl p-8 md:p-12 shadow-xl relative overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <span className="inline-block py-1 px-3 bg-teal-400/20 border border-teal-300/30 rounded-full text-xs font-mono font-bold tracking-wide text-teal-200 mb-3">
            HOSPITAL WORKFLOW SUITE
          </span>
          <h1 className="text-3xl md:text-5xl font-black tracking-tight mb-4 text-white">
            MediKiosk Platform
          </h1>
          <p className="text-teal-100 text-sm md:text-base leading-relaxed">
            AI-assisted multilingual clinical intake, document digitization, contradiction detection, and physician verification workspace designed for high-density hospital outpatient departments.
          </p>
        </div>
        <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* 3 Main Portals */}
      <div>
        <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-slate-400 mb-4 px-1">
          Select Main Portal
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Portal 1: Patient */}
          <Link
            href="/patient"
            className="group bg-white border-2 border-slate-200 hover:border-teal-600 rounded-3xl p-8 transition transform hover:-translate-y-1 shadow-md flex flex-col justify-between"
          >
            <div>
              <div className="w-14 h-14 bg-teal-50 text-teal-700 rounded-2xl flex items-center justify-center text-3xl mb-4 group-hover:bg-teal-600 group-hover:text-white transition">
                🏥
              </div>
              <div className="text-xs font-mono uppercase tracking-wider text-teal-700 font-extrabold mb-1">
                Portal 1
              </div>
              <h2 className="text-2xl font-black text-slate-900 mb-2">
                Patient Kiosk
              </h2>
              <p className="text-slate-500 text-sm leading-relaxed mb-6">
                5-stage accessible patient intake with English/Hindi localization, touch or voice guidance, QR/keypad lookup, and adaptive history collection.
              </p>
            </div>
            <div className="flex items-center text-sm font-bold text-teal-700 group-hover:text-teal-900">
              Launch Patient Kiosk →
            </div>
          </Link>

          {/* Portal 2: Doctor */}
          <Link
            href="/doctor"
            className="group bg-white border-2 border-slate-200 hover:border-blue-600 rounded-3xl p-8 transition transform hover:-translate-y-1 shadow-md flex flex-col justify-between"
          >
            <div>
              <div className="w-14 h-14 bg-blue-50 text-blue-700 rounded-2xl flex items-center justify-center text-3xl mb-4 group-hover:bg-blue-600 group-hover:text-white transition">
                👨‍⚕️
              </div>
              <div className="text-xs font-mono uppercase tracking-wider text-blue-700 font-extrabold mb-1">
                Portal 2
              </div>
              <h2 className="text-2xl font-black text-slate-900 mb-2">
                Doctor Station
              </h2>
              <p className="text-slate-500 text-sm leading-relaxed mb-6">
                Real-time patient queue, clinical facts review with confidence badges, discrepancy resolution, 1-click summary verification, and FHIR export.
              </p>
            </div>
            <div className="flex items-center text-sm font-bold text-blue-700 group-hover:text-blue-900">
              Open Doctor Station →
            </div>
          </Link>

          {/* Portal 3: Admin */}
          <Link
            href="/admin"
            className="group bg-white border-2 border-slate-200 hover:border-slate-800 rounded-3xl p-8 transition transform hover:-translate-y-1 shadow-md flex flex-col justify-between"
          >
            <div>
              <div className="w-14 h-14 bg-slate-100 text-slate-700 rounded-2xl flex items-center justify-center text-3xl mb-4 group-hover:bg-slate-900 group-hover:text-white transition">
                ⚙️
              </div>
              <div className="text-xs font-mono uppercase tracking-wider text-slate-600 font-extrabold mb-1">
                Portal 3
              </div>
              <h2 className="text-2xl font-black text-slate-900 mb-2">
                Hospital Admin
              </h2>
              <p className="text-slate-500 text-sm leading-relaxed mb-6">
                Emergency red-flag rule configuration & testing, AI precision/recall evaluation benchmark execution, and clinical audit trail review.
              </p>
            </div>
            <div className="flex items-center text-sm font-bold text-slate-800 group-hover:text-black">
              Manage System Settings →
            </div>
          </Link>
        </div>
      </div>

      {/* Demo Quick Reference Card */}
      <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 md:p-8">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-600 mb-3">
          Quick Test Patient Accounts for Intake Kiosk
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-sans">
          <div className="p-4 bg-white border border-slate-200 rounded-2xl">
            <span className="font-mono font-bold text-teal-800 text-sm block mb-1">1000000001</span>
            <span className="font-bold text-slate-800 block">Rahul Kumar (42, M)</span>
            <span className="text-teal-700 font-medium mt-1 block">Has previous Fever & Viral record → Triggers Same vs New Illness choice.</span>
          </div>
          <div className="p-4 bg-white border border-slate-200 rounded-2xl">
            <span className="font-mono font-bold text-teal-800 text-sm block mb-1">1000000002</span>
            <span className="font-bold text-slate-800 block">Priya Sharma (30, F)</span>
            <span className="text-blue-700 font-medium mt-1 block">No previous record → Automatically starts symptom collection.</span>
          </div>
          <div className="p-4 bg-white border border-slate-200 rounded-2xl">
            <span className="font-mono font-bold text-amber-800 text-sm block mb-1">9999999999</span>
            <span className="font-bold text-slate-800 block">Unregistered Patient</span>
            <span className="text-amber-700 font-medium mt-1 block">Not in database → Opens New Patient Registration form.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
