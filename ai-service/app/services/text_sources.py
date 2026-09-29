"""
Getting text out of an uploaded document.

Default path (no extra install, CPU-light): PDF text layer via pypdf, or plain
text. Scanned images need an OCR engine: if the Tesseract binary and
pytesseract are available they are used (with hin+mar+eng if installed);
otherwise the caller gets a clear OcrUnavailable error rather than a guess.
LayoutLM / NER are optional plug-ins in the same spirit (see README).
"""
from __future__ import annotations

import io
import shutil
from dataclasses import dataclass


class OcrUnavailable(Exception):
    """An image was uploaded but no OCR engine is installed."""


@dataclass
class TextSource:
    text: str
    method: str  # "pdf-text-layer" | "plain-text" | "tesseract"
    confidence_factor: float  # OCR text is less reliable than a text layer


def _tesseract_available() -> bool:
    try:
        import pytesseract  # noqa: F401
    except ImportError:
        return False
    return shutil.which("tesseract") is not None


def extract_text(data: bytes, filename: str, content_type: str | None) -> TextSource:
    name = (filename or "").lower()
    ctype = (content_type or "").lower()

    if name.endswith(".pdf") or ctype == "application/pdf" or data[:5] == b"%PDF-":
        from pypdf import PdfReader

        reader = PdfReader(io.BytesIO(data))
        text = "\n".join((p.extract_text() or "") for p in reader.pages)
        if text.strip():
            return TextSource(text=text, method="pdf-text-layer", confidence_factor=1.0)
        raise OcrUnavailable("The PDF has no text layer (it is a scan). Install Tesseract to OCR scanned documents.")

    if ctype.startswith("image/") or name.endswith((".png", ".jpg", ".jpeg", ".webp", ".tif", ".tiff")):
        if not _tesseract_available():
            raise OcrUnavailable("No OCR engine is installed on this server. Install Tesseract (with hin/mar language data) to read scanned images.")
        import pytesseract
        from PIL import Image

        langs = "+".join(l for l in ("hin", "mar", "eng") if l in pytesseract.get_languages(config="")) or "eng"
        text = pytesseract.image_to_string(Image.open(io.BytesIO(data)), lang=langs)
        return TextSource(text=text, method="tesseract", confidence_factor=0.85)

    return TextSource(text=data.decode("utf-8", errors="replace"), method="plain-text", confidence_factor=1.0)
