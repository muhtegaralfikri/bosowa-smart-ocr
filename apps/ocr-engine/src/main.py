import os
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Dict, List
from collections.abc import Mapping, Sequence

PADDLE_CACHE_DIR = Path(__file__).resolve().parent.parent / "paddle_cache"
# Force Paddle/PaddleX caches into a repo-local folder to avoid permission issues on some hosts.
PADDLE_CACHE_DIR.mkdir(parents=True, exist_ok=True)
os.environ["PADDLE_HOME"] = str(PADDLE_CACHE_DIR)
os.environ["PADDLEX_HOME"] = str(PADDLE_CACHE_DIR)
os.environ["PADDLEOCR_HOME"] = str(PADDLE_CACHE_DIR)
os.environ["HOME"] = str(PADDLE_CACHE_DIR)
os.environ["USERPROFILE"] = str(PADDLE_CACHE_DIR)

from fastapi import FastAPI, File, HTTPException, UploadFile
from paddleocr import PaddleOCR

app = FastAPI()

# use_angle_cls must stay False to avoid recent PaddleOCR bugs
ocr_engine = PaddleOCR(use_angle_cls=False, lang="en")


def _extract_from_new_api(page_result: Mapping) -> List[Dict[str, float]]:
    """Handle PaddleOCR >=3.x output (OCRResult dict)."""
    texts = page_result.get("rec_texts") or []
    scores = page_result.get("rec_scores") or []
    return [
        {"text": str(text), "confidence": float(score)}
        for text, score in zip(texts, scores)
    ]


def _extract_from_legacy_api(lines: Sequence) -> List[Dict[str, float]]:
    """Handle PaddleOCR <3.x output (list of boxes + (text, score))."""
    extracted: List[Dict[str, float]] = []
    for line in lines:
        if not line or len(line) < 2:
            continue
        text_info = line[1]
        if isinstance(text_info, Sequence) and len(text_info) >= 2:
            text, confidence = text_info[0], text_info[1]
            extracted.append({"text": str(text), "confidence": float(confidence)})
    return extracted


def _run_ocr(image_path: str) -> List[Dict[str, float]]:
    """Run OCR and normalize the result shape."""
    # `use_angle_cls` already disabled at init; omit deprecated `cls` arg to avoid predict() errors.
    result = ocr_engine.ocr(image_path)
    extracted: List[Dict[str, float]] = []

    for item in result or []:
        if isinstance(item, Mapping):
            extracted.extend(_extract_from_new_api(item))
        elif isinstance(item, Sequence) and not isinstance(item, (str, bytes, bytearray)):
            extracted.extend(_extract_from_legacy_api(item))

    return extracted


@app.post("/process-ocr")
async def process_ocr(file: UploadFile = File(...)) -> Dict[str, object]:
    if not file:
        raise HTTPException(status_code=400, detail="File is required")

    temp_path = None

    try:
        suffix = os.path.splitext(file.filename)[1] or ".jpg"
        with NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            temp_path = temp_file.name
            content = await file.read()
            temp_file.write(content)

        extracted_text = _run_ocr(temp_path)

        return {"status": "success", "data": extracted_text}
    except Exception as exc:  # noqa: BLE001
        print(f"Error during OCR: {exc}")  # Log raw error to server console
        raise HTTPException(
            status_code=500, detail="Failed to process image in OCR engine"
        ) from exc
    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)
