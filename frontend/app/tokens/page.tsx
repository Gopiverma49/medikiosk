"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { api } from "../../lib/api";
import type { TokenDisplayState, TokenColumnDisplay } from "../../lib/types";
import { useKioskLanguage } from "../../lib/kioskLanguage";
import { t } from "../../lib/translations";

// Clean resonant synthesized hospital chime via Web Audio API
function playHospitalChime() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;

    // Tone 1: E5 (659.25 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(659.25, now);
    gain1.gain.setValueAtTime(0.6, now);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.65);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.65);

    // Tone 2: C5 (523.25 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(523.25, now + 0.25);
    gain2.gain.setValueAtTime(0.65, now + 0.25);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 1.1);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.25);
    osc2.stop(now + 1.1);
  } catch (e) {
    console.warn("Audio chime error:", e);
  }
}

export default function TokenDisplayPage() {
  const { baseLanguage } = useKioskLanguage();
  const [displayState, setDisplayState] = useState<TokenDisplayState>({
    column1: null,
    column2: null,
    rooms: [],
    waiting_count: 0,
    upcoming_tokens: [],
    recent_called: [],
  });

  const [currentTime, setCurrentTime] = useState<string>("");
  const [currentDate, setCurrentDate] = useState<string>("");
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [flashingRooms, setFlashingRooms] = useState<Record<string, boolean>>({});
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const prevRoomStates = useRef<Record<string, { token: string; calledAt: string | null }>>({});

  // Live Clock
  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      setCurrentTime(d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true }));
      setCurrentDate(d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Trigger call chime and card flash animation for a room
  const triggerRoomAnimation = useCallback((roomName: string) => {
    if (soundEnabled) {
      playHospitalChime();
    }
    setFlashingRooms((prev) => ({ ...prev, [roomName]: true }));
    setTimeout(() => {
      setFlashingRooms((prev) => ({ ...prev, [roomName]: false }));
    }, 3000);
  }, [soundEnabled]);

  // Check state changes across all dynamic rooms
  const checkTokenChanges = useCallback((newState: TokenDisplayState) => {
    const currentRooms = (newState.rooms && newState.rooms.length > 0)
      ? newState.rooms
      : [
          newState.column1 || { token_number: "", doctor_name: "—", room_number: "Room A", status: "UNASSIGNED" },
          newState.column2 || { token_number: "", doctor_name: "—", room_number: "Room B", status: "UNASSIGNED" },
        ];

    let hasSoundTriggered = false;

    currentRooms.forEach((r) => {
      const rKey = r.room_number || "Room";
      const prev = prevRoomStates.current[rKey];
      const curToken = r.token_number || "";
      const curCalledAt = r.called_at ? String(r.called_at) : null;

      if (curToken) {
        const isNew = prev ? prev.token !== curToken : false;
        const isRecalled = prev ? (curCalledAt !== null && prev.calledAt !== curCalledAt) : false;

        if (isNew || isRecalled) {
          if (!hasSoundTriggered) {
            triggerRoomAnimation(rKey);
            hasSoundTriggered = true;
          } else {
            setFlashingRooms((f) => ({ ...f, [rKey]: true }));
            setTimeout(() => setFlashingRooms((f) => ({ ...f, [rKey]: false })), 3000);
          }
        }
      }

      prevRoomStates.current[rKey] = { token: curToken, calledAt: curCalledAt };
    });
  }, [triggerRoomAnimation]);

  // Fetch initial & polled state
  const loadState = useCallback(async () => {
    try {
      const state = await api.getDisplayState();
      setDisplayState(state);
      checkTokenChanges(state);
    } catch (e) {
      console.warn("Display state fetch error:", e);
    }
  }, [checkTokenChanges]);

  // WebSocket Connection with Reconnect & Fallback Polling
  useEffect(() => {
    loadState();

    let ws: WebSocket | null = null;
    let reconnectTimeout: any = null;
    let pollInterval: any = null;

    const connectWebSocket = () => {
      try {
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsHost = `${window.location.hostname}:8000`;
        const wsUrl = `${protocol}//${wsHost}/api/ws/tokens`;

        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          setIsConnected(true);
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (
              msg.type === "INITIAL_STATE" ||
              msg.type === "TOKEN_CALLED" ||
              msg.type === "TOKEN_GENERATED" ||
              msg.type === "TOKEN_COMPLETED" ||
              msg.type === "TOKEN_IN_CONSULTATION" ||
              msg.type === "TOKEN_RECALLED" ||
              msg.type === "TOKEN_RESET" ||
              msg.type === "ROOMS_UPDATED"
            ) {
              if (msg.data?.display_state) {
                setDisplayState(msg.data.display_state);
                checkTokenChanges(msg.data.display_state);
              } else {
                loadState();
              }
              if (msg.type === "TOKEN_RECALLED" || msg.type === "TOKEN_CALLED") {
                if (soundEnabled) playHospitalChime();
              }
            }
          } catch (err) {
            console.error("WS message error:", err);
          }
        };

        ws.onclose = () => {
          setIsConnected(false);
          reconnectTimeout = setTimeout(connectWebSocket, 3000);
        };

        ws.onerror = () => {
          setIsConnected(false);
          ws?.close();
        };
      } catch {
        setIsConnected(false);
        reconnectTimeout = setTimeout(connectWebSocket, 3000);
      }
    };

    connectWebSocket();
    pollInterval = setInterval(loadState, 3000);

    return () => {
      if (ws) ws.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [loadState, checkTokenChanges, soundEnabled]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Derive rooms array (dynamic rooms or 2 default columns)
  const displayRooms: TokenColumnDisplay[] = (displayState.rooms && displayState.rooms.length > 0)
    ? displayState.rooms
    : [
        displayState.column1 || { token_number: "", doctor_name: "—", room_number: "Room A", status: "UNASSIGNED" },
        displayState.column2 || { token_number: "", doctor_name: "—", room_number: "Room B", status: "UNASSIGNED" },
      ];

  // Dynamic grid column class based on count of consultation rooms
  const getGridColsClass = (count: number) => {
    if (count === 1) return "grid grid-cols-1 max-w-xl mx-auto gap-5";
    if (count === 2) return "grid grid-cols-1 md:grid-cols-2 gap-5 lg:gap-6";
    return "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5";
  };

  return (
    <div className="min-h-[90vh] bg-slate-50/50 border border-slate-200 rounded-3xl p-5 md:p-7 flex flex-col justify-between shadow-lg font-sans select-none space-y-6">
      {/* 1. TOP HEADER BAR */}
      <header className="bg-white border border-slate-200 rounded-2xl px-5 py-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Left: Hospital Icon & Main Branding */}
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
            <svg
              className="w-7 h-7"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.2}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-black tracking-tight text-slate-900 leading-none">
                {t("token_board_title", baseLanguage)}
              </h1>
              <span className="bg-blue-100 text-blue-800 text-[11px] font-black uppercase px-2.5 py-0.5 rounded-full tracking-wider border border-blue-200">
                {t("live_status", baseLanguage)}
              </span>
            </div>
            <p className="text-xs md:text-sm text-slate-500 font-semibold mt-1">
              {t("opd_active_rooms", baseLanguage)} ({displayRooms.length})
            </p>
          </div>
        </div>

        {/* Center: Live Clock & Date */}
        <div className="text-center bg-slate-50 border border-slate-200 rounded-xl px-5 py-2">
          <div className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight leading-none font-mono">
            {currentTime || "11:19:00 AM"}
          </div>
          <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-0.5">
            {currentDate || "Sunday, Aug 30, 2026"}
          </div>
        </div>

        {/* Right: Sound Controls & Fullscreen */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`py-1.5 px-3 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 ${
              soundEnabled
                ? "bg-emerald-500 text-white border-emerald-600 shadow-sm hover:bg-emerald-600"
                : "bg-slate-100 border-slate-300 text-slate-500"
            }`}
            title="Toggle chime on call"
          >
            <span>{soundEnabled ? t("audio_on", baseLanguage) : t("audio_muted", baseLanguage)}</span>
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 transition text-sm font-bold shadow-2xs"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? t("exit_fullscreen", baseLanguage) : t("fullscreen", baseLanguage)}
          </button>
        </div>
      </header>

      {/* 2. MAIN DYNAMIC ROOM CALL CARDS (Optimized compact box with giant token visibility) */}
      <main className="flex-1 flex flex-col justify-center">
        <div className={getGridColsClass(displayRooms.length)}>
          {displayRooms.map((room, idx) => (
            <RoomCard
              key={room.room_number || idx}
              roomTitle={room.room_number || `ROOM ${String.fromCharCode(65 + idx)}`}
              data={room}
              isFlashing={Boolean(flashingRooms[room.room_number])}
              baseLanguage={baseLanguage}
            />
          ))}
        </div>
      </main>

      {/* 3. PATIENTS WAITING IN QUEUE BOX */}
      <footer className="bg-white border-2 border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center text-xl font-black shadow-inner">
            ⏳
          </div>
          <div>
            <div className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">
              {t("waiting_queue", baseLanguage)}
            </div>
            <div className="text-xl md:text-2xl font-black text-slate-800 font-mono flex items-center gap-2">
              <span className="text-blue-600">{displayState.waiting_count}</span>
              <span className="text-sm font-bold text-slate-600 font-sans">
                {displayState.waiting_count === 1
                  ? t("patient_waiting_single", baseLanguage)
                  : t("patient_waiting_plural", baseLanguage)}
              </span>
            </div>
          </div>
        </div>

        <div className="text-xs text-slate-500 font-medium flex items-center gap-2 bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-xl">
          <span className="w-2 h-2 rounded-full bg-blue-500 inline-block animate-ping" />
          <span>{t("queue_instruction", baseLanguage)}</span>
        </div>
      </footer>
    </div>
  );
}

interface RoomCardProps {
  roomTitle: string;
  data: TokenColumnDisplay | null;
  isFlashing: boolean;
  baseLanguage: any;
}

function RoomCard({ roomTitle, data, isFlashing, baseLanguage }: RoomCardProps) {
  const hasActivePatient = Boolean(data && data.token_number && data.token_number.trim() !== "");
  const doctorName = data?.doctor_name && data.doctor_name.trim() !== "" ? data.doctor_name : "—";

  return (
    <div
      className={`bg-white rounded-3xl border-2 transition-all duration-300 flex flex-col justify-between overflow-hidden shadow-md ${
        isFlashing
          ? "border-blue-600 ring-8 ring-blue-200 scale-[1.02] shadow-2xl bg-blue-50/20"
          : hasActivePatient
          ? "border-blue-600 shadow-lg"
          : "border-slate-300 bg-white"
      }`}
    >
      {/* Card Header: Room Name Banner Only */}
      <div className={`px-5 py-3.5 flex items-center border-b transition ${
        hasActivePatient ? "bg-slate-900 text-white border-slate-800" : "bg-slate-100 text-slate-800 border-slate-200"
      }`}>
        <div className="flex items-center gap-2.5">
          <span className="w-3 h-3 rounded-full bg-blue-500 animate-pulse" />
          <h2 className="text-base md:text-lg font-black tracking-wider uppercase font-sans">
            {roomTitle}
          </h2>
        </div>
      </div>

      {/* Card Center: PATIENT TOKEN DISPLAY */}
      <div className="py-4 md:py-6 px-4 text-center flex flex-col items-center justify-center my-auto">
        <div className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-1">
          {hasActivePatient ? t("now_consulting", baseLanguage) : t("room_status", baseLanguage)}
        </div>

        {hasActivePatient ? (
          <div className="w-full">
            {/* Giant High-Visibility Token Number */}
            <div
              className={`text-7xl md:text-8xl lg:text-9xl font-black tracking-tight font-mono text-slate-900 leading-none py-1 transition-transform ${
                isFlashing ? "scale-110 text-blue-700 animate-pulse" : "text-[#0d2a5c]"
              }`}
            >
              {data!.token_number}
            </div>

            {/* Active Consultation Badge */}
            <div className="mt-2.5 inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-100 border border-emerald-300 text-emerald-900 rounded-full text-xs font-black shadow-xs">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-ping" />
              <span>{t("in_consultation", baseLanguage)} • {roomTitle}</span>
            </div>

            {/* Patient Name if present */}
            {data?.patient_name && (
              <div className="mt-2 text-xs font-bold text-slate-700">
                {t("patient_label_tv", baseLanguage)}{" "}
                <span className="text-slate-900 font-extrabold text-sm">{data.patient_name}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="py-3">
            <div className="text-4xl md:text-5xl font-bold tracking-widest text-slate-300 font-mono my-1">
              ─ ─ ─
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 border border-slate-200 text-slate-500 rounded-full text-xs font-bold mt-2">
              <span>{t("ready_next_patient", baseLanguage)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Card Footer: CONSULTING DOCTOR & STATION DETAILS */}
      <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50/80 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-700 font-bold flex-shrink-0 text-xs">
            👨‍⚕️
          </div>
          <div className="truncate">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 leading-tight">
              {t("attending_physician", baseLanguage)}
            </div>
            <div className={`text-xs md:text-sm font-extrabold tracking-tight truncate ${doctorName !== "—" ? "text-slate-900" : "text-slate-400 italic"}`}>
              {doctorName !== "—" ? doctorName : t("doctor_not_logged_in", baseLanguage)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
