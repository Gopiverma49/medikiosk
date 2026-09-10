"use client";
import React, { useState, useRef, useEffect } from "react";
import { api } from "../lib/api";
import { Language } from "../lib/translations";
import type {
  ClinicalDocumentExtraction,
  DocumentOutDetailed,
  MedicineExtractionItem,
  TestExtractionItem,
} from "../lib/types";

interface Props {
  lang: Language;
  encounterId: string;
  patientId?: string;
  onComplete: (document: DocumentOutDetailed) => void;
  onCancel: () => void;
}

type ScanStage = "idle" | "camera" | "preview" | "processing" | "review" | "confirmed";

interface CapturedPage {
  dataUrl: string;
  file: File;
  rotation: number;
}

export function MedicalReportScanner({
  lang,
  encounterId,
  patientId,
  onComplete,
  onCancel,
}: Props) {
  const [stage, setStage] = useState<ScanStage>("idle");
  const docType = "prescription";
  const [pages, setPages] = useState<CapturedPage[]>([]);
  const [activePageIndex, setActivePageIndex] = useState<number>(0);

  // Camera state
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Quality check state
  const [qualityWarning, setQualityWarning] = useState<string | null>(null);

  // Processing state
  const [processingStep, setProcessingStep] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Extraction & Review state
  const [uploadedDoc, setUploadedDoc] = useState<DocumentOutDetailed | null>(null);
  const [editableExt, setEditableExt] = useState<ClinicalDocumentExtraction | null>(null);
  const [showOriginalModal, setShowOriginalModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showRawOcr, setShowRawOcr] = useState(false);

  // Stop camera stream safely
  const stopCameraStream = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, []);

  // 1. START CAMERA
  const openCamera = async () => {
    setQualityWarning(null);
    setCameraError(null);
    setErrorMsg(null);
    setStage("camera");

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error(
          lang === "hi"
            ? "ब्राउज़र में कैमरा समर्थित नहीं है।"
            : "Camera is not supported in this browser."
        );
      }

      const s = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });

      setStream(s);
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        await videoRef.current.play();
      }
    } catch (err: any) {
      console.warn("Camera init error:", err);
      setCameraError(err.message || "Failed to access camera");
    }
  };

  // 2. CHECK IMAGE SHARPNESS & LIGHTING
  const evaluateQuality = (canvas: HTMLCanvasElement): string | null => {
    try {
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      const w = 160;
      const h = 120;
      const smallCanvas = document.createElement("canvas");
      smallCanvas.width = w;
      smallCanvas.height = h;
      const smallCtx = smallCanvas.getContext("2d");
      if (!smallCtx) return null;

      smallCtx.drawImage(canvas, 0, 0, w, h);
      const imgData = smallCtx.getImageData(0, 0, w, h);
      const data = imgData.data;

      let totalBrightness = 0;
      const gray = new Float32Array(w * h);

      for (let i = 0; i < data.length; i += 4) {
        const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        gray[i / 4] = lum;
        totalBrightness += lum;
      }

      const avgBrightness = totalBrightness / (w * h);

      // Check lighting extremes
      if (avgBrightness < 35) {
        return lang === "hi"
          ? "स्कैन बहुत अंधेरा प्रतीत होता है। कृपया पर्याप्त रोशनी में दस्तावेज़ रखें।"
          : "The scan appears too dark. Please position the document in good lighting.";
      }
      if (avgBrightness > 240) {
        return lang === "hi"
          ? "स्कैन में अत्यधिक चमक है। कृपया चकाचौंध से बचें।"
          : "The scan has severe glare/overexposure. Please reduce glare on the paper.";
      }

      // Laplacian edge sharpness estimation
      let variance = 0;
      let edgeCount = 0;
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const idx = y * w + x;
          const laplacian =
            gray[idx - 1] +
            gray[idx + 1] +
            gray[idx - w] +
            gray[idx + w] -
            4 * gray[idx];
          variance += laplacian * laplacian;
          edgeCount++;
        }
      }
      const score = variance / edgeCount;

      // If score is too low, the text is blurry
      if (score < 45) {
        return lang === "hi"
          ? "स्कैन धुंधला प्रतीत होता है। कृपया कैमरे को स्थिर रखें और पुनः फोटो लें।"
          : "The scan appears blurry. Please hold the camera still and flat to retake.";
      }

      return null;
    } catch {
      return null;
    }
  };

  // 3. CAPTURE SNAPSHOT FROM CAMERA
  const captureSnapshot = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const warn = evaluateQuality(canvas);
    setQualityWarning(warn);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);

    // Convert dataURL to File
    canvas.toBlob((blob) => {
      if (!blob) return;
      const pageNum = pages.length + 1;
      const file = new File([blob], `scan_page_${pageNum}.jpg`, { type: "image/jpeg" });
      const newPage: CapturedPage = { dataUrl, file, rotation: 0 };
      const updated = [...pages, newPage];
      setPages(updated);
      setActivePageIndex(updated.length - 1);
      stopCameraStream();
      setStage("preview");
    }, "image/jpeg", 0.92);
  };

  // 4. FILE UPLOAD FALLBACK (Image or PDF)
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const newFiles = Array.from(e.target.files);
    const newPages: CapturedPage[] = [];

    let loadedCount = 0;
    newFiles.forEach((file) => {
      const isPdf = file.type === "application/pdf" || file.name.endsWith(".pdf");
      if (isPdf) {
        // PDF placeholder thumbnail
        newPages.push({
          dataUrl: "",
          file,
          rotation: 0,
        });
        loadedCount++;
        if (loadedCount === newFiles.length) {
          const merged = [...pages, ...newPages];
          setPages(merged);
          setActivePageIndex(merged.length - 1);
          setStage("preview");
        }
      } else {
        const reader = new FileReader();
        reader.onload = (ev) => {
          newPages.push({
            dataUrl: ev.target?.result as string,
            file,
            rotation: 0,
          });
          loadedCount++;
          if (loadedCount === newFiles.length) {
            const merged = [...pages, ...newPages];
            setPages(merged);
            setActivePageIndex(merged.length - 1);
            setStage("preview");
          }
        };
        reader.readAsDataURL(file);
      }
    });
  };

  // 5. ROTATE ACTIVE PAGE
  const rotatePage = (deg = 90) => {
    if (pages.length === 0) return;
    setPages((prev) =>
      prev.map((p, i) =>
        i === activePageIndex ? { ...p, rotation: (p.rotation + deg) % 360 } : p
      )
    );
  };

  // 6. DELETE PAGE
  const deletePage = (index: number) => {
    const next = pages.filter((_, i) => i !== index);
    setPages(next);
    if (next.length === 0) {
      setStage("idle");
    } else if (activePageIndex >= next.length) {
      setActivePageIndex(next.length - 1);
    }
  };

  // 7. PROCESS & EXTRACT
  const startProcessing = async () => {
    if (pages.length === 0) return;
    setStage("processing");
    setErrorMsg(null);

    try {
      setProcessingStep(lang === "hi" ? "दस्तावेज़ छवि सुरक्षित रूप से अपलोड हो रही है..." : "Saving document pages securely...");
      await new Promise((r) => setTimeout(r, 400));

      setProcessingStep(lang === "hi" ? "फोटो से लिखावट और टेक्स्ट पढ़ा जा रहा है (OCR)..." : "Reading handwriting & text from photo (OCR)...");

      const files = pages.map((p) => p.file);
      const res = await api.uploadScanDocument(encounterId, files, docType, patientId);

      setProcessingStep(lang === "hi" ? "दवाइयों और जांच रिपोर्ट का सारांश तैयार हो रहा है..." : "Extracting medications and clinical summary...");
      await new Promise((r) => setTimeout(r, 400));

      setUploadedDoc(res);
      setEditableExt(
        res.extracted_data || {
          report_date: null,
          reason_for_visit: null,
          symptoms: [],
          diagnosis: [],
          past_medical_history: [],
          allergies: [],
          vitals_and_examination: null,
          tests: [],
          imaging_findings: [],
          medicines: [],
          procedures_and_treatments: [],
          doctor_advice: [],
          follow_up: null,
          timeline_events: [],
        }
      );
      setStage("review");
    } catch (err: any) {
      console.error("Document scan processing failed:", err);
      setErrorMsg(err.message || "Failed to process document");
      setStage("preview");
    }
  };

  // 8. SAVE & CONFIRM EXTRACTED DATA
  const handleConfirmSave = async () => {
    if (!uploadedDoc || !editableExt) return;
    setIsSaving(true);
    setErrorMsg(null);

    try {
      const confirmed = await api.confirmDocument(
        uploadedDoc.id,
        editableExt,
        "Patient (Verified via Kiosk)"
      );
      setUploadedDoc(confirmed);
      setStage("confirmed");
      onComplete(confirmed);
    } catch (err: any) {
      console.error("Confirmation error:", err);
      setErrorMsg(err.message || "Failed to save confirmed report");
    } finally {
      setIsSaving(false);
    }
  };

  // Helpers for editing items in review screen
  const addMedicine = () => {
    if (!editableExt) return;
    const name = prompt(lang === "hi" ? "दवा का नाम दर्ज करें:" : "Enter medicine name (e.g. Paracetamol):");
    if (!name || !name.trim()) return;
    const dose = prompt(lang === "hi" ? "खुराक / आवृत्ति (वैकल्पिक):" : "Dose / Frequency (optional, e.g. 500mg Once Daily):");
    const newMed: MedicineExtractionItem = {
      name: name.trim(),
      strength: dose && dose.trim() ? dose.trim() : null,
      dosage: null,
      route: "Oral",
      frequency: null,
      timing: null,
      duration: null,
    };
    setEditableExt({ ...editableExt, medicines: [...editableExt.medicines, newMed] });
  };

  const removeMedicine = (index: number) => {
    if (!editableExt) return;
    setEditableExt({
      ...editableExt,
      medicines: editableExt.medicines.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="w-full max-w-3xl mx-auto bg-white border-2 border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xl">
      {/* Hidden processing canvas */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept="image/*,application/pdf"
        multiple
        className="hidden"
      />

      {/* ERROR BANNER */}
      {errorMsg && (
        <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-300 text-rose-800 text-sm font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">⚠️</span>
            <span>{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="text-rose-500 hover:text-rose-800 font-bold ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* STAGE 1: IDLE / SCAN REPORT SELECTION */}
      {stage === "idle" && (
        <div className="text-center py-4">
          <div className="w-20 h-20 bg-teal-50 border-2 border-teal-200 text-teal-700 rounded-3xl flex items-center justify-center text-4xl mx-auto mb-4 shadow-sm">
            📷
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mb-2">
            {lang === "hi" ? "दस्तावेज़ / रिपोर्ट स्कैन करें" : "Scan Medical Report"}
          </h2>
          <p className="text-slate-500 text-sm max-w-md mx-auto mb-8">
            {lang === "hi"
              ? "दस्तावेज़ की फोटो लें या फाइल अपलोड करें।"
              : "Capture or upload your medical report for clinical extraction."}
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-md mx-auto">
            <button
              id="btn-scan-report"
              type="button"
              onClick={openCamera}
              className="flex-1 py-4 px-6 bg-teal-700 hover:bg-teal-800 active:scale-98 text-white rounded-2xl font-black text-lg shadow-xl transition flex items-center justify-center gap-3 border-2 border-teal-600"
            >
              <span className="text-xl">📷</span>
              <span>{lang === "hi" ? "रिपोर्ट स्कैन करें" : "Scan Report"}</span>
            </button>
            <button
              id="btn-upload-file"
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 py-4 px-6 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-2xl font-bold text-base transition flex items-center justify-center gap-2"
            >
              <span>📁</span>
              <span>{lang === "hi" ? "फाइल / पीडीएफ अपलोड करें" : "Upload JPG/PNG/PDF"}</span>
            </button>
          </div>

          <div className="mt-8">
            <button
              type="button"
              onClick={onCancel}
              className="text-xs text-slate-400 hover:text-slate-600 font-bold"
            >
              ← {lang === "hi" ? "बिना दस्तावेज़ के आगे बढ़ें" : "Skip and continue without document"}
            </button>
          </div>
        </div>
      )}

      {/* STAGE 2: LIVE CAMERA VIEWFINDER */}
      {stage === "camera" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-xl font-extrabold text-slate-900">
                {lang === "hi" ? "दस्तावेज़ को फ्रेम में संरेखित करें" : "Align Document in Frame"}
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                {lang === "hi"
                  ? "दस्तावेज़ को समतल और अच्छी रोशनी में रखें"
                  : "Keep paper flat with all four corners visible in good light"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                stopCameraStream();
                setStage(pages.length > 0 ? "preview" : "idle");
              }}
              className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-600 hover:bg-slate-100"
            >
              ✕ {lang === "hi" ? "रद्द करें" : "Cancel"}
            </button>
          </div>

          {/* Camera Box */}
          <div className="relative w-full h-80 sm:h-96 bg-slate-950 rounded-3xl overflow-hidden border-4 border-slate-800 shadow-inner flex items-center justify-center">
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className="w-full h-full object-cover"
            />

            {/* Document Reticle / Perspective Guide */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-6">
              <div className="w-full h-full max-w-sm max-h-72 border-2 border-dashed border-teal-400/80 rounded-2xl relative shadow-lg">
                {/* Corner markers */}
                <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-teal-400 rounded-tl-lg" />
                <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-teal-400 rounded-tr-lg" />
                <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-teal-400 rounded-bl-lg" />
                <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-teal-400 rounded-br-lg" />

                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-slate-900/80 backdrop-blur px-3 py-1 rounded-full text-[10px] font-mono text-teal-300 font-bold uppercase tracking-wider">
                  {lang === "hi" ? "पेज " + (pages.length + 1) : `Capturing Page ${pages.length + 1}`}
                </div>
              </div>
            </div>

            {cameraError && (
              <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center p-6 text-center text-white">
                <span className="text-3xl mb-2">📷</span>
                <p className="text-sm font-bold text-amber-300 mb-2">{cameraError}</p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="py-2.5 px-5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl"
                >
                  {lang === "hi" ? "फाइल चुनें" : "Upload File Instead"}
                </button>
              </div>
            )}
          </div>

          {/* Camera Controls */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="py-3 px-4 border border-slate-300 hover:bg-slate-100 rounded-2xl text-xs font-bold text-slate-700"
            >
              📁 {lang === "hi" ? "गैलरी से चुनें" : "Choose File"}
            </button>

            {/* Prominent Capture Button */}
            <button
              type="button"
              onClick={captureSnapshot}
              className="w-18 h-18 sm:w-20 sm:h-20 bg-teal-600 hover:bg-teal-700 active:scale-95 text-white rounded-full p-2 border-4 border-white shadow-xl flex items-center justify-center transition"
            >
              <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center text-2xl">
                📸
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                stopCameraStream();
                setStage(pages.length > 0 ? "preview" : "idle");
              }}
              className="py-3 px-4 text-xs font-bold text-slate-500 hover:text-slate-800"
            >
              {lang === "hi" ? "वापस" : "Back"}
            </button>
          </div>
        </div>
      )}

      {/* STAGE 3: PREVIEW & MULTI-PAGE MANAGEMENT */}
      {stage === "preview" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-extrabold text-slate-900">
                {lang === "hi" ? "स्कैन का पूर्वावलोकन" : "Review Scanned Pages"} ({pages.length})
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                {lang === "hi"
                  ? "यदि आवश्यक हो तो और पेज जोड़ें या घुमाएँ।"
                  : "Check clarity, rotate if needed, or add more pages before extracting."}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => rotatePage(90)}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 flex items-center gap-1.5"
                title="Rotate 90 degrees"
              >
                <span>🔄</span>
                <span>{lang === "hi" ? "घुमाएँ" : "Rotate"}</span>
              </button>
              <button
                type="button"
                onClick={() => deletePage(activePageIndex)}
                className="px-3 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl text-xs font-bold text-rose-700"
              >
                🗑️ {lang === "hi" ? "हटाएँ" : "Delete"}
              </button>
            </div>
          </div>

          {/* Quality Warning Alert */}
          {qualityWarning && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 text-xs font-medium flex items-start gap-3 shadow-sm">
              <span className="text-xl">⚠️</span>
              <div className="flex-1">
                <div className="font-bold mb-0.5">
                  {lang === "hi" ? "स्कैन स्पष्टता चेतावनी" : "Scan Quality Warning"}
                </div>
                <p>{qualityWarning}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  deletePage(activePageIndex);
                  openCamera();
                }}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold whitespace-nowrap shadow-sm"
              >
                {lang === "hi" ? "पुनः फोटो लें" : "Retake"}
              </button>
            </div>
          )}

          {/* Active Page Preview Canvas/Box */}
          <div className="relative w-full h-80 sm:h-96 bg-slate-900 rounded-3xl overflow-hidden flex items-center justify-center p-4 border border-slate-200 shadow-inner">
            {pages[activePageIndex]?.dataUrl ? (
              <img
                src={pages[activePageIndex].dataUrl}
                alt={`Scan Page ${activePageIndex + 1}`}
                style={{ transform: `rotate(${pages[activePageIndex].rotation}deg)` }}
                className="max-h-full max-w-full object-contain transition-transform duration-200 rounded-lg shadow-md"
              />
            ) : (
              <div className="text-center text-white p-6">
                <span className="text-5xl mb-2 block">📄</span>
                <p className="text-sm font-bold">
                  {pages[activePageIndex]?.file.name || "PDF Document"}
                </p>
                <span className="text-xs text-slate-400">
                  Ready for Optical Character Extraction
                </span>
              </div>
            )}

            <div className="absolute top-4 left-4 bg-slate-950/80 backdrop-blur px-3 py-1 rounded-full text-xs font-mono text-white font-bold">
              Page {activePageIndex + 1} of {pages.length}
            </div>
          </div>

          {/* Multi-page Thumbnail Strip */}
          <div className="flex items-center gap-3 overflow-x-auto pb-2">
            {pages.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setActivePageIndex(idx)}
                className={`relative flex-shrink-0 w-20 h-24 rounded-xl overflow-hidden border-2 transition ${
                  activePageIndex === idx
                    ? "border-teal-600 ring-2 ring-teal-400"
                    : "border-slate-300 opacity-70 hover:opacity-100"
                }`}
              >
                {p.dataUrl ? (
                  <img
                    src={p.dataUrl}
                    alt={`Thumb ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600">
                    PDF
                  </div>
                )}
                <span className="absolute bottom-1 right-1 bg-slate-900/80 text-white text-[10px] px-1.5 py-0.5 rounded font-mono font-bold">
                  p.{idx + 1}
                </span>
              </button>
            ))}

            {/* Add Next Page Button */}
            <button
              type="button"
              onClick={openCamera}
              className="flex-shrink-0 w-20 h-24 border-2 border-dashed border-slate-300 hover:border-teal-500 rounded-xl flex flex-col items-center justify-center text-slate-500 hover:text-teal-700 bg-slate-50 transition"
            >
              <span className="text-2xl">+</span>
              <span className="text-[10px] font-bold mt-1">
                {lang === "hi" ? "पेज जोड़ें" : "Add Page"}
              </span>
            </button>
          </div>

          {/* Action Row */}
          <div className="flex flex-col sm:flex-row gap-4 pt-2">
            <button
              type="button"
              onClick={() => {
                deletePage(activePageIndex);
                openCamera();
              }}
              className="py-4 px-6 border-2 border-slate-300 hover:bg-slate-100 rounded-2xl font-bold text-slate-700 text-sm transition"
            >
              🔄 {lang === "hi" ? "पुनः फोटो लें" : "Retake"}
            </button>
            <button
              type="button"
              onClick={startProcessing}
              className="flex-1 py-4 px-8 bg-teal-600 hover:bg-teal-700 active:scale-98 text-white rounded-2xl font-black text-base shadow-lg transition flex items-center justify-center gap-2"
            >
              <span>⚡</span>
              <span>
                {lang === "hi" ? "चिकित्सीय जानकारी निकालें" : "Process & Extract Medical Data"} →
              </span>
            </button>
          </div>
        </div>
      )}

      {/* STAGE 4: PROCESSING RADAR ANIMATION */}
      {stage === "processing" && (
        <div className="py-12 text-center space-y-6">
          <div className="relative w-28 h-28 mx-auto flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border-4 border-teal-200 animate-ping opacity-75" />
            <div className="w-24 h-24 rounded-full bg-teal-50 border-4 border-teal-600 flex items-center justify-center text-4xl shadow-lg">
              🔍
            </div>
          </div>

          <div>
            <h3 className="text-2xl font-black text-slate-900 mb-2">
              {lang === "hi" ? "एआई मेडिकल स्कैन विश्लेषण" : "AI Clinical Extraction in Progress"}
            </h3>
            <p className="text-slate-600 text-sm font-medium animate-pulse">
              {processingStep || "Processing..."}
            </p>
          </div>

          <div className="max-w-xs mx-auto bg-slate-100 rounded-full h-2 overflow-hidden">
            <div className="bg-teal-600 h-full w-2/3 animate-pulse rounded-full" />
          </div>

          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {lang === "hi"
              ? "दवाइयों, जांच रिपोर्ट और तारीखों की जांच की जा रही है। कोई भी निजी पहचान या अनावश्यक डेटा नहीं निकाला जा रहा है।"
              : "Preserving exact medication doses, dates, and test values without hallucinating or diagnosing."}
          </p>
        </div>
      )}

      {/* STAGE 5: SUMMARIZED CONFIRMATION REVIEW SCREEN (MATCHING REFERENCE DESIGN) */}
      {stage === "review" && editableExt && (
        <div className="space-y-4 max-w-lg mx-auto">
          {/* Header Row: Title & View Original Report button */}
          <div className="flex items-start justify-between pb-3 border-b border-slate-200 gap-3">
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight uppercase leading-tight">
                {lang === "hi" ? "निकाली गई जानकारी" : "REVIEW EXTRACTED"}
                <br />
                <span className="text-slate-900">{lang === "hi" ? "का क्लिनिकल सारांश" : "CLINICAL SUMMARY"}</span>
              </h3>
            </div>

            {/* View Original Scanned Image Button */}
            <button
              type="button"
              onClick={() => setShowOriginalModal(true)}
              className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-800 rounded-xl text-xs font-bold border border-slate-300 flex items-center gap-1.5 shadow-xs flex-shrink-0 transition"
            >
              <span className="text-base">👁️</span>
              <span className="text-[11px] font-bold text-slate-800 leading-tight text-left">
                {lang === "hi" ? "मूल रिपोर्ट\nदेखें" : "View Original\nReport"}
              </span>
            </button>
          </div>

          {/* Unified Clinical Content Flow */}
          <div className="space-y-3.5 py-1">
            {/* 1. VISIT DETAILS */}
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-black text-slate-900 tracking-wider uppercase">
                <span>📅</span>
                <span>{lang === "hi" ? "मुलाकात का विवरण" : "VISIT DETAILS"}</span>
              </div>
              <div className="text-xs text-slate-800 leading-relaxed">
                {editableExt.report_date ? (
                  <>
                    <span className="font-bold text-slate-900">{lang === "hi" ? "तारीख:" : "Date:"}</span>{" "}
                    <span>{editableExt.report_date}</span>
                  </>
                ) : null}
                {editableExt.report_date && editableExt.reason_for_visit && (
                  <span className="text-slate-400 mx-1.5 font-normal">|</span>
                )}
                {editableExt.reason_for_visit ? (
                  <>
                    <span className="font-bold text-slate-900">{lang === "hi" ? "मुलाकात का कारण:" : "Reason for Visit:"}</span>{" "}
                    <span>{editableExt.reason_for_visit}</span>
                  </>
                ) : null}
                {!editableExt.report_date && !editableExt.reason_for_visit && (
                  <span className="text-slate-400 italic">{lang === "hi" ? "दस्तावेज़ में तारीख/कारण नहीं मिला" : "Not specified in report"}</span>
                )}
              </div>
            </div>

            {/* 2. CLINICAL DIAGNOSIS */}
            {editableExt.diagnosis && editableExt.diagnosis.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-black text-slate-900 tracking-wider uppercase">
                  <span>📋</span>
                  <span>{lang === "hi" ? "क्लिनिकल निदान" : "CLINICAL DIAGNOSIS"}</span>
                </div>
                <div className="text-xs text-slate-800 leading-relaxed">
                  <span className="font-bold text-slate-900">{lang === "hi" ? "प्राथमिक:" : "Primary:"}</span>{" "}
                  <span>{editableExt.diagnosis[0]}</span>
                  {editableExt.diagnosis.length > 1 && (
                    <>
                      <span className="text-slate-400 mx-1.5 font-normal">|</span>
                      <span className="font-bold text-slate-900">{lang === "hi" ? "द्वितीयक:" : "Secondary:"}</span>{" "}
                      <span>{editableExt.diagnosis.slice(1).join(", ")}</span>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* 3. LABORATORY BLOOD COUNTS OR BADGE */}
            {editableExt.tests && editableExt.tests.length > 0 ? (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-black text-slate-900 tracking-wider uppercase">
                  <span>🔬</span>
                  <span>{lang === "hi" ? "प्रयोगशाला रक्त जांच" : "LABORATORY BLOOD COUNTS"}</span>
                </div>
                <div className="flex flex-wrap gap-2 pt-0.5">
                  {editableExt.tests.map((t, idx) => {
                    const isHigh = t.flag?.toLowerCase().includes("high") || t.flag?.toLowerCase().includes("abnormal");
                    return (
                      <div
                        key={idx}
                        className={`px-3 py-1 rounded-lg text-xs font-medium border flex items-center gap-1 shadow-2xs ${
                          isHigh
                            ? "bg-rose-100 text-rose-900 border-rose-200"
                            : "bg-teal-50 text-teal-900 border-teal-200"
                        }`}
                      >
                        <span className="font-bold">{t.name}:</span>
                        <span>
                          {t.value} {t.unit || ""}
                          {t.flag && t.flag !== "Normal" ? ` (${t.flag})` : ""}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div>
                <span className="inline-block px-3 py-1 bg-teal-800 text-white rounded-lg text-xs font-bold shadow-2xs">
                  {lang === "hi" ? "कोई प्रयोगशाला जांच नहीं मिली" : "No Laboratory Tests Extracted"}
                </span>
              </div>
            )}

            {/* 4. EXTRACTED MEDICINES */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-black text-slate-900 tracking-wider uppercase">
                  <span>💊</span>
                  <span>{lang === "hi" ? "निकाली गई दवाइयाँ" : "EXTRACTED MEDICINES"}</span>
                </div>
                <button
                  type="button"
                  onClick={addMedicine}
                  className="text-[11px] font-bold text-teal-700 hover:text-teal-900"
                >
                  + {lang === "hi" ? "दवा जोड़ें" : "Add Medicine"}
                </button>
              </div>

              {editableExt.medicines && editableExt.medicines.length > 0 ? (
                <ul className="space-y-1 text-xs text-slate-800">
                  {editableExt.medicines.map((med, idx) => {
                    const details: string[] = [];
                    if (med.frequency) details.push(med.frequency);
                    if (med.timing) details.push(med.timing);
                    if (med.duration) details.push(`for ${med.duration}`);

                    return (
                      <li key={idx} className="flex items-start justify-between gap-2 group">
                        <div className="flex items-start gap-1.5 leading-relaxed">
                          <span className="text-slate-900 font-bold">•</span>
                          <span>
                            <span className="font-semibold text-slate-900">{med.name}</span>
                            {med.strength && <span className="text-slate-700 font-medium"> ({med.strength})</span>}
                            {details.length > 0 && (
                              <span className="text-slate-600"> - {details.join(", ")}</span>
                            )}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeMedicine(idx)}
                          className="text-slate-300 hover:text-rose-600 text-xs px-1"
                          title="Remove medicine"
                        >
                          ✕
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div>
                  <span className="inline-block px-3 py-1 bg-slate-600 text-white rounded-lg text-xs font-bold shadow-2xs">
                    {lang === "hi" ? "कोई दवा नहीं मिली" : "No Medicines Extracted"}
                  </span>
                </div>
              )}
            </div>

            {/* 5. FOLLOW-UP / REVIEW PLAN */}
            <div className="space-y-1 pt-1">
              <div className="text-xs font-bold text-slate-900">
                {lang === "hi" ? "फॉलो-अप / समीक्षा योजना" : "Follow-up / Review Plan"}
              </div>
              <div className="text-xs text-slate-600 italic">
                {editableExt.follow_up?.date_or_duration
                  ? editableExt.follow_up.date_or_duration
                  : editableExt.doctor_advice && editableExt.doctor_advice.length > 0
                  ? editableExt.doctor_advice.join(", ")
                  : (lang === "hi" ? "उदा. 5 दिनों के बाद समीक्षा, आवश्यकतानुसार" : "e.g. Review after 5 days, SOS")}
              </div>
            </div>

            {/* 6. Raw OCR Drawer */}
            {uploadedDoc?.ocr_text && (
              <div className="pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowRawOcr(!showRawOcr)}
                  className="text-[11px] font-bold text-slate-400 hover:text-slate-600 flex items-center gap-1"
                >
                  <span>{showRawOcr ? "▲" : "▼"}</span>
                  <span>{lang === "hi" ? "फोटो से पढ़ा गया टेक्स्ट देखें" : "View text detected from photo"}</span>
                </button>
                {showRawOcr && (
                  <pre className="mt-2 p-3 bg-slate-50 rounded-xl text-[11px] font-mono text-slate-700 whitespace-pre-wrap leading-relaxed border border-slate-200 max-h-36 overflow-y-auto">
                    {uploadedDoc.ocr_text}
                  </pre>
                )}
              </div>
            )}
          </div>

          {/* Action Confirmation Row */}
          <div className="flex flex-col sm:flex-row gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setStage("preview")}
              className="py-3.5 px-6 border-2 border-slate-300 hover:bg-slate-100 rounded-2xl font-bold text-slate-700 text-sm transition text-center"
            >
              ← {lang === "hi" ? "पुनः फोटो लें" : "Retake Photo"}
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={handleConfirmSave}
              className="flex-1 py-3.5 px-8 bg-teal-600 hover:bg-teal-700 active:scale-98 text-white rounded-2xl font-black text-base shadow-lg transition flex items-center justify-center gap-2"
            >
              <span>✓</span>
              <span>
                {isSaving
                  ? (lang === "hi" ? "सहेजा जा रहा है..." : "Saving...")
                  : (lang === "hi" ? "पुष्टि करें और आगे बढ़ें →" : "Confirm & Save to Health Record →")}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* STAGE 6: CONFIRMED SUCCESS */}
      {stage === "confirmed" && uploadedDoc && (
        <div className="text-center py-6 space-y-4">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center text-3xl font-black mx-auto shadow-inner">
            ✓
          </div>
          <h3 className="text-2xl font-black text-slate-900">
            {lang === "hi" ? "रिपोर्ट सफलतापूर्वक सहेजी गई" : "Report Confirmed & Saved"}
          </h3>
          <p className="text-slate-500 text-sm max-w-md mx-auto">
            {lang === "hi"
              ? "आपकी रिपोर्ट और दवाइयों की जानकारी डॉक्टर परामर्श कक्ष में उपलब्ध करा दी गई है।"
              : "Your verified clinical report is now safely linked to your encounter and visible to your doctor."}
          </p>

          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-mono font-bold text-emerald-800 max-w-sm mx-auto">
            Document ID: {uploadedDoc.id.slice(0, 13)}... | Status: CONFIRMED
          </div>

          <div className="flex gap-4 justify-center pt-2">
            <button
              type="button"
              onClick={() => {
                setPages([]);
                setEditableExt(null);
                setUploadedDoc(null);
                setStage("idle");
              }}
              className="py-3 px-6 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-2xl text-xs font-bold border border-slate-300"
            >
              + {lang === "hi" ? "एक और रिपोर्ट स्कैन करें" : "Scan Another Report"}
            </button>
          </div>
        </div>
      )}

      {/* ORIGINAL REPORT INSPECTION MODAL */}
      {showOriginalModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-4 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
              <div className="font-extrabold text-sm text-slate-800 flex items-center gap-2">
                <span>📄</span>
                <span>Original Scanned Report ({pages.length} Pages)</span>
              </div>
              <button
                type="button"
                onClick={() => setShowOriginalModal(false)}
                className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center font-bold text-slate-700 text-sm"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-slate-900 flex items-center justify-center min-h-[300px]">
              {pages[activePageIndex]?.dataUrl ? (
                <img
                  src={pages[activePageIndex].dataUrl}
                  alt="Original Report"
                  style={{ transform: `rotate(${pages[activePageIndex].rotation}deg)` }}
                  className="max-h-[70vh] object-contain rounded-lg shadow-lg"
                />
              ) : (
                <div className="text-white text-sm font-semibold">
                  Original Document uploaded as PDF.
                </div>
              )}
            </div>

            {pages.length > 1 && (
              <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-center gap-2">
                {pages.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setActivePageIndex(i)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold ${
                      activePageIndex === i
                        ? "bg-teal-600 text-white"
                        : "bg-white border border-slate-300 text-slate-700"
                    }`}
                  >
                    Page {i + 1}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
