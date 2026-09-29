"""
Evaluation sets for the legal Q&A.

DEV was used while tuning the ranking, so its score is optimistic. HOLDOUT was
written afterwards and not tuned on; its score is the honest estimate. Run:

    python -m app.services.legal_eval
"""
from __future__ import annotations

from app.services.legal_rag import index

DEV = [
    ("When does the award lapse?", "s.25"),
    ("What happens if the declaration is not made within twelve months?", "s.19"),
    ("What is the one-time resettlement allowance?", "Second Schedule, item 10"),
    ("What is the solatium?", "s.30"),
    ("Within how many days can a person object after the preliminary notification?", "s.15"),
    ("What interest is payable if compensation is not paid before possession?", "s.80"),
    ("Is Gram Sabha consent needed in Scheduled Areas?", "s.41"),
    ("When can the Collector take possession of land?", "s.38"),
    ("What is the additional amount of twelve per cent?", "s.30"),
    ("What powers exist in case of urgency?", "s.40"),
    ("How is market value determined?", "s.26"),
    ("What is the transportation cost for displaced families?", "Second Schedule, item 6"),
    ("What is the capital of France?", None),
    ("Recipe for dal tadka", None),
]

HOLDOUT = [
    ("When does the Collector have to make the award?", "s.25"),
    ("When can the urgency clause be used?", "s.40"),
    ("Who can refer the award to the Authority?", "s.64"),
    ("What resettlement entitlements do affected families get?", "Second Schedule"),
    ("How much time for payment of compensation after award?", "s.38"),
    ("When does the social impact assessment lapse?", "s.14"),
    ("Can land be returned if unutilised for five years?", "s.101"),
    ("What is the multiplier factor for rural areas?", "First Schedule"),
    ("Who won the cricket world cup?", None),
    ("What is the best recipe for biryani?", None),
]


def _matches(citation: str, expected: str) -> bool:
    # "s.25" must not match "s.253"; schedule references match by prefix.
    c = citation.replace(" (unverified)", "")
    if expected.startswith("s."):
        return c.endswith(", " + expected) or (", " + expected + " ") in c or (", " + expected + "(") in c
    return expected in c


def evaluate(cases) -> dict:
    top1 = top3 = refused_ok = wrong_confident = refused_answerable = 0
    rows = []
    for q, exp in cases:
        a = index().answer(q)
        cits = [p["citation"] for p in a["passages"]]
        if exp is None:
            ok = not a["answered"]
            refused_ok += ok
            rows.append((q, exp, a.get("citation"), "refused" if ok else "ANSWERED OFF-TOPIC"))
            continue
        if not a["answered"]:
            refused_answerable += 1
            rows.append((q, exp, None, "refused (safe miss)"))
            continue
        hit1 = _matches(a["citation"], exp)
        hit3 = any(_matches(c, exp) for c in cits)
        top1 += hit1
        top3 += hit3
        if not hit3:
            wrong_confident += 1
        rows.append((q, exp, a["citation"], "top-1" if hit1 else ("top-3" if hit3 else "WRONG")))
    answerable = sum(1 for _, e in cases if e is not None)
    return {
        "answerable": answerable,
        "top1": top1,
        "top3": top3,
        "refused_answerable": refused_answerable,
        "wrong_answer": wrong_confident,
        "off_topic": len(cases) - answerable,
        "off_topic_refused": refused_ok,
        "rows": rows,
    }


if __name__ == "__main__":
    for name, cases in (("DEV (tuned on)", DEV), ("HOLDOUT (not tuned on)", HOLDOUT)):
        r = evaluate(cases)
        print(f"\n{name}: top-1 {r['top1']}/{r['answerable']}, top-3 {r['top3']}/{r['answerable']}, "
              f"refused-but-answerable {r['refused_answerable']}, wrong {r['wrong_answer']}, "
              f"off-topic refused {r['off_topic_refused']}/{r['off_topic']}")
        for q, exp, got, verdict in r["rows"]:
            print(f"  [{verdict}] {q}  expected={exp}  got={got}")
