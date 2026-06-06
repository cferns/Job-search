"""Lever adapter. Lever application forms are consistent and automatable."""
from __future__ import annotations

from pathlib import Path
from typing import Any

from playwright.sync_api import Page

from ..models import FillReport, JobPosting
from .base import BaseAdapter, safe_fill, safe_set_file


class LeverAdapter(BaseAdapter):
    name = "lever"

    def get_job_description(self, page: Page) -> str:
        for sel in [".posting-page", ".section-wrapper.page-full-width", ".content", "main"]:
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
        # Lever uses name="name" (full name), "email", "phone", "org", "urls[...]".
        safe_fill(page, ["input[name='name']"],
                  profile.get("full_name", ""), report, "Full name")
        safe_fill(page, ["input[name='email']", "input[type='email']"],
                  profile.get("email", ""), report, "Email")
        safe_fill(page, ["input[name='phone']", "input[type='tel']"],
                  profile.get("phone", ""), report, "Phone")
        safe_fill(page, ["input[name='org']"],
                  profile.get("current_company", ""), report, "Current company")
        safe_fill(page, ["input[name='urls[LinkedIn]']", "input[name*='linkedin' i]"],
                  profile.get("linkedin", ""), report, "LinkedIn")
        safe_fill(page, ["input[name='urls[GitHub]']", "input[name*='github' i]"],
                  profile.get("github", ""), report, "GitHub")
        safe_fill(page, ["input[name='urls[Portfolio]']", "input[name*='portfolio' i]"],
                  profile.get("portfolio", ""), report, "Portfolio")

        if cover_letter:
            safe_fill(page, ["textarea[name='comments']", "textarea[name*='cover' i]"],
                      cover_letter, report, "Cover letter / comments")

        if resume_pdf:
            safe_set_file(page, [
                "input[type='file'][name='resume']",
                "input[type='file']",
            ], resume_pdf, report, "Resume upload")

        report.notes.append(
            "Lever: core fields filled. Review any custom posting questions and EEO "
            "section before submitting."
        )
        return report
