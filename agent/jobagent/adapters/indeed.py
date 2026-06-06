"""Indeed adapter.

Indeed has strong anti-bot measures and a variable apply flow (many postings redirect to
the employer's own ATS). This adapter scrapes the description for tailoring and fills basic
fields if a native Indeed form is present, but treats Indeed as semi-automated.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

from playwright.sync_api import Page

from ..models import FillReport, JobPosting
from .base import BaseAdapter, safe_fill, safe_set_file


class IndeedAdapter(BaseAdapter):
    name = "indeed"

    def open_application_form(self, page: Page) -> None:
        """Indeed apply often redirects to the employer ATS and has anti-bot checks;
        don't auto-navigate — let the human drive from the JD page."""
        return

    def get_job_description(self, page: Page) -> str:
        for sel in ["#jobDescriptionText", ".jobsearch-JobComponent-description", "main"]:
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
        safe_fill(page, ["input[id*='name' i]", "input[name*='name' i]"],
                  profile.get("full_name", ""), report, "Name")
        safe_fill(page, ["input[type='email']"], profile.get("email", ""), report, "Email")
        safe_fill(page, ["input[type='tel']"], profile.get("phone", ""), report, "Phone")
        if resume_pdf:
            safe_set_file(page, ["input[type='file']"], resume_pdf, report, "Resume upload")

        report.notes.append(
            "Indeed: anti-bot measures and variable flows (many postings redirect to the "
            "employer ATS). Filled basic fields if present; complete and submit manually."
        )
        return report
