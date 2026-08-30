"use client";
import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import type { DoctorAccount, AdminPatientRecord, ConsultationRoomItem } from "../../lib/types";

type AdminSection = "doctors" | "patients" | "rooms";

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

  // --- Consultation Rooms Management State ---
  const [rooms, setRooms] = useState<ConsultationRoomItem[]>([]);
  const [roomNameInput, setRoomNameInput] = useState("");
  const [roomDeptInput, setRoomDeptInput] = useState("General Medicine");
  const [roomDoctorInput, setRoomDoctorInput] = useState("");
  const [roomActionLoading, setRoomActionLoading] = useState(false);
  const [roomActionError, setRoomActionError] = useState<string | null>(null);

  // Edit Room Modal State
  const [isRoomEditModalOpen, setIsRoomEditModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<ConsultationRoomItem | null>(null);
  const [editRoomForm, setEditRoomForm] = useState({
    name: "",
    department: "General Medicine",
    default_doctor: "",
    is_active: true,
  });
  const [editRoomLoading, setEditRoomLoading] = useState(false);
  const [editRoomError, setEditRoomError] = useState<string | null>(null);

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
      setAuthError("Invalid admin credentials.");
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
    await Promise.all([loadDoctors(), loadPatients(), loadRooms()]);
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

  async function loadRooms() {
    try {
      const rList = await api.listRoomsAdmin();
      setRooms(rList);
    } catch (err) {
      console.error("Failed to load rooms:", err);
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
        await api.updateDoctor(editingDoctor.id, {
          full_name: doctorForm.fullName.trim(),
          username: doctorForm.username.trim(),
          password: doctorForm.password.trim() || undefined,
        });
      } else {
        await api.createDoctor({
          full_name: doctorForm.fullName.trim(),
          username: doctorForm.username.trim(),
          password: doctorForm.password.trim(),
        });
      }
      setIsDoctorModalOpen(false);
      await loadDoctors();
    } catch (err: any) {
      setDoctorActionError(err.message || "Failed to save doctor details.");
    } finally {
      setDoctorActionLoading(false);
    }
  }

  async function handleDeleteDoctor(doc: DoctorAccount) {
    if (!confirm(`Are you sure you want to permanently delete doctor account "${doc.full_name || doc.username}"?`)) {
      return;
    }
    try {
      await api.deleteDoctor(doc.id);
      await loadDoctors();
    } catch (err: any) {
      alert("Failed to delete doctor: " + err.message);
    }
  }

  async function handleDeletePatient(pt: AdminPatientRecord) {
    if (!confirm(`Are you sure you want to delete patient "${pt.name}" (ID: ${pt.patient_id}) and all associated records?`)) {
      return;
    }
    try {
      await api.deletePatientAdmin(pt.id);
      await loadPatients();
    } catch (err: any) {
      alert("Failed to delete patient: " + err.message);
    }
  }

  // --- Room Handlers ---
  async function handleCreateRoom(e: React.FormEvent) {
    e.preventDefault();
    setRoomActionError(null);
    if (!roomNameInput.trim()) {
      setRoomActionError("Please enter a room name (e.g. Room C).");
      return;
    }
    setRoomActionLoading(true);
    try {
      await api.createRoomAdmin({
        name: roomNameInput.trim(),
        department: roomDeptInput.trim() || "General Medicine",
        default_doctor: roomDoctorInput.trim() || undefined,
      });
      setRoomNameInput("");
      setRoomDoctorInput("");
      await loadRooms();
    } catch (err: any) {
      setRoomActionError(err.message || "Failed to create room.");
    } finally {
      setRoomActionLoading(false);
    }
  }

  function openEditRoomModal(room: ConsultationRoomItem) {
    setEditingRoom(room);
    setEditRoomForm({
      name: room.name,
      department: room.department || "General Medicine",
      default_doctor: room.default_doctor || "",
      is_active: room.is_active ?? true,
    });
    setEditRoomError(null);
    setIsRoomEditModalOpen(true);
  }

  async function handleEditRoomSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingRoom) return;
    setEditRoomError(null);
    if (!editRoomForm.name.trim()) {
      setEditRoomError("Please enter a room name.");
      return;
    }
    setEditRoomLoading(true);
    try {
      await api.updateRoomAdmin(editingRoom.id, {
        name: editRoomForm.name.trim(),
        department: editRoomForm.department.trim() || "General Medicine",
        default_doctor: editRoomForm.default_doctor.trim() || undefined,
        is_active: editRoomForm.is_active,
      });
      setIsRoomEditModalOpen(false);
      await loadRooms();
    } catch (err: any) {
      setEditRoomError(err.message || "Failed to update room.");
    } finally {
      setEditRoomLoading(false);
    }
  }

  async function handleDeleteRoom(room: ConsultationRoomItem) {
    if (!confirm(`Are you sure you want to delete "${room.name}"?`)) {
      return;
    }
    try {
      await api.deleteRoomAdmin(room.id);
      await loadRooms();
    } catch (err: any) {
      alert("Failed to delete room: " + err.message);
    }
  }

  // --- Token Reset Handler ---
  const [tokenResetLoading, setTokenResetLoading] = useState(false);

  async function handleResetTokenSystem() {
    if (!confirm("Are you sure you want to reset the Token System? This will clear all active queues and restart numbering from Token 1.")) {
      return;
    }
    setTokenResetLoading(true);
    try {
      const res = await api.resetTokenSystemAdmin();
      alert(`Token System successfully reset! ${res.cleared_count} active token(s) cleared. Next token will be 1.`);
      await loadRooms();
    } catch (err: any) {
      alert("Failed to reset token system: " + err.message);
    } finally {
      setTokenResetLoading(false);
    }
  }

  // --- Filtered Views ---
  const filteredDoctors = doctors.filter(
    (d) =>
      d.username.toLowerCase().includes(doctorSearch.toLowerCase()) ||
      (d.full_name && d.full_name.toLowerCase().includes(doctorSearch.toLowerCase()))
  );

  const filteredPatients = patients.filter(
    (p) =>
      p.name.toLowerCase().includes(patientSearch.toLowerCase()) ||
      (p.patient_id && p.patient_id.toLowerCase().includes(patientSearch.toLowerCase())) ||
      (p.phone && p.phone.includes(patientSearch))
  );

  if (authLoading) {
    return <div className="text-center py-20 text-slate-400 font-bold">Checking Administrator Privileges…</div>;
  }

  // --- Admin Login Screen ---
  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto my-12 bg-white border-2 border-slate-200 rounded-3xl p-8 shadow-xl">
        <div className="w-16 h-16 bg-teal-100 text-teal-800 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 shadow-inner">
          🔒
        </div>
        <h1 className="text-2xl font-black text-slate-900 text-center mb-1">
          Hospital Admin Portal
        </h1>
        <p className="text-slate-500 text-xs text-center mb-6">
          Authorized personnel only. Manage doctor IDs, patient records, and consultation rooms.
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
              placeholder="Enter administrator username"
              className="w-full p-3 bg-slate-50 border-2 border-slate-300 focus:border-teal-600 rounded-xl text-sm font-semibold text-slate-800 outline-none"
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
              className="w-full p-3 bg-slate-50 border-2 border-slate-300 focus:border-teal-600 rounded-xl text-sm font-semibold text-slate-800 outline-none"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3.5 bg-teal-800 hover:bg-teal-900 active:scale-98 text-white font-black text-base rounded-xl shadow-lg transition"
          >
            Access Admin Management →
          </button>
        </form>
      </div>
    );
  }

  // --- Authenticated Admin Dashboard ---
  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Top Header */}
      <div className="bg-white border border-slate-200 rounded-2xl px-6 py-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-800 font-black text-xl">
            ⚙️
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-900 leading-tight">
              Hospital Administrator Console
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Doctor Credentials • Patient Directory • Consultation Rooms
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          <span className="text-xs font-bold font-mono bg-slate-100 px-3 py-1.5 rounded-lg text-slate-700">
            Admin: {currentUser?.username}
          </span>
          <button
            type="button"
            onClick={handleAdminLogout}
            className="py-1.5 px-3.5 bg-slate-100 hover:bg-red-50 hover:text-red-700 border border-slate-300 rounded-xl text-xs font-bold text-slate-600 transition flex items-center gap-1"
            title="Sign out of admin"
          >
            Sign Out ⎋
          </button>
        </div>
      </div>

      {/* Main Sections Switcher (3 Tabs) */}
      <div className="flex gap-2 bg-slate-200/70 p-1.5 rounded-2xl max-w-xl flex-wrap">
        <button
          type="button"
          onClick={() => setActiveSection("doctors")}
          className={`flex-1 py-3 px-3 rounded-xl font-bold text-xs sm:text-sm transition flex items-center justify-center gap-1.5 ${
            activeSection === "doctors"
              ? "bg-white text-slate-900 shadow-md border border-slate-200"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <span>👨‍⚕️</span> Doctors ({doctors.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveSection("patients")}
          className={`flex-1 py-3 px-3 rounded-xl font-bold text-xs sm:text-sm transition flex items-center justify-center gap-1.5 ${
            activeSection === "patients"
              ? "bg-white text-slate-900 shadow-md border border-slate-200"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <span>🏥</span> Patients ({patients.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveSection("rooms")}
          className={`flex-1 py-3 px-3 rounded-xl font-bold text-xs sm:text-sm transition flex items-center justify-center gap-1.5 ${
            activeSection === "rooms"
              ? "bg-white text-slate-900 shadow-md border border-slate-200"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <span>🚪</span> Rooms ({rooms.length})
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
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDoctors.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-4 px-4 font-bold text-slate-900">
                      {doc.full_name || `Dr. ${doc.username}`}
                    </td>
                    <td className="py-4 px-4 font-mono font-bold text-teal-800 text-xs">
                      {doc.username}
                    </td>
                    <td className="py-4 px-4">
                      <span className="inline-block px-2.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-xs font-bold font-mono">
                        {doc.role}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-xs text-slate-600 font-mono">
                      {formatIndiaDateTime(doc.created_at)}
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
                    <td colSpan={5} className="py-8 text-center text-slate-400 font-medium">
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

      {/* SECTION 3: CONSULTATION ROOMS MANAGEMENT */}
      {activeSection === "rooms" && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                <span>🚪</span> Consultation Rooms Management
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Add, manage, and configure consultation rooms (e.g. Room A, Room B, Room C). The Token Call Board dynamically displays all active rooms.
              </p>
            </div>
            <button
              type="button"
              onClick={loadRooms}
              className="py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
            >
              ↻ Refresh Rooms
            </button>
          </div>

          {/* Add New Room Form */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
            <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-1.5">
              <span>+</span> Add New Consultation Room
            </h3>

            {roomActionError && (
              <div className="bg-red-50 border-2 border-red-300 text-red-700 text-xs font-bold p-3 rounded-xl mb-3">
                ⚠ {roomActionError}
              </div>
            )}

            <form onSubmit={handleCreateRoom} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Room Name
                </label>
                <input
                  type="text"
                  required
                  value={roomNameInput}
                  onChange={(e) => setRoomNameInput(e.target.value)}
                  placeholder="e.g. Room C or Room D"
                  className="w-full p-2.5 bg-white border border-slate-300 focus:border-teal-600 rounded-xl text-sm font-semibold text-slate-800 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Department
                </label>
                <input
                  type="text"
                  value={roomDeptInput}
                  onChange={(e) => setRoomDeptInput(e.target.value)}
                  placeholder="e.g. General Medicine"
                  className="w-full p-2.5 bg-white border border-slate-300 focus:border-teal-600 rounded-xl text-sm font-semibold text-slate-800 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Default Doctor (Optional)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={roomDoctorInput}
                    onChange={(e) => setRoomDoctorInput(e.target.value)}
                    placeholder="Enter physician name"
                    className="w-full p-2.5 bg-white border border-slate-300 focus:border-teal-600 rounded-xl text-sm font-semibold text-slate-800 outline-none"
                  />
                  <button
                    type="submit"
                    disabled={roomActionLoading}
                    className="py-2.5 px-5 bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs rounded-xl shadow transition flex-shrink-0"
                  >
                    {roomActionLoading ? "Adding..." : "Add Room"}
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Rooms Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-2xl">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 font-bold text-xs uppercase border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4">Room Name</th>
                  <th className="py-3.5 px-4">Department</th>
                  <th className="py-3.5 px-4">Default Doctor</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rooms.map((room) => (
                  <tr key={room.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-4 px-4 font-bold text-slate-900 font-mono text-sm">
                      {room.name}
                    </td>
                    <td className="py-4 px-4 font-semibold text-slate-700">
                      {room.department}
                    </td>
                    <td className="py-4 px-4 text-xs text-slate-600 font-medium">
                      {room.default_doctor || "—"}
                    </td>
                    <td className="py-4 px-4">
                      <span className="inline-block px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-bold font-mono">
                        Active on Display Board
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right space-x-2">
                      <button
                        type="button"
                        onClick={() => openEditRoomModal(room)}
                        className="py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition"
                      >
                        Edit Room
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteRoom(room)}
                        className="py-1.5 px-3 bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs rounded-lg transition"
                      >
                        Delete Room
                      </button>
                    </td>
                  </tr>
                ))}
                {rooms.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400 font-medium">
                      No consultation rooms created. Use the form above to add a room.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Daily Token Reset & Administrative Control */}
          <div className="bg-amber-50/70 border-2 border-amber-200 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl">🔄</span>
                <h4 className="text-base font-black text-slate-900">
                  Daily Token System & Counter Reset
                </h4>
              </div>
              <p className="text-xs text-slate-600 mt-1 max-w-xl">
                The token numbering automatically resets to <span className="font-mono font-bold text-slate-900">1</span> every day at <span className="font-bold text-slate-900">8:00 AM</span>. You can also manually reset all active queues and restart token numbers from <span className="font-mono font-bold text-slate-900">1</span> right now.
              </p>
            </div>

            <button
              type="button"
              disabled={tokenResetLoading}
              onClick={handleResetTokenSystem}
              className="py-3 px-5 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-extrabold text-xs rounded-xl shadow-md transition flex items-center gap-2 flex-shrink-0"
            >
              <span>{tokenResetLoading ? "Resetting..." : "⚡ Reset Token System (Start from 1)"}</span>
            </button>
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
                  placeholder="Enter doctor's full name"
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
                  placeholder="Enter login username"
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

      {/* Consultation Room Edit Modal */}
      {isRoomEditModalOpen && editingRoom && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && setIsRoomEditModalOpen(false)}
        >
          <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl">
            <h3 className="text-xl font-black text-slate-900 mb-1">
              Edit Consultation Room
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Update details for &quot;{editingRoom.name}&quot;. Changes are saved directly to the database and sync live to all Token display boards.
            </p>

            {editRoomError && (
              <div className="bg-red-50 border-2 border-red-300 text-red-700 text-xs font-bold p-3 rounded-xl mb-4">
                ⚠ {editRoomError}
              </div>
            )}

            <form onSubmit={handleEditRoomSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Room Name
                </label>
                <input
                  type="text"
                  required
                  value={editRoomForm.name}
                  onChange={(e) => setEditRoomForm({ ...editRoomForm, name: e.target.value })}
                  placeholder="e.g. Room A or Room C"
                  className="w-full p-3 bg-slate-50 border-2 border-slate-300 focus:border-teal-600 rounded-xl text-sm font-semibold text-slate-800 outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Department
                </label>
                <input
                  type="text"
                  required
                  value={editRoomForm.department}
                  onChange={(e) => setEditRoomForm({ ...editRoomForm, department: e.target.value })}
                  placeholder="e.g. General Medicine, Pediatrics, AYUSH"
                  className="w-full p-3 bg-slate-50 border-2 border-slate-300 focus:border-teal-600 rounded-xl text-sm font-semibold text-slate-800 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Default Doctor (Optional)
                </label>
                <input
                  type="text"
                  value={editRoomForm.default_doctor}
                  onChange={(e) => setEditRoomForm({ ...editRoomForm, default_doctor: e.target.value })}
                  placeholder="Leave empty or enter physician name"
                  className="w-full p-3 bg-slate-50 border-2 border-slate-300 focus:border-teal-600 rounded-xl text-sm font-semibold text-slate-800 outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="room_active_check"
                  checked={editRoomForm.is_active}
                  onChange={(e) => setEditRoomForm({ ...editRoomForm, is_active: e.target.checked })}
                  className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500"
                />
                <label htmlFor="room_active_check" className="text-xs font-bold text-slate-700 cursor-pointer">
                  Active (Show on live Token Call Board)
                </label>
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsRoomEditModalOpen(false)}
                  className="flex-1 py-3 border-2 border-slate-300 hover:bg-slate-100 rounded-xl font-bold text-slate-700 text-sm transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editRoomLoading}
                  className="flex-1 py-3 bg-teal-700 hover:bg-teal-800 text-white rounded-xl font-black text-sm shadow transition"
                >
                  {editRoomLoading ? "Saving..." : "Save Room Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
