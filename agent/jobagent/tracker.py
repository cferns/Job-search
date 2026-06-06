"""Append applications to the shared CSV tracker (same format as tracker/index.html)."""
from __future__ import annotations

import csv
from datetime import date
from pathlib import Path

from .models import JobPosting

CSV_COLS = [
    "company", "role", "location", "status", "dateApplied",
    "nextAction", "salary", "source", "url", "contact", "notes",
]


def log_application(csv_path: Path, posting: JobPosting, status: str, notes: str = "") -> None:
    """Append one row. Creates the file with a header if it doesn't exist."""
    csv_path.parent.mkdir(parents=True, exist_ok=True)
    new_file = not csv_path.exists() or csv_path.stat().st_size == 0

    today = date.today().isoformat()
    next_action = ""
    if status == "Applied":
        # nudge a follow-up ~1 week out
        from datetime import timedelta
        next_action = (date.today() + timedelta(days=7)).isoformat()

    row = {
        "company": posting.company,
        "role": posting.role,
        "location": posting.location,
        "status": status,
        "dateApplied": today if status == "Applied" else "",
        "nextAction": next_action,
        "salary": "",
        "source": posting.ats,
        "url": posting.url,
        "contact": "",
        "notes": notes,
    }

    with csv_path.open("a", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_COLS)
        if new_file:
            writer.writeheader()
        writer.writerow(row)
