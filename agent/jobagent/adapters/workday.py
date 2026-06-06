"""Workday adapter.

Workday is multi-step, heavily JS-driven, and varies a lot between tenants. Reliable
end-to-end automation isn't realistic, so this adapter scrapes the description, fills
the obvious fields when present, and leans on the human reviewer for the multi-page flow.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

from playwright.sync_api import Page

from ..models import FillReport, JobPosting
from .base import BaseAdapter, safe_fill, safe_set_file


class WorkdayAdapter(BaseAdapter):
    name = "workday"

    def get_job_description(self, page: Page) -> str:
        for sel in ["[data-automation-id='jobPostingDescription']",
                    "[data-automation-id='job-posting-details']", "main"]:
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
        # Workday uses data-automation-id attributes; try the common ones.
        safe_fill(page, ["input[data-automation-id='email']", "input[type='email']"],
                  profile.get("email", ""), report, "Email")
        safe_fill(page, ["input[data-automation-id='legalNameSection_firstName']",
                         "input[name*='first' i]"],
                  profile.get("first_name", ""), report, "First name")
        safe_fill(page, ["input[data-automation-id='legalNameSection_lastName']",
                         "input[name*='last' i]"],
                  profile.get("last_name", ""), report, "Last name")
        safe_fill(page, ["input[data-automation-id='phone-number']", "input[type='tel']"],
                  profile.get("phone", ""), report, "Phone")

        if resume_pdf:
            safe_set_file(page, ["input[type='file']"], resume_pdf, report, "Resume upload")

        report.notes.append(
            "Workday is a multi-step flow that often requires creating/logging into an "
            "account, then several pages (experience, education, questions). The agent "
            "filled what it could on this page — you'll need to drive the remaining steps."
        )
        return report
