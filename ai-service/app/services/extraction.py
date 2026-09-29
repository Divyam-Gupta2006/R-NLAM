"""
Structured extraction from land-acquisition documents (awards, gazette
notifications, 7/12 and khasra extracts) in English and Marathi/Hindi.

Every field comes with a confidence and the snippet it was read from. Fields
below REVIEW_THRESHOLD are flagged `needs_review`: a person must confirm them
before they are used. Nothing here decides anything; it proposes values.
"""
from __future__ import annotations

import re
from dataclasses import asdict, dataclass, field
from typing import Any

REVIEW_THRESHOLD = 0.8

_DEVA_DIGITS = str.maketrans("०१२३४५६७८९", "0123456789")
_GUJ_DIGITS = str.maketrans("૦૧૨૩૪૫૬૭૮૯", "0123456789")

MONTHS = {m: i for i, m in enumerate(["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"], start=1)}


@dataclass
class Field:
    value: Any
    confidence: float
    evidence: str
    needs_review: bool = False


@dataclass
class Extraction:
    document_type: str
    document_type_confidence: float
    fields: dict[str, list[Field]] = field(default_factory=dict)
    needs_review: bool = False
    text_method: str = "plain-text"

    def to_dict(self) -> dict[str, Any]:
        out = asdict(self)
        out["fields"] = {k: [asdict(f) for f in v] for k, v in self.fields.items()}
        return out


def normalise(text: str) -> str:
    return text.translate(_DEVA_DIGITS).translate(_GUJ_DIGITS)


def _snippet(text: str, start: int, end: int, pad: int = 30) -> str:
    """The line the value was read from (a whole line reads better than a cut window)."""
    line_start = text.rfind("\n", 0, start) + 1
    line_end = text.find("\n", end)
    line_end = len(text) if line_end == -1 else line_end
    if line_end - line_start <= 140:
        return re.sub(r"\s+", " ", text[line_start:line_end]).strip()
    return re.sub(r"\s+", " ", text[max(0, start - pad) : min(len(text), end + pad)]).strip()


def classify(text: str) -> tuple[str, float]:
    t = text.lower()
    scores = {
        "AWARD": sum(k in t for k in ("award", "solatium", "section 23", "s.23", "निवाडा", "अवार्ड", "मोबदला")),
        "GAZETTE_NOTIFICATION": sum(k in t for k in ("gazette", "notification", "section 11", "section 19", "s.11", "s.19", "अधिसूचना", "राजपत्र")),
        "KHASRA_EXTRACT": sum(k in t for k in ("7/12", "७/१२", "khasra", "khatauni", "satbara", "सातबारा", "खसरा", "भोगवटदार", "occupant")),
    }
    kind, hits = max(scores.items(), key=lambda kv: kv[1])
    if hits == 0:
        return "UNKNOWN", 0.3
    total = sum(scores.values())
    return kind, round(min(0.95, 0.55 + 0.1 * hits) * (hits / total), 2)


# --------------------------------------------------------------------------- fields

SURVEY_LABEL = r"(?:survey|s\.?\s?no|sy\.?\s?no|khasra|gat|gut|plot|सर्वे|स\.?\s?नं|गट|खसरा|भूमापन)[^\S\n]*(?:no\.?|number|nos\.?|क्र\.?|नं\.?|क्रमांक)?[^\S\n]*[:\-]?[^\S\n]*"
SURVEY_VALUE = r"(\d{1,4}(?:\s?[/\-]\s?[0-9A-Za-z]{1,4}){0,3})"


def survey_numbers(text: str) -> list[Field]:
    out: dict[str, Field] = {}
    for m in re.finditer(SURVEY_LABEL + SURVEY_VALUE, text, flags=re.IGNORECASE):
        v = re.sub(r"\s", "", m.group(1))
        out.setdefault(v, Field(v, 0.92 if "/" in v or "-" in v else 0.85, _snippet(text, m.start(), m.end())))
    return list(out.values())


def owner_names(text: str) -> list[Field]:
    label = r"(?:owner|occupant|land\s?holder|landowner|name of (?:the )?(?:owner|holder|person interested)|भोगवटदार(?:ाचे)? नाव|खातेदार|मालक|नाव)"
    out: dict[str, Field] = {}
    for m in re.finditer(label + r"[^\S\n]*(?:name)?[^\S\n]*[:\-][^\S\n]*([^\n,;:]{3,60})", text, flags=re.IGNORECASE):
        name = re.sub(r"\s+(s/o|d/o|w/o|son of|daughter of|wife of)\b.*$", "", m.group(1).strip(), flags=re.IGNORECASE).strip(" .")
        name = re.sub(r"\s*\([^)]*\)?\s*$", "", name).strip(" .")  # trailing notes such as "(share 50%)"
        if len(name) < 3 or re.search(r"\d", name):
            continue
        conf = 0.88 if len(name.split()) >= 2 else 0.7
        out.setdefault(name, Field(name, conf, _snippet(text, m.start(), m.end())))
    return list(out.values())


AREA_UNITS = {"hectare": 1.0, "hectares": 1.0, "ha": 1.0, "hect": 1.0, "हेक्टर": 1.0, "हे": 1.0, "acre": 0.404686, "acres": 0.404686, "एकर": 0.404686, "sq m": 0.0001, "sqm": 0.0001, "square metres": 0.0001, "चौ.मी": 0.0001}


def areas(text: str) -> list[Field]:
    out = []
    unit_re = "|".join(sorted((re.escape(u) for u in AREA_UNITS), key=len, reverse=True))
    for m in re.finditer(r"(\d+(?:[.,]\d+)?)\s*(" + unit_re + r")\.?(?![a-z])", text, flags=re.IGNORECASE):
        value = float(m.group(1).replace(",", "")) * AREA_UNITS[m.group(2).lower()]
        labelled = re.search(r"(area|क्षेत्र|extent)", text[max(0, m.start() - 40) : m.start()], flags=re.IGNORECASE)
        out.append(Field(round(value, 4), 0.9 if labelled else 0.72, _snippet(text, m.start(), m.end())))
    return out


def amounts(text: str) -> list[Field]:
    out = []
    pattern = r"(?:rs\.?|inr|₹|रु\.?|रुपये)\s*([\d,]+(?:\.\d{1,2})?)\s*(lakh|lac|crore|cr|लाख|कोटी)?"
    for m in re.finditer(pattern, text, flags=re.IGNORECASE):
        raw = m.group(1).replace(",", "")
        if not raw or raw == ".":
            continue
        value = float(raw)
        mult = (m.group(2) or "").lower()
        if mult in ("lakh", "lac", "लाख"):
            value *= 1e5
        elif mult in ("crore", "cr", "कोटी"):
            value *= 1e7
        context = text[max(0, m.start() - 60) : m.start()].lower()
        labelled = any(k in context for k in ("compensation", "award", "solatium", "amount", "total", "market value", "मोबदला", "रक्कम", "एकूण", "बाजारमूल्य"))
        out.append(Field(round(value, 2), 0.9 if labelled else 0.75, _snippet(text, m.start(), m.end())))
    return out


def dates(text: str) -> list[Field]:
    out: dict[str, Field] = {}

    def add(y: int, mth: int, d: int, m: re.Match[str], conf: float) -> None:
        if 1 <= mth <= 12 and 1 <= d <= 31 and 1950 <= y <= 2100:
            iso = f"{y:04d}-{mth:02d}-{d:02d}"
            out.setdefault(iso, Field(iso, conf, _snippet(text, m.start(), m.end())))

    for m in re.finditer(r"\b(\d{4})-(\d{2})-(\d{2})\b", text):
        add(int(m.group(1)), int(m.group(2)), int(m.group(3)), m, 0.95)
    for m in re.finditer(r"\b(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})\b", text):
        add(int(m.group(3)), int(m.group(2)), int(m.group(1)), m, 0.85)  # Indian dd/mm/yyyy
    for m in re.finditer(r"\b(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})\b", text):
        mth = MONTHS.get(m.group(2)[:3].lower())
        if mth:
            add(int(m.group(3)), mth, int(m.group(1)), m, 0.93)
    return list(out.values())


def sections(text: str) -> list[Field]:
    out: dict[str, Field] = {}
    for m in re.finditer(r"\b(?:section|sec\.?|s\.|u/s|कलम)\s*(\d{1,3}[A-Z]?)(\s?\(\d+\))?", text, flags=re.IGNORECASE):
        v = f"s.{m.group(1)}{(m.group(2) or '').replace(' ', '')}"
        out.setdefault(v, Field(v, 0.9, _snippet(text, m.start(), m.end())))
    return list(out.values())


def single(text: str, label: str, value: str, conf: float) -> list[Field]:
    """A field that should have one value; every distinct value found is returned so conflicts surface."""
    out: dict[str, Field] = {}
    for m in re.finditer(label + r"[^\S\n]*[:\-][^\S\n]*(" + value + ")", text, flags=re.IGNORECASE):
        v = m.group(1).strip()
        out.setdefault(v, Field(v, conf, _snippet(text, m.start(), m.end())))
    return list(out.values())


def extract(text: str, method: str = "plain-text", confidence_factor: float = 1.0) -> Extraction:
    t = normalise(text)
    kind, kind_conf = classify(t)
    fields = {
        "survey_numbers": survey_numbers(t),
        "owner_names": owner_names(t),
        "area_hectares": areas(t),
        "amounts_inr": amounts(t),
        "dates": dates(t),
        "sections": sections(t),
        "village": single(t, r"(?:village|mauza|गाव|मौजा)", r"[^\n,;]{2,40}", 0.85),
        "district": single(t, r"(?:district|जिल्हा|जिला)", r"[^\n,;]{2,30}", 0.85),
        "award_number": single(t, r"(?:award|निवाडा)\s*(?:no\.?|number|क्र\.?)", r"[A-Za-z0-9/\-]{3,40}", 0.9),
        "reference_number": single(t, r"(?:ref(?:erence)?\.?(?:\s*no\.?)?|no\.)", r"[A-Za-z0-9/\-.]{4,40}", 0.75),
    }
    needs = False
    for fs in fields.values():
        for f in fs:
            f.confidence = round(f.confidence * confidence_factor, 3)
            f.needs_review = f.confidence < REVIEW_THRESHOLD
            needs = needs or f.needs_review
        # Several different values for a single-valued field: someone must choose.
    for key in ("area_hectares", "village", "district", "award_number"):
        if len({str(f.value) for f in fields[key]}) > 1:
            for f in fields[key]:
                f.needs_review = True
            needs = True
    return Extraction(document_type=kind, document_type_confidence=kind_conf, fields=fields, needs_review=needs or kind_conf < REVIEW_THRESHOLD, text_method=method)
