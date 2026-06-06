"""Greenhouse adapter. Greenhouse forms are relatively consistent and automatable."""
from __future__ import annotations

from pathlib import Path
from typing import Any

from playwright.sync_api import Page

from ..models import FillReport, JobPosting
from .base import BaseAdapter, safe_fill, safe_set_file


class GreenhouseAdapter(BaseAdapter):
    name = "greenhouse"

    def get_job_description(self, page: Page) -> str:
        for sel in ["#content", ".job__description", "[class*='job-post']", "main"]:
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
        # Greenhouse uses explicit ids on the core fields.
        safe_fill(page, ["#first_name", "input[autocomplete='given-name']"],
                  profile.get("first_name", ""), report, "First name")
        safe_fill(page, ["#last_name", "input[autocomplete='family-name']"],
                  profile.get("last_name", ""), report, "Last name")
        safe_fill(page, ["#email", "input[type='email']"],
                  profile.get("email", ""), report, "Email")
        safe_fill(page, ["#phone", "input[type='tel']"],
                  profile.get("phone", ""), report, "Phone")
        safe_fill(page, ["input[name*='location' i]", "#job_application_location"],
                  profile.get("location", ""), report, "Location")

        if resume_pdf:
            safe_set_file(page, [
                "input[type='file'][id*='resume' i]",
                "input[type='file'][name*='resume' i]",
                "input[type='file']",
            ], resume_pdf, report, "Resume upload")

        # Greenhouse custom questions vary per posting — leave to the human.
        report.notes.append(
            "Greenhouse: core fields filled. Review custom/EEO questions and any "
            "dropdowns (work authorization, etc.) before submitting."
        )
        return report
