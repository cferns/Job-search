"""Base adapter: shared, defensive form-filling helpers.

Every adapter fills what it confidently can and records the rest as "skipped" so the
human reviewer knows exactly what to finish. Filling must never crash the run — each
field is wrapped in try/except.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

from playwright.sync_api import Page

from ..models import FillReport, JobPosting


def safe_fill(page: Page, selectors: list[str], value: str, report: FillReport, label: str) -> bool:
    """Try each selector; fill the first visible match. Returns True if filled."""
    if not value:
        report.skipped.append(f"{label} (no value in profile)")
        return False
    for sel in selectors:
        try:
            loc = page.locator(sel).first
            if loc.count() and loc.is_visible():
                loc.scroll_into_view_if_needed(timeout=2000)
                loc.fill(value, timeout=3000)
                report.filled.append(label)
                return True
        except Exception:
            continue
    report.skipped.append(label)
    return False


def safe_set_file(page: Page, selectors: list[str], file_path: Path, report: FillReport, label: str) -> bool:
    for sel in selectors:
        try:
            loc = page.locator(sel).first
            if loc.count():
                loc.set_input_files(str(file_path), timeout=5000)
                report.filled.append(label)
                return True
        except Exception:
            continue
    report.skipped.append(label)
    return False


class BaseAdapter:
    """Generic adapter. Tries common field names; relies on the human for the rest."""

    name = "generic"

    def get_job_description(self, page: Page) -> str:
        """Best-effort scrape of the visible job text."""
        for sel in ["main", "article", "[class*='description']", "body"]:
            try:
                loc = page.locator(sel).first
                if loc.count():
                    text = loc.inner_text(timeout=3000).strip()
                    if len(text) > 200:
                        return text[:12000]
            except Exception:
                continue
        return ""

    def fill(self, page: Page, profile: dict[str, Any], resume_pdf: Path | None,
             cover_letter: str, posting: JobPosting) -> FillReport:
        report = FillReport()
        self._fill_common(page, profile, resume_pdf, cover_letter, report)
        return report

    # --- shared field heuristics used by most adapters ---
    def _fill_common(self, page: Page, profile: dict[str, Any], resume_pdf: Path | None,
                     cover_letter: str, report: FillReport) -> None:
        safe_fill(page, [
            "input[name*='first' i]", "input[id*='first' i]",
            "input[autocomplete='given-name']",
        ], profile.get("first_name", ""), report, "First name")

        safe_fill(page, [
            "input[name*='last' i]", "input[id*='last' i]",
            "input[autocomplete='family-name']",
        ], profile.get("last_name", ""), report, "Last name")

        safe_fill(page, [
            "input[type='email']", "input[name*='email' i]", "input[id*='email' i]",
        ], profile.get("email", ""), report, "Email")

        safe_fill(page, [
            "input[type='tel']", "input[name*='phone' i]", "input[id*='phone' i]",
        ], profile.get("phone", ""), report, "Phone")

        safe_fill(page, [
            "input[name*='location' i]", "input[id*='location' i]",
            "input[name*='city' i]",
        ], profile.get("location", ""), report, "Location")

        safe_fill(page, [
            "input[name*='linkedin' i]", "input[id*='linkedin' i]",
        ], profile.get("linkedin", ""), report, "LinkedIn")

        safe_fill(page, [
            "input[name*='github' i]", "input[id*='github' i]",
        ], profile.get("github", ""), report, "GitHub")

        safe_fill(page, [
            "input[name*='website' i]", "input[name*='portfolio' i]",
            "input[id*='website' i]",
        ], profile.get("portfolio", ""), report, "Portfolio/Website")

        if resume_pdf:
            safe_set_file(page, [
                "input[type='file'][name*='resume' i]",
                "input[type='file'][id*='resume' i]",
                "input[type='file']",
            ], resume_pdf, report, "Resume upload")

        # Cover letter text area (only if a visible textarea exists).
        if cover_letter:
            safe_fill(page, [
                "textarea[name*='cover' i]", "textarea[id*='cover' i]",
                "textarea[name*='letter' i]",
            ], cover_letter, report, "Cover letter")
