import os
import base64
import logging
import subprocess
import asyncio
from typing import Optional
from PIL import Image, ImageOps

logger = logging.getLogger(__name__)

SCRIPTS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "scripts"))
OCR_SCRIPT_PATH = os.path.join(SCRIPTS_DIR, "run_ocr.js")


def _preprocess_image_for_ocr(image_path: str) -> Image.Image:
    """
    Apply image preprocessing for optimal OCR accuracy:
    - Resize / upscale small images with Lanczos filtering
    - Convert to grayscale
    - Auto-invert dark theme images (white text on dark background)
    - Auto-contrast enhancement
    """
    img = Image.open(image_path).convert("RGB")
    w, h = img.size

    # Upscale low-resolution crops or small scans for crisp text edges
    if w < 1200 or h < 800:
        scale = max(1200 / max(w, 1), 800 / max(h, 1))
        scale = min(scale, 3.0)  # cap at 3x to avoid excessive memory
        new_w, new_h = int(w * scale), int(h * scale)
        img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)

    # Convert to grayscale
    gray = img.convert("L")

    # Analyze average luminance: if image has dark background, invert it
    # OCR engines are optimized for dark ink on light background
    stat_hist = gray.histogram()
    total_pixels = sum(stat_hist)
    avg_luminance = sum(i * count for i, count in enumerate(stat_hist)) / max(total_pixels, 1)

    if avg_luminance < 110:
        gray = ImageOps.invert(gray)

    # Apply auto-contrast stretch
    gray = ImageOps.autocontrast(gray, cutoff=2)
    return gray


def run_windows_native_ocr(image_path: str) -> Optional[str]:
    """
    Run Windows 10/11 native hardware-accelerated Media OCR (winocr).
    Produces highly accurate results locally in milliseconds.
    """
    try:
        import winocr
        processed = _preprocess_image_for_ocr(image_path)
        res = asyncio.run(winocr.recognize_pil(processed, "en"))
        if res and res.text and len(res.text.strip()) > 3:
            return res.text.strip()
    except Exception as e:
        logger.debug("Windows native OCR skipped or unavailable: %s", e)
    return None


def run_ai_vision_ocr(image_path: str) -> Optional[str]:
    """
    Multi-modal AI Vision extraction if API keys are configured in environment.
    Supports Google Gemini 1.5 Flash Vision, OpenAI GPT-4o-mini Vision, or local Ollama.
    """
    gemini_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    openai_key = os.getenv("OPENAI_API_KEY")
    ollama_host = os.getenv("OLLAMA_HOST")

    if not (gemini_key or openai_key or ollama_host):
        return None

    try:
        import httpx

        with open(image_path, "rb") as f:
            img_bytes = f.read()
        b64_data = base64.b64encode(img_bytes).decode("utf-8")
        ext = os.path.splitext(image_path)[1].lower().replace(".", "") or "jpeg"
        mime_type = f"image/{ext}" if ext in ("png", "jpeg", "jpg", "webp") else "image/jpeg"

        prompt = (
            "You are a medical document OCR vision expert. "
            "Extract all readable text from this clinical document or prescription verbatim. "
            "Maintain line breaks. Include dates, medicine names, strengths, dosages, frequencies, and instructions. "
            "Do not hallucinate or add commentary. Return ONLY the extracted text."
        )

        # 1. Google Gemini Vision (Flash 1.5)
        if gemini_key:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={gemini_key}"
            payload = {
                "contents": [
                    {
                        "parts": [
                            {"text": prompt},
                            {
                                "inline_data": {
                                    "mime_type": mime_type,
                                    "data": b64_data,
                                }
                            },
                        ]
                    }
                ]
            }
            resp = httpx.post(url, json=payload, timeout=20.0)
            if resp.status_code == 200:
                data = resp.json()
                text = data["candidates"][0]["content"]["parts"][0]["text"]
                if text and len(text.strip()) > 3:
                    return text.strip()

        # 2. OpenAI GPT-4o-mini Vision
        if openai_key:
            url = "https://api.openai.com/v1/chat/completions"
            headers = {"Authorization": f"Bearer {openai_key}"}
            payload = {
                "model": "gpt-4o-mini",
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {
                                "type": "image_url",
                                "image_url": {"url": f"data:{mime_type};base64,{b64_data}"},
                            },
                        ],
                    }
                ],
                "max_tokens": 1000,
            }
            resp = httpx.post(url, json=payload, headers=headers, timeout=20.0)
            if resp.status_code == 200:
                data = resp.json()
                text = data["choices"][0]["message"]["content"]
                if text and len(text.strip()) > 3:
                    return text.strip()

        # 3. Ollama Vision (e.g. llava, qwen2-vl)
        if ollama_host:
            url = f"{ollama_host.rstrip('/')}/api/generate"
            payload = {
                "model": "llava",
                "prompt": prompt,
                "images": [b64_data],
                "stream": False,
            }
            resp = httpx.post(url, json=payload, timeout=25.0)
            if resp.status_code == 200:
                data = resp.json()
                text = data.get("response", "")
                if text and len(text.strip()) > 3:
                    return text.strip()

    except Exception as e:
        logger.warning("AI vision OCR error: %s", e)

    return None


def run_tesseract_ocr(image_path: str) -> str:
    """Run local Tesseract OCR on preprocessed image."""
    if not os.path.isfile(image_path) or not os.path.isfile(OCR_SCRIPT_PATH):
        return ""
    try:
        # Preprocess and save to temporary location for clean Tesseract recognition
        processed = _preprocess_image_for_ocr(image_path)
        temp_proc_path = f"{image_path}_preproc.png"
        processed.save(temp_proc_path, "PNG")

        proc = subprocess.run(
            ["node", OCR_SCRIPT_PATH, temp_proc_path],
            capture_output=True,
            text=True,
            timeout=30,
            encoding="utf-8",
            errors="ignore",
        )
        # Clean up temp file
        if os.path.isfile(temp_proc_path):
            try:
                os.remove(temp_proc_path)
            except Exception:
                pass

        if proc.returncode == 0 and proc.stdout.strip():
            return proc.stdout.strip()

        # Fallback to direct raw image if preprocessed had issues
        proc_raw = subprocess.run(
            ["node", OCR_SCRIPT_PATH, image_path],
            capture_output=True,
            text=True,
            timeout=30,
            encoding="utf-8",
            errors="ignore",
        )
        if proc_raw.returncode == 0:
            return proc_raw.stdout.strip()
    except Exception as e:
        logger.warning("Tesseract OCR error: %s", e)
    return ""


def run_local_ocr(image_path: str) -> str:
    """
    Unified multi-engine OCR runner:
    1. Multi-modal AI Vision (Gemini / OpenAI / Ollama) if credentials are provided
    2. Windows Native Media OCR (winocr) with preprocessing
    3. Preprocessed Tesseract OCR as universal fallback
    """
    if not os.path.isfile(image_path):
        return ""

    # Tier 1: Cloud or Local AI Vision Model
    ai_text = run_ai_vision_ocr(image_path)
    if ai_text:
        return ai_text

    # Tier 2: Windows Native Hardware-Accelerated OCR
    win_text = run_windows_native_ocr(image_path)
    if win_text:
        return win_text

    # Tier 3: Preprocessed Tesseract OCR
    return run_tesseract_ocr(image_path)
