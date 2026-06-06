"""Ashby adapter. Ashby uses label-driven fields, so we match by label text."""
from __future__ import annotations

from pathlib import Path
from typing import Any

from playwright.sync_api import Page

from ..models import FillReport, JobPosting
from .base import BaseAdapter, safe_fill, safe_set_file


def _fill_by_label(page: Page, label_substrings: list[str], value: str,
                   report: FillReport, label: str) -> bool:
    if not value:
        report.skipped.append(f"{label} (no value in profile)")
        return False
    for sub in label_substrings:
        try:
            loc = page.get_by_label(sub, exact=False).first
            if loc.count() and loc.is_visible():
                loc.fill(value, timeout=3000)
                report.filled.append(label)
                return True
        except Exception:
            continue
    report.skipped.append(label)
    return False


class AshbyAdapter(BaseAdapter):
    name = "ashby"

    def get_job_description(self, page: Page) -> str:
        for sel in ["[class*='_description']", "[class*='jobPosting']", "main"]:
            try:
                loc = page.locator(sel).first
                if loc.count():
                    text = loc.inner_text(timeout=3000).strip()
                    if len(text) > 200:
                        return text[:12000]
            except Exception:
                continue
        return super().get_job_description(page)

    def fill(self, page: Page, profile: dict[str, Any], resume_pdf: Path | None,
             cover_letter: str, posting: JobPosting) -> FillReport:
        report = FillReport()
        _fill_by_label(page, ["Name", "Full name"], profile.get("full_name", ""),
                       report, "Full name")
        _fill_by_label(page, ["Email"], profile.get("email", ""), report, "Email")
        _fill_by_label(page, ["Phone"], profile.get("phone", ""), report, "Phone")
        _fill_by_label(page, ["LinkedIn"], profile.get("linkedin", ""), report, "LinkedIn")
        _fill_by_label(page, ["GitHub"], profile.get("github", ""), report, "GitHub")

        # Fall back to generic selectors for anything labels missed.
        if "Email" in report.skipped:
            safe_fill(page, ["input[type='email']"], profile.get("email", ""),
                      report, "Email (fallback)")

        if resume_pdf:
            safe_set_file(page, ["input[type='file']"], resume_pdf, report, "Resume upload")

        report.notes.append(
            "Ashby: label-matched fields filled. Verify file upload registered and "
            "complete any custom questions before submitting."
        )
        return report
