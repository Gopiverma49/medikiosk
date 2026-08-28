"use client";
import React, { useEffect, useRef, useState } from "react";
import { t, Language } from "../lib/translations";

interface Props {
  lang: Language;
  onDetected: (patientId: string) => void;
  onCancel: () => void;
  onSwitchToManual: () => void;
}

export function KioskScanner({ lang, onDetected, onCancel, onSwitchToManual }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [scanningStatus, setScanningStatus] = useState<string>("Initializing camera...");
  const [detectedFlash, setDetectedFlash] = useState(false);

  // Clean and parse detected QR / Barcode data
  const processDetectedRawValue = (rawValue: string) => {
    if (!rawValue) return;
    const clean = rawValue.trim();
    // Try to extract 10-digit sequence if embedded in a URL or structured text
    const match10 = clean.match(/\b\d{10}\b/);
    if (match10) {
      triggerSuccess(match10[0]);
      return;
    }
    // Or extract any alphanumeric ID string (e.g. STU1234, P100001, etc.)
    const alphanumericMatch = clean.match(/[A-Za-z0-9_-]{4,20}/);
    if (alphanumericMatch) {
      triggerSuccess(alphanumericMatch[0]);
      return;
    }
    triggerSuccess(clean.slice(0, 15));
  };

  const triggerSuccess = (finalId: string) => {
    setDetectedFlash(true);
    setScanningStatus(lang === "hi" ? `पहचान मिली: ${finalId}` : `ID Detected: ${finalId}`);
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    setTimeout(() => {
      onDetected(finalId);
    }, 600);
  };

  useEffect(() => {
    let activeStream: MediaStream | null = null;
    let scanInterval: NodeJS.Timeout | null = null;
    let barcodeDetector: any = null;

    // Check for native BarcodeDetector API (supported in modern Chrome / Edge / Android)
    if (typeof window !== "undefined" && "BarcodeDetector" in window) {
      try {
        barcodeDetector = new (window as any).BarcodeDetector({
          formats: [
            "qr_code",
            "code_128",
            "code_39",
            "ean_13",
            "ean_8",
            "upc_a",
            "upc_e",
            "data_matrix",
            "itf",
            "pdf417",
            "aztec",
          ],
        });
      } catch (e) {
        console.warn("BarcodeDetector formats init fallback:", e);
      }
    }

    async function startCamera() {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error(
            lang === "hi"
              ? "कैमरा समर्थित नहीं है या ब्राउज़र अनुमति अवरुद्ध है।"
              : "Camera API not supported or permissions blocked."
          );
        }

        const s = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });

        activeStream = s;
        setStream(s);

        if (videoRef.current) {
          videoRef.current.srcObject = s;
          await videoRef.current.play();
        }

        setCameraActive(true);
        setScanningStatus(
          lang === "hi"
            ? "आईडी कार्ड / क्यूआर कोड को कैमरे के सामने रखें..."
            : "Align Barcode / QR Code inside the green frame..."
        );

        // Continuous Real-Time Frame Analyzer
        scanInterval = setInterval(async () => {
          if (!videoRef.current || videoRef.current.readyState < 2) return;

          // 1. Try Native BarcodeDetector
          if (barcodeDetector) {
            try {
              const barcodes = await barcodeDetector.detect(videoRef.current);
              if (barcodes && barcodes.length > 0) {
                const detectedVal = barcodes[0].rawValue;
                if (detectedVal) {
                  processDetectedRawValue(detectedVal);
                  if (scanInterval) clearInterval(scanInterval);
                  return;
                }
              }
            } catch (err) {
              // Ignore single frame detect hiccups
            }
          }

          // 2. Fallback: Draw video frame to canvas for optical brightness/contrast helper
          if (canvasRef.current && videoRef.current) {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext("2d");
            if (ctx && videoRef.current.videoWidth > 0) {
              canvas.width = 320;
              canvas.height = 240;
              ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
            }
          }
        }, 300);
      } catch (err: any) {
        console.warn("Camera access failed:", err);
        setCameraError(err.message || "Camera permission denied or camera not found");
        setScanningStatus("Camera error");
      }
    }

    startCamera();

    return () => {
      if (scanInterval) clearInterval(scanInterval);
      if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [lang]);

  const handleSimulateScan = (id: string) => {
    triggerSuccess(id);
  };

  return (
    <div className="max-w-xl mx-auto bg-white border-2 border-slate-200 rounded-3xl p-6 md:p-8 shadow-xl text-center">
      <h2 className="text-2xl md:text-3xl font-extrabold text-slate-800 mb-2">
        {t("scanner_title", lang)}
      </h2>
      <p className="text-slate-500 text-sm md:text-base mb-4">
        {t("scanner_instruction", lang)}
      </p>

      {/* Live Status Badge */}
      <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-100 border border-slate-300 text-xs font-semibold text-slate-700 mb-4">
        <span className="w-2.5 h-2.5 rounded-full bg-teal-500 animate-ping" />
        <span>{scanningStatus}</span>
      </div>

      {/* Hidden processing canvas */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Camera Viewfinder Box */}
      <div
        className={`relative w-full h-72 md:h-80 bg-slate-950 rounded-2xl overflow-hidden mb-6 flex items-center justify-center border-4 transition-all duration-300 ${
          detectedFlash
            ? "border-emerald-400 ring-8 ring-emerald-300 shadow-2xl scale-[1.02]"
            : "border-slate-700 shadow-inner"
        }`}
      >
        {cameraActive && (
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className="w-full h-full object-cover"
          />
        )}

        {/* Viewfinder Target Frame Overlay */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            className={`w-64 h-44 border-4 rounded-2xl relative shadow-lg flex items-center justify-center transition-all ${
              detectedFlash
                ? "border-emerald-400 bg-emerald-400/30 scale-110"
                : "border-teal-400 bg-teal-400/10 animate-pulse"
            }`}
          >
            {/* Corner Accents */}
            <div className="absolute -top-2 -left-2 w-5 h-5 border-t-4 border-l-4 border-teal-300 rounded-tl" />
            <div className="absolute -top-2 -right-2 w-5 h-5 border-t-4 border-r-4 border-teal-300 rounded-tr" />
            <div className="absolute -bottom-2 -left-2 w-5 h-5 border-b-4 border-l-4 border-teal-300 rounded-bl" />
            <div className="absolute -bottom-2 -right-2 w-5 h-5 border-b-4 border-r-4 border-teal-300 rounded-br" />

            <div className="text-[11px] font-mono text-teal-200 font-extrabold bg-slate-950/80 px-2.5 py-1 rounded shadow">
              {detectedFlash ? "✓ DETECTED" : "HOLD ID / QR HERE"}
            </div>

            {/* Scan Beam Line */}
            {!detectedFlash && (
              <div className="w-full h-1 bg-gradient-to-r from-transparent via-teal-300 to-transparent absolute top-1/2 animate-bounce shadow-teal-400/50 shadow-md" />
            )}
          </div>
        </div>

        {cameraError && (
          <div className="absolute inset-0 bg-slate-900/95 flex flex-col items-center justify-center p-6 text-center text-slate-200">
            <span className="text-4xl mb-2">📷</span>
            <p className="text-sm font-semibold mb-3 text-amber-300">
              {cameraError}
            </p>
            <p className="text-xs text-slate-400 mb-4 max-w-xs">
              {lang === "hi"
                ? "कैमरा उपलब्ध नहीं होने पर नीचे दिए गए बटन से नंबर दर्ज करें।"
                : "If camera is in use or unavailable, switch to manual 10-digit keypad."}
            </p>
            <button
              type="button"
              onClick={onSwitchToManual}
              className="py-3 px-6 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-sm shadow-lg transition"
            >
              {t("scanner_manual_fallback", lang)}
            </button>
          </div>
        )}
      </div>

      {/* Interactive Quick Scan Simulator for Kiosk Testing */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-6">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
          {lang === "hi"
            ? "त्वरित नमूना कार्ड स्कैन (1-क्लिक परीक्षण):"
            : "Quick Test Barcodes (1-Click Simulation):"}
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <button
            type="button"
            onClick={() => handleSimulateScan("1000000001")}
            className="py-3 px-2 bg-teal-50 border-2 border-teal-300 rounded-xl hover:bg-teal-100 font-bold text-teal-900 transition flex flex-col items-center justify-center active:scale-95"
          >
            <span className="font-mono text-sm">1000000001</span>
            <span className="text-[10px] text-teal-700 font-normal">
              {lang === "hi" ? "इतिहास वाला मरीज" : "With History"}
            </span>
          </button>
          <button
            type="button"
            onClick={() => handleSimulateScan("1000000002")}
            className="py-3 px-2 bg-teal-50 border-2 border-teal-300 rounded-xl hover:bg-teal-100 font-bold text-teal-900 transition flex flex-col items-center justify-center active:scale-95"
          >
            <span className="font-mono text-sm">1000000002</span>
            <span className="text-[10px] text-teal-700 font-normal">
              {lang === "hi" ? "बिना इतिहास मरीज" : "No History"}
            </span>
          </button>
          <button
            type="button"
            onClick={() => handleSimulateScan("9999999999")}
            className="py-3 px-2 bg-amber-50 border-2 border-amber-300 rounded-xl hover:bg-amber-100 font-bold text-amber-900 transition flex flex-col items-center justify-center active:scale-95"
          >
            <span className="font-mono text-sm">9999999999</span>
            <span className="text-[10px] text-amber-700 font-normal">
              {lang === "hi" ? "नया मरीज" : "New Patient"}
            </span>
          </button>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-4 px-6 border-2 border-slate-300 hover:bg-slate-100 rounded-2xl text-slate-700 font-bold text-lg transition text-center"
        >
          {t("scanner_cancel", lang)}
        </button>
        <button
          type="button"
          onClick={onSwitchToManual}
          className="flex-1 py-4 px-6 bg-clinical-blue hover:bg-clinical-blue-deep text-white font-extrabold text-lg rounded-2xl transition shadow-md text-center"
        >
          {t("scanner_manual_fallback", lang)}
        </button>
      </div>
    </div>
  );
}
