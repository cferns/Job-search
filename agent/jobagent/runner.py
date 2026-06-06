"""Orchestrates one application: detect -> scrape -> tailor -> fill -> review -> log."""
from __future__ import annotations

import re
from pathlib import Path
from typing import Any

from . import config
from .adapters import get_adapter
from .browser import browser_session, render_markdown_to_pdf
from .detect import detect_ats
from .models import JobPosting
from .tailor import tailor_application
from .tracker import log_application


def _slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:60] or "job"


def _extract_meta(page) -> tuple[str, str]:
    """Best-effort (company, role) from page metadata."""
    company = role = ""
    try:
        title = (page.title() or "").strip()
    except Exception:
        title = ""
    # Common patterns: "Role - Company", "Role at Company", "Company - Role"
    for sep in [" - ", " | ", " at ", " @ "]:
        if sep in title:
            a, b = [s.strip() for s in title.split(sep, 1)]
            role, company = a, b
            break
    else:
        role = title
    for prop in ["meta[property='og:site_name']", "meta[name='author']"]:
        try:
            loc = page.locator(prop).first
            if loc.count():
                val = loc.get_attribute("content")
                if val:
                    company = val.strip()
                    break
        except Exception:
            continue
    return company, role


def _write_materials(settings: config.Settings, app, posting: JobPosting) -> tuple[Path, Path, Path]:
    out_dir = config.resolve(settings.output_dir)
    base = _slug(f"{posting.company}-{posting.role}")
    resume_md = out_dir / f"{base}-resume.md"
    cover_md = out_dir / f"{base}-cover-letter.md"
    resume_md.parent.mkdir(parents=True, exist_ok=True)
    resume_md.write_text(app.tailored_resume_markdown)
    cover_md.write_text(app.cover_letter_markdown)
    resume_pdf = render_markdown_to_pdf(app.tailored_resume_markdown, out_dir / f"{base}-resume.pdf")
    return resume_md, cover_md, resume_pdf


def _print_summary(posting: JobPosting, app) -> None:
    print("\n" + "=" * 70)
    print(f"  {posting.role or '(role?)'}  —  {posting.company or '(company?)'}")
    print(f"  Platform: {posting.ats}   Fit score: {app.fit_score}/100")
    print("-" * 70)
    print(f"  {app.fit_summary}")
    if app.missing_keywords:
        print(f"  Gaps to be aware of: {', '.join(app.missing_keywords)}")
    print("=" * 70)


def process_url(url: str, settings: config.Settings, profile: dict[str, Any],
                master_resume: str) -> None:
    mode = settings.submit_mode
    posting = JobPosting(url=url)

    # ---- draft mode: no browser, just generate materials ----
    if mode == "draft":
        posting.ats = detect_ats(url)
        print(f"\n[draft] {url}  (platform: {posting.ats})")
        print("  No description scraped in draft mode — tailoring from role/company only.")
        # In draft mode we can't scrape; ask the model to infer from the URL slug.
        posting.role = _slug(url).replace("-", " ")
        app = tailor_application(model=settings.model, master_resume=master_resume,
                                 posting=posting, extra_context=profile.get("extra_context", ""))
        posting.company, posting.role = app.company, app.role
        rm, cm, pdf = _write_materials(settings, app, posting)
        _print_summary(posting, app)
        print(f"  Resume:  {rm}\n  Cover:   {cm}\n  PDF:     {pdf}")
        log_application(config.resolve(settings.tracker_csv), posting, "Saved",
                        notes=f"Draft generated. Fit {app.fit_score}/100.")
        return

    # ---- review / auto mode: drive the browser ----
    profile_dir = config.resolve(settings.browser_profile_dir)
    with browser_session(profile_dir, headless=settings.headless) as (context, page):
        print(f"\nOpening {url}")
        page.goto(url, wait_until="domcontentloaded", timeout=60000)
        page.wait_for_timeout(2500)

        html = ""
        try:
            html = page.content()
        except Exception:
            pass
        posting.ats = detect_ats(url, html)
        adapter = get_adapter(posting.ats)

        posting.company, posting.role = _extract_meta(page)
        posting.location = profile.get("location", "")
        posting.description = adapter.get_job_description(page)
        print(f"  Detected platform: {posting.ats}   "
              f"({len(posting.description)} chars of JD scraped)")

        print("  Tailoring resume + cover letter with Claude...")
        app = tailor_application(model=settings.model, master_resume=master_resume,
                                 posting=posting, extra_context=profile.get("extra_context", ""))
        if not posting.company:
            posting.company = app.company
        if not posting.role:
            posting.role = app.role

        rm, cm, pdf = _write_materials(settings, app, posting)
        _print_summary(posting, app)
        print(f"  Saved: {rm.name}, {cm.name}, {pdf.name}")

        # choose resume to upload: explicit profile override, else tailored PDF
        resume_pdf = config.resolve(profile["resume_pdf"]) if profile.get("resume_pdf") else pdf

        print("  Filling the application form...")
        report = adapter.fill(page, profile, resume_pdf, app.cover_letter_markdown, posting)
        if report.filled:
            print(f"    Filled: {', '.join(report.filled)}")
        if report.skipped:
            print(f"    Left for you: {', '.join(report.skipped)}")
        for note in report.notes:
            print(f"    Note: {note}")

        if mode == "auto":
            _try_submit(page)
            log_application(config.resolve(settings.tracker_csv), posting, "Applied",
                            notes=f"Auto-submitted. Fit {app.fit_score}/100.")
            print("  Submitted (auto mode).")
            return

        # review mode: hand control to the human
        print("\n  >>> Review the form in the browser window. <<<")
        choice = input("  [Enter]=I submitted it / s=skip / q=quit: ").strip().lower()
        if choice == "q":
            raise KeyboardInterrupt
        if choice == "s":
            log_application(config.resolve(settings.tracker_csv), posting, "Saved",
                            notes=f"Prepared, not submitted. Fit {app.fit_score}/100.")
            print("  Logged as Saved (not submitted).")
            return
        log_application(config.resolve(settings.tracker_csv), posting, "Applied",
                        notes=f"Reviewed and submitted by user. Fit {app.fit_score}/100.")
        print("  Logged as Applied.")


def _try_submit(page) -> None:
    for sel in ["button[type='submit']", "button:has-text('Submit')",
                "button:has-text('Apply')", "input[type='submit']"]:
        try:
            loc = page.locator(sel).first
            if loc.count() and loc.is_visible():
                loc.click(timeout=5000)
                page.wait_for_timeout(3000)
                return
        except Exception:
            continue
