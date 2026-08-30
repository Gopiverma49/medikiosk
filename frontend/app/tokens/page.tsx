"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { api } from "../../lib/api";
import type { TokenDisplayState, TokenColumnDisplay } from "../../lib/types";

// Clean synthesized hospital chime via Web Audio API
function playHospitalChime() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(587.33, now); // D5
    gain1.gain.setValueAtTime(0.3, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.6);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(880.0, now + 0.2); // A5
    gain2.gain.setValueAtTime(0.35, now + 0.2);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.2);
    osc2.stop(now + 0.9);
  } catch (e) {
    console.warn("Audio chime not available:", e);
  }
}

export default function TokenDisplayPage() {
  const [displayState, setDisplayState] = useState<TokenDisplayState>({
    column1: null,
    column2: null,
    waiting_count: 0,
    upcoming_tokens: [],
    recent_called: [],
  });

  const [currentTime, setCurrentTime] = useState<string>("");
  const [currentDate, setCurrentDate] = useState<string>("");
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [col1Flash, setCol1Flash] = useState<boolean>(false);
  const [col2Flash, setCol2Flash] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const prevCol1Token = useRef<string | null>(null);
  const prevCol2Token = useRef<string | null>(null);

  // Live Clock
  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      // Format: 11:19 AM
      setCurrentTime(d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }));
      // Format: Sun, Aug 30, 2026
      setCurrentDate(d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch initial & polled state
  const loadState = useCallback(async () => {
    try {
      const state = await api.getDisplayState();
      setDisplayState(state);
      checkTokenChanges(state);
    } catch (e) {
      console.warn("Display state fetch error:", e);
    }
  }, []);

  const triggerCallAnimation = useCallback((colNum: 1 | 2) => {
    if (soundEnabled) {
      playHospitalChime();
    }
    if (colNum === 1) {
      setCol1Flash(true);
      setTimeout(() => setCol1Flash(false), 2500);
    } else {
      setCol2Flash(true);
      setTimeout(() => setCol2Flash(false), 2500);
    }
  }, [soundEnabled]);

  const checkTokenChanges = useCallback((newState: TokenDisplayState) => {
    if (newState.column1 && newState.column1.token_number !== prevCol1Token.current) {
      if (prevCol1Token.current !== null) {
        triggerCallAnimation(1);
      }
      prevCol1Token.current = newState.column1.token_number;
    }

    if (newState.column2 && newState.column2.token_number !== prevCol2Token.current) {
      if (prevCol2Token.current !== null) {
        triggerCallAnimation(2);
      }
      prevCol2Token.current = newState.column2.token_number;
    }
  }, [triggerCallAnimation]);

  // WebSocket Connection with Reconnect & Fallback Polling
  useEffect(() => {
    loadState();

    let ws: WebSocket | null = null;
    let reconnectTimeout: any = null;
    let pollInterval: any = null;

    const connectWebSocket = () => {
      try {
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const host = window.location.hostname === "localhost" ? "localhost:8000" : window.location.host;
        const wsUrl = `${protocol}//${host}/api/ws/tokens`;

        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          setIsConnected(true);
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === "INITIAL_STATE" || msg.type === "TOKEN_CALLED" || msg.type === "TOKEN_GENERATED" || msg.type === "TOKEN_COMPLETED" || msg.type === "TOKEN_IN_CONSULTATION" || msg.type === "TOKEN_RECALLED") {
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

  return (
    <div className="min-h-[85vh] bg-white border border-slate-200 rounded-3xl p-6 md:p-8 flex flex-col justify-between shadow-sm font-sans select-none">
      {/* Top Header Bar */}
      <header className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-6 border-b border-slate-200">
        {/* Left: Hospital Icon & Branding */}
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shadow-sm">
            <svg
              className="w-6 h-6 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 leading-tight">
              MediKiosk Token Call Board
            </h1>
            <p className="text-xs md:text-sm text-slate-500 font-medium">
              Outpatient Department (OPD)
            </p>
          </div>
        </div>

        {/* Center: Live Clock & Date */}
        <div className="text-center">
          <div className="text-2xl md:text-3xl font-bold text-slate-800 tracking-tight leading-tight">
            {currentTime || "11:19 AM"}
          </div>
          <div className="text-xs text-slate-500 font-medium">
            {currentDate || "Sun, Aug 30, 2026"}
          </div>
        </div>

        {/* Right: Live Connection Indicator & Optional Controls */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-emerald-600">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
            <span>{isConnected ? "Live Sync" : "Polling"}</span>
          </div>

          <button
            type="button"
            onClick={() => {
              setSoundEnabled(!soundEnabled);
              if (!soundEnabled) playHospitalChime();
            }}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-slate-700 transition text-xs"
            title="Toggle Chime"
          >
            {soundEnabled ? "🔔" : "🔕"}
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-slate-700 transition text-xs"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? "⤓" : "⛶"}
          </button>
        </div>
      </header>

      {/* Main 2-Column Section */}
      <main className="my-auto py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
          {/* COLUMN 1: ROOM 1 */}
          <RoomCard
            roomTitle="ROOM 1"
            defaultDoctor="Dr. Rahul Kumar"
            data={displayState.column1}
            isFlashing={col1Flash}
          />

          {/* COLUMN 2: ROOM 2 */}
          <RoomCard
            roomTitle="ROOM 2"
            defaultDoctor="Dr. Priya Sharma"
            data={displayState.column2}
            isFlashing={col2Flash}
          />
        </div>
      </main>

      {/* Bottom Bar / Footer */}
      <footer className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
        {/* Left: Queue Metrics */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center">
            <span className="font-bold uppercase tracking-wider text-slate-500">
              WAITING IN QUEUE:
            </span>
            <span className="font-bold text-blue-700 text-base mx-1.5 font-sans">
              {displayState.waiting_count}
            </span>
            <span className="text-slate-500 font-medium">Patients</span>
          </div>

          <div className="flex items-center gap-1.5 ml-2">
            <span className="font-bold uppercase tracking-wider text-slate-500">
              NEXT UP:
            </span>
            {displayState.upcoming_tokens.length > 0 ? (
              <span className="bg-white border border-slate-200 rounded-md px-2 py-0.5 font-mono font-bold text-slate-800 text-xs shadow-2xs">
                {displayState.upcoming_tokens[0]}
              </span>
            ) : (
              <span className="bg-white border border-slate-200 rounded-md px-2 py-0.5 font-mono font-bold text-slate-400 text-xs">
                --
              </span>
            )}
          </div>
        </div>

        {/* Right: Hospital Guidance Text */}
        <div className="text-slate-500 text-center sm:text-right font-medium">
          Please proceed to your assigned Consultation Room when your Token is called.
        </div>
      </footer>
    </div>
  );
}

interface RoomCardProps {
  roomTitle: string;
  defaultDoctor: string;
  data: TokenColumnDisplay | null;
  isFlashing: boolean;
}

function RoomCard({ roomTitle, defaultDoctor, data, isFlashing }: RoomCardProps) {
  const hasActivePatient = Boolean(data && data.token_number);
  const doctorName = data?.doctor_name || defaultDoctor;
  const departmentName = data?.department || "General Medicine";

  return (
    <div
      className={`bg-white rounded-2xl border transition-all duration-300 flex flex-col justify-between shadow-2xs overflow-hidden ${
        isFlashing
          ? "border-blue-500 ring-4 ring-blue-100 scale-[1.01]"
          : hasActivePatient
          ? "border-blue-400 shadow-sm"
          : "border-slate-200"
      }`}
    >
      {/* Card Header: ROOM 1 / ROOM 2 */}
      <div className="text-center py-4 border-b border-slate-100">
        <h2 className="text-sm md:text-base font-extrabold text-[#113a82] tracking-wider uppercase font-sans">
          {roomTitle}
        </h2>
      </div>

      {/* Card Center: PATIENT TOKEN */}
      <div className="py-12 md:py-16 text-center px-6">
        <div className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">
          PATIENT TOKEN
        </div>

        {hasActivePatient ? (
          <div>
            <div
              className={`text-6xl md:text-7xl font-black tracking-tight font-sans text-slate-900 transition-transform ${
                isFlashing ? "scale-105 text-blue-700" : ""
              }`}
            >
              {data!.token_number}
            </div>
            <div className="text-xs font-semibold text-blue-700 mt-3">
              {data?.status === "CALLED" ? "Now Calling — Please Enter" : "In Consultation"}
              {data?.patient_name ? ` • ${data.patient_name}` : ""}
            </div>
          </div>
        ) : (
          <div>
            <div className="text-4xl md:text-5xl font-bold tracking-widest text-slate-800 font-sans my-1">
              ─ ─ ─ ─
            </div>
            <p className="text-xs text-slate-400 font-medium mt-3">
              Waiting for Doctor Assignment
            </p>
          </div>
        )}
      </div>

      {/* Card Footer: CONSULTING DOCTOR & DEPARTMENT */}
      <div className="p-5 md:p-6 border-t border-slate-100 flex items-center justify-between gap-4 bg-white">
        {/* Left: Doctor */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 flex-shrink-0">
            <svg
              className="w-5 h-5 text-slate-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.8}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              CONSULTING DOCTOR
            </div>
            <div className="text-sm md:text-base font-bold text-slate-800 tracking-tight">
              {doctorName}
            </div>
          </div>
        </div>

        {/* Right: Department */}
        <div className="text-right">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            DEPARTMENT
          </div>
          <div className="text-xs md:text-sm font-bold text-[#113a82] tracking-tight">
            {departmentName}
          </div>
        </div>
      </div>
    </div>
  );
}
