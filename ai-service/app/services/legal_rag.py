"""
Question answering over the RFCTLARR Act 2013 text and R-NLAM's rule packs,
with section citations. Retrieval-only and CPU-light: sections are passages,
ranked with BM25; the answer is the best-matching sentences quoted verbatim
with their section number. When retrieval is weak the service refuses rather
than guessing. An LLM may later rephrase the quoted answer (never add to it).
"""
from __future__ import annotations

import json
import math
import re
from dataclasses import dataclass
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "data"

STOP = set(
    "a an the of to in on for and or is are be by with within from as at that this which what when how whether shall may any such under its it into than then there their been being do does did can if i my we our who whom whose will would should about after before".split()
)
SYNONYMS = {
    "objection": ["objection", "object", "objections"],
    "object": ["objection", "object"],
    "lapse": ["lapse", "rescinded", "lapsed"],
    "lapses": ["lapse", "rescinded", "lapsed"],
    "deadline": ["period", "within", "months"],
    "time": ["period", "within"],
    "interest": ["interest", "cent", "annum"],
    "possession": ["possession"],
    "compensation": ["compensation", "award", "amount"],
    "consent": ["consent", "gram", "sabha"],
    "tribal": ["scheduled", "tribes", "areas"],
    "urgent": ["urgency"],
    "urgency": ["urgency"],
    "resettlement": ["rehabilitation", "resettlement", "entitlements"],
    "multiplier": ["factor", "multiplied"],
    "solatium": ["solatium"],
}
MIN_SCORE = 4.0
MIN_COVERAGE = 0.5


def tokens(text: str) -> list[str]:
    out = []
    for w in re.findall(r"[a-z0-9]+", text.lower()):
        if w in STOP or len(w) < 2:
            continue
        for suf in ("ation", "ing", "ed", "es", "s"):
            if len(w) > 4 and w.endswith(suf):
                w = w[: -len(suf)]
                break
        out.append(w)
    return out


@dataclass
class Passage:
    id: str
    citation: str
    title: str
    text: str
    source: str  # "act" | "rule-pack"


def load_act() -> list[Passage]:
    raw = (DATA / "rfctlarr_2013.txt").read_text(encoding="utf-8")
    # Body sections look like "25. Period within which an award shall be made. –The Collector…"
    head = re.compile(r"^(\d{1,3}[A-Z]?)\.\s+([^\n]{3,200}?)\.\s?[–—-]\s?", re.MULTILINE)
    marks = list(head.finditer(raw))
    out = []
    for i, m in enumerate(marks):
        end = marks[i + 1].start() if i + 1 < len(marks) else len(raw)
        body = raw[m.start() : end]
        body = re.split(r"\n\s*STATE AMENDMENTS", body)[0]  # keep the central text only
        body = re.sub(r"\s+", " ", body).strip()
        out.append(Passage(id=f"s{m.group(1)}", citation=f"RFCTLARR 2013, s.{m.group(1)}", title=m.group(2).strip(), text=body, source="act"))
    return out


SCHEDULES = ["FIRST", "SECOND", "THIRD", "FOURTH"]


def load_schedules() -> list[Passage]:
    """Schedules as citable items: 'Second Schedule, item 10'."""
    raw = (DATA / "rfctlarr_2013.txt").read_text(encoding="utf-8")
    starts = []
    for name in SCHEDULES:
        # the body heading is the last occurrence (the first is in the table of contents)
        idx = [m.start() for m in re.finditer(rf"^THE {name} SCHEDULE\s*$", raw, flags=re.MULTILINE)]
        if idx:
            starts.append((name, idx[-1]))
    starts.sort(key=lambda x: x[1])
    out = []
    for i, (name, start) in enumerate(starts):
        end = starts[i + 1][1] if i + 1 < len(starts) else len(raw)
        block = raw[start:end]
        items = list(re.finditer(r"^(\d{1,2})\.\s+(\S[^\n]*)", block, flags=re.MULTILINE))
        label = name.capitalize() + " Schedule"
        if not items:
            out.append(Passage(id=f"sch-{name}", citation=f"RFCTLARR 2013, {label}", title=label, text=re.sub(r"\s+", " ", block).strip(), source="act"))
        for j, m in enumerate(items):
            body = block[m.start() : items[j + 1].start() if j + 1 < len(items) else len(block)]
            text = re.sub(r"\s+", " ", body).strip()
            out.append(Passage(id=f"sch-{name}-{m.group(1)}", citation=f"RFCTLARR 2013, {label}, item {m.group(1)}", title=f"{label}: {m.group(2).strip()[:80]}", text=text, source="act"))
    return out


def _pretty(value, unit) -> str:
    if isinstance(value, (int, float)) and unit and "basis points" in unit:
        return f"{value / 100:g}%" + (" per annum" if "per annum" in unit else "")
    if isinstance(value, dict) and "requires" in value:
        return ", ".join(v.replace("_", " ").lower() for v in value["requires"])
    if isinstance(value, list):
        return ", ".join(str(v) for v in value)
    return f"{value} {unit or ''}".strip()


def load_rule_packs() -> list[Passage]:
    path = DATA / "rule_packs.json"
    if not path.exists():
        return []
    packs = json.loads(path.read_text(encoding="utf-8"))
    out = []
    for p in packs:
        for e in p.get("entries", []):
            text = f"{e['label']}: {_pretty(e['value'], e.get('unit'))}. {e.get('quote') or ''} {e.get('note') or ''}"
            out.append(Passage(id=f"{p['code']}:{e['key']}", citation=e["citation"] + (" (unverified)" if e.get("unverified") else ""), title=f"{p['code']} · {e['label']}", text=text, source="rule-pack"))
    return out


class LegalIndex:
    def __init__(self) -> None:
        self.passages = load_act() + load_schedules() + load_rule_packs()
        self.docs = [tokens(p.title + " " + p.text) for p in self.passages]
        self.avg = sum(len(d) for d in self.docs) / max(1, len(self.docs))
        df: dict[str, int] = {}
        for d in self.docs:
            for t in set(d):
                df[t] = df.get(t, 0) + 1
        n = len(self.docs)
        self.idf = {t: math.log(1 + (n - c + 0.5) / (c + 0.5)) for t, c in df.items()}
        self.tf = [{} for _ in self.docs]
        for i, d in enumerate(self.docs):
            for t in d:
                self.tf[i][t] = self.tf[i].get(t, 0) + 1

    def _bm25(self, i: int, q: list[str], k1: float = 1.5, b: float = 0.75) -> float:
        dl = len(self.docs[i])
        s = 0.0
        for t in q:
            f = self.tf[i].get(t, 0)
            if f:
                s += self.idf.get(t, 0) * f * (k1 + 1) / (f + k1 * (1 - b + b * dl / self.avg))
        return s

    def _proximity(self, i: int, q: set[str]) -> int:
        """Most distinct query terms found together in one sentence of the passage."""
        best = 0
        for sent in re.split(r"(?<=[.:;])\s+", self.passages[i].text):
            best = max(best, len(q & set(tokens(sent))))
        return best

    def search(self, question: str, k: int = 3) -> tuple[list[tuple[Passage, float]], list[str], float]:
        base = tokens(question)
        expanded = list(base)
        for t in base:
            expanded += [x for s in SYNONYMS.get(t, []) for x in tokens(s)]
        expanded = list(dict.fromkeys(expanded))  # each term counts once
        qset = set(base)
        prelim = sorted(range(len(self.passages)), key=lambda i: -self._bm25(i, expanded))[:25]
        # BM25, plus a bonus when several question terms occur in the same sentence,
        # plus the (IDF-weighted) question terms that appear in the section's title.
        def total(i: int) -> float:
            title_terms = qset & set(tokens(self.passages[i].title))
            return 10.0 * max(0, self._proximity(i, qset) - 1) + 1.5 * sum(self.idf.get(t, 0) for t in title_terms) + self._bm25(i, expanded)

        scored = sorted(((self.passages[i], total(i)) for i in prelim), key=lambda x: -x[1])[:k]
        vocab = set(self.idf)
        known = [t for t in base if t in vocab]
        coverage = (sum(1 for t in known if scored and t in set(tokens(scored[0][0].title + " " + scored[0][0].text))) / len(base)) if base else 0
        return scored, base, coverage

    def answer(self, question: str) -> dict:
        hits, qtokens, coverage = self.search(question)
        if not hits or hits[0][1] < MIN_SCORE or coverage < MIN_COVERAGE:
            return {
                "answered": False,
                "answer": None,
                "message": "I could not find this in the RFCTLARR Act 2013 text or the R-NLAM rule packs with enough confidence. Please consult the legal cell.",
                "retrieval": {"top_score": round(hits[0][1], 2) if hits else 0, "coverage": round(coverage, 2)},
                "passages": [],
            }
        top = hits[0][0]
        sentences = [s.strip() for s in re.split(r"(?<=[.:;])\s+(?=[A-Z(])", top.text) if len(s.strip()) > 20]
        q = set(qtokens) | {x for t in qtokens for s in SYNONYMS.get(t, []) for x in tokens(s)}
        best = sorted(sentences, key=lambda s: -len(q & set(tokens(s))))[:2]
        ordered = [s for s in sentences if s in best]
        close = [p for p, sc in hits[1:] if sc >= 0.95 * hits[0][1] and p.citation.split(",")[0:2] != top.citation.split(",")[0:2]]
        return {
            "answered": True,
            "answer": " … ".join(ordered),
            "citation": top.citation,
            "passage_id": top.id,
            "close_call": bool(close),
            "also_relevant": [p.citation for p in close],
            "title": top.title,
            "message": ("Close call between sections; read both before acting." if close else "Quoted from the source; read the full section before acting."),
            "retrieval": {"top_score": round(hits[0][1], 2), "coverage": round(coverage, 2)},
            "passages": [{"id": p.id, "citation": p.citation, "title": p.title, "score": round(s, 2), "source": p.source, "excerpt": p.text[:600]} for p, s in hits],
        }


_index: LegalIndex | None = None


def index() -> LegalIndex:
    global _index
    if _index is None:
        _index = LegalIndex()
    return _index
