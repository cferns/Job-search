"""LinkedIn adapter.

LinkedIn aggressively detects and bans automation, so this adapter is deliberately
conservative: it does NOT auto-click through Easy Apply. It scrapes the job description
(for tailoring) and opens the apply panel for you to complete by hand. Treat LinkedIn as
semi-automated only — the tailored resume + cover letter are the real value here.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

from playwright.sync_api import Page

from ..models import FillReport, JobPosting
from .base import BaseAdapter


class LinkedInAdapter(BaseAdapter):
    name = "linkedin"

    def open_application_form(self, page: Page) -> None:
        """Do NOT auto-click Easy Apply — automating it risks an account ban."""
        return

    def get_job_description(self, page: Page) -> str:
        for sel in [".jobs-description__content", ".jobs-description",
                    "[class*='description']", "main"]:
            try:
                loc = page.locator(sel).first
                if loc.count():
                    text = loc.inner_text(timeout=3000).strip()
                    if len(text) > 150:
                        return text[:12000]
            except Exception:
                continue
        return super().get_job_description(page)

    def fill(self, page: Page, profile: dict[str, Any], resume_pdf: Path | None,
             cover_letter: str, posting: JobPosting) -> FillReport:
        report = FillReport()
        report.notes.append(
            "LinkedIn: NOT auto-filled by design — automating Easy Apply risks an account "
            "ban. The tailored resume PDF and cover letter are saved for you. Complete the "
            "Easy Apply panel manually (you're logged in via the persistent profile)."
        )
        report.skipped.append("All form fields (manual on LinkedIn by design)")
        return report
