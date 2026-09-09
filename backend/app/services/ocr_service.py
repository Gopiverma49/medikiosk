import os
import subprocess
import logging

SCRIPTS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "scripts"))
OCR_SCRIPT_PATH = os.path.join(SCRIPTS_DIR, "run_ocr.js")


def run_local_ocr(image_path: str) -> str:
    """Run local Tesseract OCR on the given image path."""
    if not os.path.isfile(image_path) or not os.path.isfile(OCR_SCRIPT_PATH):
        return ""
    try:
        proc = subprocess.run(
            ["node", OCR_SCRIPT_PATH, image_path],
            capture_output=True,
            text=True,
            timeout=30,
            encoding="utf-8",
            errors="ignore",
        )
        if proc.returncode == 0:
            return proc.stdout.strip()
        else:
            logging.warning("Local OCR failed with code %d: %s", proc.returncode, proc.stderr)
    except Exception as e:
        logging.warning("Local OCR runner error: %s", e)
    return ""
