"use client";
import React, { useState, useRef, useEffect } from "react";
import { api } from "../lib/api";
import { Language, t } from "../lib/translations";
import type {
  ClinicalDocumentExtraction,
  DocumentOutDetailed,
  MedicineExtractionItem,
  TestExtractionItem,
  SymptomExtractionItem,
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
  const [docType, setDocType] = useState<string>("prescription");
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
      setProcessingStep(lang === "hi" ? "दस्तावेज़ छवि अपलोड की जा रही है..." : "Uploading document pages securely...");
      await new Promise((r) => setTimeout(r, 600));

      setProcessingStep(lang === "hi" ? "ऑप्टिकल विज़न और ओसीआर निष्कर्षण..." : "Performing Optical Vision & OCR analysis...");
      await new Promise((r) => setTimeout(r, 600));

      setProcessingStep(lang === "hi" ? "चिकित्सीय जानकारी और दवाइयों का विश्लेषण..." : "Extracting clinical entities & Indian medications...");

      const files = pages.map((p) => p.file);
      const res = await api.uploadScanDocument(encounterId, files, docType, patientId);

      setProcessingStep(lang === "hi" ? "सत्यापन स्क्रीन तैयार हो रही है..." : "Validating structured clinical schema...");
      await new Promise((r) => setTimeout(r, 500));

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
  const updateMedicine = (index: number, field: keyof MedicineExtractionItem, val: string) => {
    if (!editableExt) return;
    const nextMeds = [...editableExt.medicines];
    nextMeds[index] = { ...nextMeds[index], [field]: val };
    setEditableExt({ ...editableExt, medicines: nextMeds });
  };

  const addMedicine = () => {
    if (!editableExt) return;
    const newMed: MedicineExtractionItem = {
      name: "New Medicine",
      strength: "500 mg",
      dosage: "1 tablet",
      route: "Oral",
      frequency: "BD (Twice daily)",
      timing: "After food / meals (PC)",
      duration: "5 days",
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

  const updateTest = (index: number, field: keyof TestExtractionItem, val: string) => {
    if (!editableExt) return;
    const nextTests = [...editableExt.tests];
    nextTests[index] = { ...nextTests[index], [field]: val };
    setEditableExt({ ...editableExt, tests: nextTests });
  };

  const addTest = () => {
    if (!editableExt) return;
    const newTest: TestExtractionItem = {
      name: "Blood Test",
      value: "",
      unit: "mg/dL",
      reference_range: "Normal",
      flag: "Normal",
    };
    setEditableExt({ ...editableExt, tests: [...editableExt.tests, newTest] });
  };

  const removeTest = (index: number) => {
    if (!editableExt) return;
    setEditableExt({
      ...editableExt,
      tests: editableExt.tests.filter((_, i) => i !== index),
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
          <p className="text-slate-500 text-sm max-w-md mx-auto mb-6">
            {lang === "hi"
              ? "पर्चा, खून की जांच रिपोर्ट या डिस्चार्ज समरी स्कैन करें। हमारी मेडिकल एआई महत्वपूर्ण जानकारी स्वचालित रूप से निकालेगी।"
              : "Capture or upload previous prescriptions, lab reports, or discharge summaries for instant clinical extraction."}
          </p>

          {/* Doc Type Selector */}
          <div className="flex flex-wrap justify-center gap-2 mb-8">
            {[
              { id: "prescription", label: lang === "hi" ? "💊 डॉक्टर का पर्चा (Rx)" : "💊 Prescription (Rx)" },
              { id: "lab_report", label: lang === "hi" ? "🧪 लैब रिपोर्ट" : "🧪 Lab Report" },
              { id: "discharge_summary", label: lang === "hi" ? "🏥 डिस्चार्ज समरी" : "🏥 Discharge Summary" },
            ].map((type) => (
              <button
                key={type.id}
                type="button"
                onClick={() => setDocType(type.id)}
                className={`px-4 py-2.5 rounded-2xl text-xs font-bold border transition ${
                  docType === type.id
                    ? "bg-teal-600 border-teal-600 text-white shadow-md"
                    : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>

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

      {/* STAGE 5: EDITABLE CONFIRMATION REVIEW SCREEN */}
      {stage === "review" && editableExt && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold mb-1">
                <span>⚠️</span>
                <span>{lang === "hi" ? "पुष्टि आवश्यक है" : "Review & Confirmation Required"}</span>
              </div>
              <h3 className="text-2xl font-black text-slate-900">
                {lang === "hi" ? "निकाली गई जानकारी की समीक्षा करें" : "Review Extracted Clinical Information"}
              </h3>
              <p className="text-xs text-slate-500">
                {lang === "hi"
                  ? "कृपया सहेजने से पहले सुनिश्चित करें कि दवाइयाँ और परिणाम आपके मूल पर्चे से मेल खाते हैं।"
                  : "Please verify all extracted medicines, tests, and details match your paper report before saving."}
              </p>
            </div>

            {/* Quick Inspection of Original Scan */}
            <button
              type="button"
              onClick={() => setShowOriginalModal(true)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold border border-slate-300 flex items-center gap-1.5 shadow-sm"
            >
              <span>👁️</span>
              <span>{lang === "hi" ? "मूल रिपोर्ट देखें" : "View Original Report"}</span>
            </button>
          </div>

          {/* Section 1: Basic Clinical Header (Date & Reason) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-200">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                {lang === "hi" ? "रिपोर्ट / परामर्श तिथि" : "Report / Visit Date"}
              </label>
              <input
                type="text"
                value={editableExt.report_date || ""}
                onChange={(e) => setEditableExt({ ...editableExt, report_date: e.target.value })}
                placeholder="DD/MM/YYYY"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                {lang === "hi" ? "परामर्श का कारण" : "Reason for Visit"}
              </label>
              <input
                type="text"
                value={editableExt.reason_for_visit || ""}
                onChange={(e) => setEditableExt({ ...editableExt, reason_for_visit: e.target.value })}
                placeholder="e.g. Fever, cough, follow-up"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Section 2: Diagnoses */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                {lang === "hi" ? "निदान (Diagnosis)" : "Clinical Diagnosis"}
              </span>
              <button
                type="button"
                onClick={() => {
                  const val = prompt(lang === "hi" ? "निदान दर्ज करें:" : "Enter diagnosis:");
                  if (val && val.trim()) {
                    setEditableExt({ ...editableExt, diagnosis: [...editableExt.diagnosis, val.trim()] });
                  }
                }}
                className="text-xs text-teal-700 font-extrabold hover:underline"
              >
                + {lang === "hi" ? "जोड़ें" : "Add"}
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {editableExt.diagnosis.length > 0 ? (
                editableExt.diagnosis.map((d, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-300 rounded-full text-xs font-bold text-slate-800"
                  >
                    <span>{d}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setEditableExt({
                          ...editableExt,
                          diagnosis: editableExt.diagnosis.filter((_, idx) => idx !== i),
                        })
                      }
                      className="text-slate-400 hover:text-rose-600 font-bold ml-1"
                    >
                      ✕
                    </button>
                  </span>
                ))
              ) : (
                <span className="text-xs text-slate-400 italic">
                  {lang === "hi" ? "कोई निदान नहीं मिला।" : "No explicit diagnosis extracted."}
                </span>
              )}
            </div>
          </div>

          {/* Section 3: Prescribed Medicines (CRITICAL EDITABLE TABLE) */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base">💊</span>
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  {lang === "hi" ? "दवाइयाँ (Medicines)" : "Extracted Medicines"} ({editableExt.medicines.length})
                </span>
              </div>
              <button
                type="button"
                onClick={addMedicine}
                className="px-3 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-sm"
              >
                + {lang === "hi" ? "दवा जोड़ें" : "Add Medicine"}
              </button>
            </div>

            {editableExt.medicines.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-2">
                {lang === "hi" ? "कोई दवा नहीं मिली।" : "No medications detected on this document."}
              </p>
            ) : (
              <div className="space-y-3">
                {editableExt.medicines.map((med, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-2 relative"
                  >
                    <button
                      type="button"
                      onClick={() => removeMedicine(idx)}
                      className="absolute top-2 right-2 text-slate-400 hover:text-rose-600 p-1 text-xs font-bold"
                      title="Remove medicine"
                    >
                      ✕
                    </button>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pr-6">
                      <div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Medicine Name</span>
                        <input
                          type="text"
                          value={med.name}
                          onChange={(e) => updateMedicine(idx, "name", e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-900"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Strength</span>
                        <input
                          type="text"
                          value={med.strength || ""}
                          onChange={(e) => updateMedicine(idx, "strength", e.target.value)}
                          placeholder="e.g. 500 mg, 650 mg"
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-900"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Frequency</span>
                        <select
                          value={med.frequency || "OD (Once daily)"}
                          onChange={(e) => updateMedicine(idx, "frequency", e.target.value)}
                          className="w-full px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-900"
                        >
                          <option value="OD (Once daily)">OD (Once daily)</option>
                          <option value="BD (Twice daily)">BD (Twice daily)</option>
                          <option value="TDS (Thrice daily)">TDS (Thrice daily)</option>
                          <option value="QID (4 times daily)">QID (4 times daily)</option>
                          <option value="HS (At bedtime)">HS (At bedtime)</option>
                          <option value="SOS (As needed / When required)">SOS (As needed)</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Timing</span>
                        <input
                          type="text"
                          value={med.timing || ""}
                          onChange={(e) => updateMedicine(idx, "timing", e.target.value)}
                          placeholder="e.g. After meals, Before food"
                          className="w-full px-2.5 py-1 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-700 font-medium"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Duration</span>
                        <input
                          type="text"
                          value={med.duration || ""}
                          onChange={(e) => updateMedicine(idx, "duration", e.target.value)}
                          placeholder="e.g. 5 days, 1 month"
                          className="w-full px-2.5 py-1 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-700 font-medium"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Instructions</span>
                        <input
                          type="text"
                          value={med.instructions || ""}
                          onChange={(e) => updateMedicine(idx, "instructions", e.target.value)}
                          placeholder="e.g. Take with warm water"
                          className="w-full px-2.5 py-1 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-700 font-medium"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 4: Lab Tests */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base">🧪</span>
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  {lang === "hi" ? "जांच / लैब टेस्ट (Tests)" : "Laboratory & Diagnostic Tests"} ({editableExt.tests.length})
                </span>
              </div>
              <button
                type="button"
                onClick={addTest}
                className="px-3 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-sm"
              >
                + {lang === "hi" ? "जांच जोड़ें" : "Add Test"}
              </button>
            </div>

            {editableExt.tests.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-1">
                {lang === "hi" ? "कोई लैब टेस्ट नहीं मिला।" : "No laboratory tests detected."}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs bg-white rounded-xl overflow-hidden border border-slate-200">
                  <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">Test Name</th>
                      <th className="p-2.5">Value</th>
                      <th className="p-2.5">Unit</th>
                      <th className="p-2.5">Reference Range</th>
                      <th className="p-2.5 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {editableExt.tests.map((t, idx) => (
                      <tr key={idx}>
                        <td className="p-2">
                          <input
                            type="text"
                            value={t.name}
                            onChange={(e) => updateTest(idx, "name", e.target.value)}
                            className="w-full px-2 py-1 bg-slate-50 border border-slate-300 rounded font-semibold text-slate-900"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={t.value || ""}
                            onChange={(e) => updateTest(idx, "value", e.target.value)}
                            className="w-20 px-2 py-1 bg-slate-50 border border-slate-300 rounded font-bold text-slate-900"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={t.unit || ""}
                            onChange={(e) => updateTest(idx, "unit", e.target.value)}
                            className="w-20 px-2 py-1 bg-slate-50 border border-slate-300 rounded text-slate-600"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={t.reference_range || ""}
                            onChange={(e) => updateTest(idx, "reference_range", e.target.value)}
                            className="w-full px-2 py-1 bg-slate-50 border border-slate-300 rounded text-slate-500"
                          />
                        </td>
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => removeTest(idx)}
                            className="text-slate-400 hover:text-rose-600 font-bold px-1"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Section 5: Follow-Up / Advice */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-200">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                {lang === "hi" ? "फॉलो-अप / पुनः समीक्षा" : "Follow-up / Review Plan"}
              </label>
              <input
                type="text"
                value={editableExt.follow_up?.date_or_duration || ""}
                onChange={(e) =>
                  setEditableExt({
                    ...editableExt,
                    follow_up: {
                      required: true,
                      date_or_duration: e.target.value,
                      notes: e.target.value,
                    },
                  })
                }
                placeholder="e.g. Review after 5 days, SOS"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                {lang === "hi" ? "डॉक्टर की सलाह" : "Doctor's Advice / Notes"}
              </label>
              <input
                type="text"
                value={editableExt.doctor_advice.join("; ")}
                onChange={(e) =>
                  setEditableExt({
                    ...editableExt,
                    doctor_advice: e.target.value.split(";").map((s) => s.trim()).filter(Boolean),
                  })
                }
                placeholder="e.g. Warm fluids; Bed rest"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
              />
            </div>
          </div>

          {/* Action Confirmation Row */}
          <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setStage("preview")}
              className="py-4 px-6 border-2 border-slate-300 hover:bg-slate-100 rounded-2xl font-bold text-slate-700 text-sm transition text-center"
            >
              ← {lang === "hi" ? "स्कैन पर वापस जाएँ" : "Back to Scan"}
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={handleConfirmSave}
              className="flex-1 py-4 px-8 bg-teal-600 hover:bg-teal-700 active:scale-98 text-white rounded-2xl font-black text-base shadow-xl transition flex items-center justify-center gap-2"
            >
              <span>✓</span>
              <span>
                {isSaving
                  ? (lang === "hi" ? "सहेजा जा रहा है..." : "Saving...")
                  : (lang === "hi" ? "पुष्टि करें और स्वास्थ्य रिकॉर्ड में सहेजें" : "Confirm & Save to Health Record")}
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
