"""
Legal Q&A regression tests. Numbers are floors taken from
`python -m app.services.legal_eval` (see docs/PROGRESS for the table): DEV was
tuned on, HOLDOUT was not. Raise the floors when retrieval improves; never
lower them to make a change pass.
"""
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.legal_eval import DEV, HOLDOUT, evaluate
from app.services.legal_rag import index

client = TestClient(app)


def test_dev_set_floors():
    r = evaluate(DEV)
    assert r["top1"] >= 10 and r["top3"] == r["answerable"] == 12
    assert r["wrong_answer"] == 0
    assert r["off_topic_refused"] == r["off_topic"]


def test_holdout_floors():
    r = evaluate(HOLDOUT)
    assert r["top1"] >= 3 and r["top3"] >= 4
    assert r["off_topic_refused"] == r["off_topic"]


@pytest.mark.parametrize("question", [q for q, e in DEV + HOLDOUT if e is None])
def test_off_topic_questions_are_refused(question):
    a = index().answer(question)
    assert a["answered"] is False
    assert "legal cell" in a["message"]
    assert a["passages"] == []


def test_answer_is_quoted_verbatim_from_its_cited_passage():
    by_id = {p.id: p for p in index().passages}
    for question, expected in DEV + HOLDOUT:
        a = index().answer(question)
        if not a["answered"]:
            continue
        source = by_id[a["passage_id"]]
        assert source.citation in a["citation"]
        for part in a["answer"].split(" … "):
            assert part in source.text, (question, part)


def test_close_call_is_flagged():
    a = index().answer("What happens if the declaration is not made within twelve months?")
    assert a["answered"] and len(a["passages"]) == 3


def test_endpoint():
    r = client.post("/api/v1/legal/ask", json={"question": "What is the solatium?"})
    assert r.status_code == 200 and "s.30" in r.json()["citation"]
    assert client.post("/api/v1/legal/ask", json={"question": "hi"}).status_code == 422
