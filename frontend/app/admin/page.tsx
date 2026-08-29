"use client";
import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import type { DoctorAccount, AdminPatientRecord } from "../../lib/types";

type AdminSection = "doctors" | "patients";

function formatIndiaDateTime(dateStr?: string | null): string {
  if (!dateStr) return "—";
  let iso = dateStr.trim();
  if (!iso.endsWith("Z") && !iso.includes("+") && !iso.includes("-", 10)) {
    iso = `${iso.replace(" ", "T")}Z`;
  }
  const d = new Date(iso);
  if (isNaN(d.getTime())) return dateStr;

  return d.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function formatIndiaDate(dateStr?: string | null): string {
  if (!dateStr) return "—";
  let iso = dateStr.trim();
  if (!iso.endsWith("Z") && !iso.includes("+") && !iso.includes("-", 10)) {
    iso = `${iso.replace(" ", "T")}Z`;
  }
  const d = new Date(iso);
  if (isNaN(d.getTime())) return dateStr;

  return d.toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function AdminPage() {
  // --- Admin Authentication State ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [usernameInput, setUsernameInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{ username: string; full_name?: string } | null>(null);

  // --- Active Section ---
  const [activeSection, setActiveSection] = useState<AdminSection>("doctors");

  // --- Doctor Management State ---
  const [doctors, setDoctors] = useState<DoctorAccount[]>([]);
  const [doctorSearch, setDoctorSearch] = useState("");
  const [isDoctorModalOpen, setIsDoctorModalOpen] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<DoctorAccount | null>(null);
  const [doctorForm, setDoctorForm] = useState({ fullName: "", username: "", password: "" });
  const [doctorActionLoading, setDoctorActionLoading] = useState(false);
  const [doctorActionError, setDoctorActionError] = useState<string | null>(null);

  // --- Patient Management State ---
  const [patients, setPatients] = useState<AdminPatientRecord[]>([]);
  const [patientSearch, setPatientSearch] = useState("");
  const [patientLoading, setPatientLoading] = useState(false);

  // --- Check Saved Admin Auth ---
  useEffect(() => {
    const savedToken = sessionStorage.getItem("medikiosk_admin_token");
    const savedUser = sessionStorage.getItem("medikiosk_admin_user");
    if (savedToken && savedUser) {
      try {
        const userObj = JSON.parse(savedUser);
        setCurrentUser(userObj);
        setIsAuthenticated(true);
        loadAllData();
      } catch {
        sessionStorage.removeItem("medikiosk_admin_token");
        sessionStorage.removeItem("medikiosk_admin_user");
      }
    }
    setAuthLoading(false);
  }, []);

  async function handleAdminLogin(e: React.FormEvent) {
    e.preventDefault();
    setAuthError(null);
    if (!usernameInput.trim() || !passwordInput.trim()) {
      setAuthError("Please enter both administrator username and password.");
      return;
    }
    try {
      const res = await api.login({ username: usernameInput.trim(), password: passwordInput.trim() });
      if (res.role !== "ADMIN") {
        setAuthError("Access denied. Administrator privileges required.");
        return;
      }
      const userObj = { username: res.username || usernameInput.trim(), full_name: res.full_name || "Administrator" };
      sessionStorage.setItem("medikiosk_admin_token", res.access_token);
      sessionStorage.setItem("medikiosk_admin_user", JSON.stringify(userObj));
      setCurrentUser(userObj);
      setIsAuthenticated(true);
      await loadAllData();
    } catch (err: any) {
      setAuthError("Invalid admin credentials. (Default username: gopi, password: gopi)");
    }
  }

  function handleAdminLogout() {
    sessionStorage.removeItem("medikiosk_admin_token");
    sessionStorage.removeItem("medikiosk_admin_user");
    setIsAuthenticated(false);
    setCurrentUser(null);
    setUsernameInput("");
    setPasswordInput("");
  }

  async function loadAllData() {
    await Promise.all([loadDoctors(), loadPatients()]);
  }

  async function loadDoctors() {
    try {
      const docs = await api.listDoctors();
      setDoctors(docs);
    } catch (err) {
      console.error("Failed to load doctors:", err);
    }
  }

  async function loadPatients() {
    setPatientLoading(true);
    try {
      const pts = await api.listAllPatientsAdmin();
      setPatients(pts);
    } catch (err) {
      console.error("Failed to load patients:", err);
    } finally {
      setPatientLoading(false);
    }
  }

  // --- Doctor Modal Handlers ---
  function openCreateDoctorModal() {
    setEditingDoctor(null);
    setDoctorForm({ fullName: "", username: "", password: "" });
    setDoctorActionError(null);
    setIsDoctorModalOpen(true);
  }

  function openEditDoctorModal(doc: DoctorAccount) {
    setEditingDoctor(doc);
    setDoctorForm({ fullName: doc.full_name || "", username: doc.username, password: "" });
    setDoctorActionError(null);
    setIsDoctorModalOpen(true);
  }

  async function handleDoctorFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    setDoctorActionError(null);
    setDoctorActionLoading(true);

    try {
      if (editingDoctor) {
        // Edit existing doctor
        await api.updateDoctor(editingDoctor.id, {
          full_name: doctorForm.fullName.trim(),
          username: doctorForm.username.trim(),
          password: doctorForm.password.trim() || undefined,
        });
      } else {
        // Create new doctor
        if (!doctorForm.password.trim()) {
          setDoctorActionError("Password is required for new doctor accounts.");
          setDoctorActionLoading(false);
          return;
        }
        await api.createDoctor({
          full_name: doctorForm.fullName.trim(),
          username: doctorForm.username.trim(),
          password: doctorForm.password.trim(),
        });
      }
      setIsDoctorModalOpen(false);
      await loadDoctors();
    } catch (err: any) {
      setDoctorActionError(err.message || "Failed to save doctor account.");
    } finally {
      setDoctorActionLoading(false);
    }
  }

  async function handleDeleteDoctor(doc: DoctorAccount) {
    if (confirm(`Are you sure you want to delete doctor '${doc.full_name || doc.username}'? This doctor will no longer be able to log in.`)) {
      try {
        await api.deleteDoctor(doc.id);
        await loadDoctors();
      } catch (err: any) {
        alert("Failed to delete doctor: " + err.message);
      }
    }
  }

  async function handleDeletePatient(pt: AdminPatientRecord) {
    if (confirm(`Are you sure you want to delete patient '${pt.name}' (ID: ${pt.patient_id})? This will permanently remove their records and encounters.`)) {
      try {
        await api.deletePatientAdmin(pt.id);
        await loadPatients();
      } catch (err: any) {
        alert("Failed to delete patient: " + err.message);
      }
    }
  }

  if (authLoading) {
    return <div className="text-center py-20 text-slate-400 font-bold">Loading Admin Console…</div>;
  }

  // --- Admin Login Screen ---
  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto my-12 bg-white border-2 border-slate-200 rounded-3xl p-8 shadow-xl">
        <div className="w-16 h-16 bg-slate-900 text-white rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 shadow">
          ⚙️
        </div>
        <h1 className="text-2xl font-black text-slate-900 text-center mb-1">
          Hospital Admin Portal
        </h1>
        <p className="text-slate-500 text-xs text-center mb-6">
          Sign in with administrator credentials to manage doctors and patient data.
        </p>

        {authError && (
          <div className="bg-red-50 border-2 border-red-300 text-red-700 text-xs font-bold p-3 rounded-xl mb-4 text-center">
            ⚠ {authError}
          </div>
        )}

        <form onSubmit={handleAdminLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Admin Username
            </label>
            <input
              type="text"
              required
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              placeholder="e.g. gopi"
              className="w-full p-3 bg-slate-50 border-2 border-slate-300 focus:border-slate-800 rounded-xl text-sm font-semibold text-slate-800 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Admin Password
            </label>
            <input
              type="password"
              required
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="••••••••"
              className="w-full p-3 bg-slate-50 border-2 border-slate-300 focus:border-slate-800 rounded-xl text-sm font-semibold text-slate-800 outline-none"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3.5 bg-slate-900 hover:bg-black active:scale-98 text-white font-black text-base rounded-xl shadow-lg transition"
          >
            Sign In to Admin Console →
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-slate-200 text-center">
          <div className="text-[11px] text-slate-500 bg-slate-100 py-2 px-3 rounded-lg font-mono">
            Default credentials: <b>gopi</b> / <b>gopi</b>
          </div>
        </div>
      </div>
    );
  }

  const filteredDoctors = doctors.filter(
    (d) =>
      (d.full_name || "").toLowerCase().includes(doctorSearch.toLowerCase()) ||
      d.username.toLowerCase().includes(doctorSearch.toLowerCase())
  );

  const filteredPatients = patients.filter(
    (p) =>
      p.name.toLowerCase().includes(patientSearch.toLowerCase()) ||
      p.patient_id.toLowerCase().includes(patientSearch.toLowerCase()) ||
      (p.phone || "").includes(patientSearch)
  );

  // --- Authenticated Admin Dashboard ---
  return (
    <div className="space-y-6">
      {/* Top Header Navigation & Status */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-500 font-extrabold">
              Hospital Admin Console
            </span>
            <span className="text-xs text-slate-300">•</span>
            <span className="text-xs font-bold text-slate-700">
              Logged in as: {currentUser?.username}
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900">
            System Administration & Control
          </h1>
        </div>

        {/* Global Quick Action Links for Admin */}
        <div className="flex items-center gap-2 flex-wrap">
          <a
            href="/"
            className="py-2 px-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition"
          >
            ← Portals Home
          </a>
          <a
            href="/patient"
            target="_blank"
            rel="noopener noreferrer"
            className="py-2 px-3.5 bg-teal-50 border border-teal-200 hover:bg-teal-100 text-teal-800 font-bold rounded-xl text-xs transition flex items-center gap-1"
          >
            <span>🏥</span> Patient Kiosk ↗
          </a>
          <a
            href="/doctor"
            target="_blank"
            rel="noopener noreferrer"
            className="py-2 px-3.5 bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-800 font-bold rounded-xl text-xs transition flex items-center gap-1"
          >
            <span>👨‍⚕️</span> Doctor Station ↗
          </a>
          <button
            type="button"
            onClick={handleAdminLogout}
            className="py-2 px-3 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl text-xs font-bold transition"
            title="Sign out of admin"
          >
            Sign Out ⎋
          </button>
        </div>
      </div>

      {/* Two Main Columns / Sections Switcher */}
      <div className="flex gap-3 bg-slate-200/70 p-1.5 rounded-2xl max-w-md">
        <button
          type="button"
          onClick={() => setActiveSection("doctors")}
          className={`flex-1 py-3 rounded-xl font-bold text-sm transition flex items-center justify-center gap-2 ${
            activeSection === "doctors"
              ? "bg-white text-slate-900 shadow-md border border-slate-200"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <span>👨‍⚕️</span> Doctors Management ({doctors.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveSection("patients")}
          className={`flex-1 py-3 rounded-xl font-bold text-sm transition flex items-center justify-center gap-2 ${
            activeSection === "patients"
              ? "bg-white text-slate-900 shadow-md border border-slate-200"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <span>🏥</span> Patients Directory ({patients.length})
        </button>
      </div>

      {/* SECTION 1: DOCTORS MANAGEMENT */}
      {activeSection === "doctors" && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                <span>👨‍⚕️</span> Doctor Credentials & Accounts
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Create, modify, and delete physician login credentials. Doctors can only sign in using credentials created here.
              </p>
            </div>
            <button
              type="button"
              onClick={openCreateDoctorModal}
              className="py-3 px-5 bg-teal-700 hover:bg-teal-800 text-white font-bold text-sm rounded-xl shadow transition flex items-center gap-2"
            >
              <span>+</span> Create Doctor ID
            </button>
          </div>

          {/* Search bar */}
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={doctorSearch}
              onChange={(e) => setDoctorSearch(e.target.value)}
              placeholder="Search doctor by name or username..."
              className="w-full max-w-md p-3 bg-slate-50 border-2 border-slate-200 focus:border-teal-600 rounded-xl text-sm font-medium text-slate-800 outline-none"
            />
          </div>

          {/* Doctors Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-2xl">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 font-bold text-xs uppercase border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4">Doctor Name</th>
                  <th className="py-3.5 px-4">Username / ID</th>
                  <th className="py-3.5 px-4">Role</th>
                  <th className="py-3.5 px-4">Created Date</th>
                  <th className="py-3.5 px-4">Updated On</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDoctors.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-4 px-4 font-bold text-slate-900 flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-800 font-black text-xs flex items-center justify-center">
                        Dr
                      </div>
                      {doc.full_name || "Doctor"}
                    </td>
                    <td className="py-4 px-4 font-mono font-bold text-teal-800 text-xs">
                      {doc.username}
                    </td>
                    <td className="py-4 px-4">
                      <span className="inline-block px-2.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-xs font-bold">
                        {doc.role}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-xs text-slate-600 font-medium">
                      {formatIndiaDate(doc.created_at)}
                    </td>
                    <td className="py-4 px-4 text-xs text-slate-700 font-mono font-medium">
                      {formatIndiaDateTime(doc.updated_at || doc.created_at)}
                    </td>
                    <td className="py-4 px-4 text-right space-x-2">
                      <button
                        type="button"
                        onClick={() => openEditDoctorModal(doc)}
                        className="py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition"
                      >
                        Edit / Reset Password
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteDoctor(doc)}
                        className="py-1.5 px-3 bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs rounded-lg transition"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredDoctors.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400 font-medium">
                      No doctor accounts found. Click &quot;Create Doctor ID&quot; to add one.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECTION 2: PATIENTS DIRECTORY */}
      {activeSection === "patients" && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                <span>🏥</span> Registered Patients Directory
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Complete list of patients registered via Kiosk or Hospital Intake with clinical encounter history.
              </p>
            </div>
            <button
              type="button"
              onClick={loadPatients}
              className="py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
            >
              ↻ Refresh List
            </button>
          </div>

          {/* Search bar */}
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={patientSearch}
              onChange={(e) => setPatientSearch(e.target.value)}
              placeholder="Search by patient name, 10-digit ID, or phone..."
              className="w-full max-w-md p-3 bg-slate-50 border-2 border-slate-200 focus:border-teal-600 rounded-xl text-sm font-medium text-slate-800 outline-none"
            />
          </div>

          {/* Patients Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-2xl">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 font-bold text-xs uppercase border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4">Patient ID</th>
                  <th className="py-3.5 px-4">Full Name</th>
                  <th className="py-3.5 px-4">Phone</th>
                  <th className="py-3.5 px-4">Age / Gender</th>
                  <th className="py-3.5 px-4">Encounters</th>
                  <th className="py-3.5 px-4">Registered Date</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPatients.map((pt) => (
                  <tr key={pt.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-4 px-4 font-mono font-bold text-teal-800 text-sm">
                      {pt.patient_id}
                    </td>
                    <td className="py-4 px-4 font-bold text-slate-900">
                      {pt.name}
                    </td>
                    <td className="py-4 px-4 font-mono text-xs text-slate-600">
                      {pt.phone || "—"}
                    </td>
                    <td className="py-4 px-4 text-xs text-slate-600 font-medium">
                      {pt.age ? `${pt.age} yrs` : "—"} • {pt.gender || "—"}
                    </td>
                    <td className="py-4 px-4">
                      <span className="inline-block px-2.5 py-0.5 bg-teal-50 text-teal-800 border border-teal-200 rounded-full text-xs font-bold">
                        {pt.encounter_count} visit(s)
                      </span>
                    </td>
                    <td className="py-4 px-4 text-xs text-slate-600 font-mono">
                      {formatIndiaDateTime(pt.created_at)}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleDeletePatient(pt)}
                        className="py-1.5 px-3 bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs rounded-lg transition"
                      >
                        Delete Record
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredPatients.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400 font-medium">
                      {patientLoading ? "Loading patient records..." : "No patient records found."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Doctor Create / Edit Modal */}
      {isDoctorModalOpen && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && setIsDoctorModalOpen(false)}
        >
          <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl">
            <h3 className="text-xl font-black text-slate-900 mb-1">
              {editingDoctor ? "Edit Doctor Credentials" : "Create New Doctor Account"}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              {editingDoctor
                ? `Modify account details or reset password for ${editingDoctor.username}.`
                : "Enter credentials for the new physician. They will use these to log into the Doctor Station."}
            </p>

            {doctorActionError && (
              <div className="bg-red-50 border-2 border-red-300 text-red-700 text-xs font-bold p-3 rounded-xl mb-4">
                ⚠ {doctorActionError}
              </div>
            )}

            <form onSubmit={handleDoctorFormSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Doctor Full Name
                </label>
                <input
                  type="text"
                  required
                  value={doctorForm.fullName}
                  onChange={(e) => setDoctorForm({ ...doctorForm, fullName: e.target.value })}
                  placeholder="e.g. Dr. Anjali Mehta"
                  className="w-full p-3 bg-slate-50 border-2 border-slate-300 focus:border-teal-600 rounded-xl text-sm font-semibold text-slate-800 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Doctor Username / Login ID
                </label>
                <input
                  type="text"
                  required
                  value={doctorForm.username}
                  onChange={(e) => setDoctorForm({ ...doctorForm, username: e.target.value.toLowerCase() })}
                  placeholder="e.g. dr.anjali"
                  className="w-full p-3 bg-slate-50 border-2 border-slate-300 focus:border-teal-600 rounded-xl text-sm font-semibold text-slate-800 outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  {editingDoctor ? "New Password (leave blank to keep current)" : "Password"}
                </label>
                <input
                  type="password"
                  required={!editingDoctor}
                  value={doctorForm.password}
                  onChange={(e) => setDoctorForm({ ...doctorForm, password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full p-3 bg-slate-50 border-2 border-slate-300 focus:border-teal-600 rounded-xl text-sm font-semibold text-slate-800 outline-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsDoctorModalOpen(false)}
                  className="flex-1 py-3 border-2 border-slate-300 hover:bg-slate-100 rounded-xl font-bold text-slate-700 text-sm transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={doctorActionLoading}
                  className="flex-1 py-3 bg-teal-700 hover:bg-teal-800 text-white rounded-xl font-black text-sm shadow transition"
                >
                  {doctorActionLoading ? "Saving..." : editingDoctor ? "Update Doctor" : "Create Doctor"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
