"""
Exposes computed evaluation metrics via the API. The actual computation lives
in evaluation/run_evaluation.py so it can also be run standalone / in CI:

    python evaluation/run_evaluation.py

This endpoint runs the same code in-process and returns evaluation/results.json's
contents (or a NOT_YET_EVALUATED marker if it hasn't been run).
"""
import json
import os
import sys
from fastapi import APIRouter

router = APIRouter(prefix="/api/evaluation", tags=["evaluation"])

RESULTS_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "..", "evaluation", "results.json")


@router.get("/results")
def get_results():
    path = os.path.abspath(RESULTS_PATH)
    if not os.path.exists(path):
        return {"status": "NOT_YET_EVALUATED"}
    with open(path, encoding="utf-8") as f:
        return json.load(f)


@router.post("/run")
def run_now():
    import subprocess
    script = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "evaluation", "run_evaluation.py"))
    subprocess.run([sys.executable, script], check=False)
    return get_results()
