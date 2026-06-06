"""Unit tests for the pure-Python helpers (no Playwright/Anthropic needed).

Run from the agent/ directory:
    python -m pytest tests/         # if pytest is installed
    python tests/test_helpers.py    # plain-stdlib fallback runner
"""
from __future__ import annotations

import csv
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from jobagent.detect import detect_ats          # noqa: E402
from jobagent.textutil import (                  # noqa: E402
    clean_title, markdown_to_text, slugify, split_role_company,
)
from jobagent.tracker import applied_urls, CSV_COLS  # noqa: E402


def test_detect_ats():
    assert detect_ats("https://boards.greenhouse.io/x/jobs/1") == "greenhouse"
    assert detect_ats("https://job-boards.greenhouse.io/x/jobs/1") == "greenhouse"
    assert detect_ats("https://jobs.lever.co/x/abc") == "lever"
    assert detect_ats("https://jobs.ashbyhq.com/x/abc") == "ashby"
    assert detect_ats("https://acme.wd1.myworkdayjobs.com/x") == "workday"
    assert detect_ats("https://www.linkedin.com/jobs/view/1") == "linkedin"
    assert detect_ats("https://www.indeed.com/viewjob?jk=1") == "indeed"
    assert detect_ats("https://example.com/careers/1") == "generic"
    # DOM fallback when host is generic but page embeds a known ATS
    assert detect_ats("https://acme.com/careers", "<iframe src='greenhouse.io'>") == "greenhouse"


def test_slugify():
    assert slugify("Databricks — Sr. PM, Technical!") == "databricks-sr-pm-technical"
    assert slugify("") == "job"
    assert len(slugify("x" * 200)) <= 60


def test_markdown_to_text():
    out = markdown_to_text("# Cover Letter\n\nDear **Team**,\n\nI *led* MLOps.\n\n- a\n* b")
    assert "#" not in out and "**" not in out
    assert "Dear Team" in out and "led MLOps" in out
    assert "- a" in out and "- b" in out


def test_title_parsing():
    assert clean_title("Job Application for Senior PM at Acme") == "Senior PM at Acme"
    role, company = split_role_company("Job Application for Senior PM at Acme")
    assert role == "Senior PM" and company == "Acme"
    role, company = split_role_company("Staff TPM - Databricks")
    assert role == "Staff TPM" and company == "Databricks"


def test_applied_urls(tmp_path: Path | None = None):
    d = Path(tempfile.mkdtemp()) if tmp_path is None else tmp_path
    csv_path = d / "applications.csv"
    with csv_path.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=CSV_COLS)
        w.writeheader()
        w.writerow({**{c: "" for c in CSV_COLS}, "url": "https://a/1", "status": "Applied"})
        w.writerow({**{c: "" for c in CSV_COLS}, "url": "https://a/2", "status": "Saved"})
    got = applied_urls(csv_path)
    assert got == {"https://a/1"}                    # only Applied, not Saved
    assert applied_urls(d / "missing.csv") == set()  # missing file -> empty


def _run_all() -> int:
    fns = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    failed = 0
    for fn in fns:
        try:
            fn()
            print(f"PASS {fn.__name__}")
        except AssertionError as e:
            failed += 1
            print(f"FAIL {fn.__name__}: {e}")
    print(f"\n{len(fns) - failed}/{len(fns)} passed")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(_run_all())
