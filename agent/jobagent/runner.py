"""Orchestrates one application: detect -> scrape -> tailor -> fill -> review -> log."""
from __future__ import annotations

from pathlib import Path
from typing import Any

from . import config
from .adapters import get_adapter
from .browser import browser_session, render_markdown_to_pdf
from .detect import detect_ats
from .models import JobPosting, JobScore
from .store import Store, seed_answers
from .tailor import COVER_ANGLES, score_posting, tailor_application
from .textutil import markdown_to_text, slugify, split_role_company
from .tracker import log_application


def _compose_context(profile: dict[str, Any], store: Store) -> str:
    """Profile extra_context + recurring-gap learnings, fed into tailoring."""
    parts = [profile.get("extra_context", "").strip(), store.learnings_context()]
    return "\n".join(p for p in parts if p).strip()


def _collect_feedback(store: Store, ats: str) -> dict[str, Any]:
    """Ask a couple of quick questions and remember the answers/corrections."""
    fb: dict[str, Any] = {}
    try:
        rating = input("  Rate the tailoring 1-5 (Enter to skip): ").strip()
        if rating.isdigit() and 1 <= int(rating) <= 5:
            fb["rating"] = int(rating)
        fixes = input("  Fields you filled by hand? 'label=value; label2=value2' (Enter=none): ").strip()
        for pair in fixes.split(";"):
            if "=" in pair:
                label, value = pair.split("=", 1)
                store.learn_answer(label.strip(), value.strip())
                fb.setdefault("corrections", []).append(label.strip())
        notes = input("  Notes for next time (Enter to skip): ").strip()
        if notes:
            fb["notes"] = notes
    except EOFError:
        pass
    return fb


def _slug(text: str) -> str:
    return slugify(text)


def _settle(page, timeout: int = 8000) -> None:
    """Give SPA ATS pages (Ashby, new Greenhouse) a chance to render before scraping."""
    try:
        page.wait_for_load_state("networkidle", timeout=timeout)
    except Exception:
        page.wait_for_timeout(2500)


def _extract_meta(page) -> tuple[str, str]:
    """Best-effort (company, role) from page metadata. Returns (company, role)."""
    company = role = ""
    try:
        title = (page.title() or "").strip()
    except Exception:
        title = ""
    if title:
        role, company = split_role_company(title)
    # Prefer an explicit site name for company when available.
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


def _plain(markdown_text: str) -> str:
    return markdown_to_text(markdown_text)


def _write_materials(settings: config.Settings, app, posting: JobPosting,
                     pw=None) -> tuple[Path, Path, Path]:
    out_dir = config.resolve(settings.output_dir)
    base = _slug(f"{posting.company}-{posting.role}")
    resume_md = out_dir / f"{base}-resume.md"
    cover_md = out_dir / f"{base}-cover-letter.md"
    resume_md.parent.mkdir(parents=True, exist_ok=True)
    resume_md.write_text(app.tailored_resume_markdown)
    cover_md.write_text(app.cover_letter_markdown)
    resume_pdf = render_markdown_to_pdf(
        app.tailored_resume_markdown, out_dir / f"{base}-resume.pdf", pw=pw)
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
    store = Store.load(config.store_path())
    context_text = _compose_context(profile, store)
    angle = store.pick_strategy(list(COVER_ANGLES))  # A/B cover-letter angle

    # ---- draft mode: no browser, just generate materials ----
    if mode == "draft":
        posting.ats = detect_ats(url)
        print(f"\n[draft] {url}  (platform: {posting.ats})")
        print("  No description scraped in draft mode — tailoring from role/company only.")
        # In draft mode we can't scrape; ask the model to infer from the URL slug.
        posting.role = _slug(url).replace("-", " ")
        app = tailor_application(model=settings.model, master_resume=master_resume,
                                 posting=posting, extra_context=context_text, angle=angle)
        posting.company, posting.role = app.company, app.role
        rm, cm, pdf = _write_materials(settings, app, posting)
        _print_summary(posting, app)
        print(f"  Cover-letter angle: {angle}")
        print(f"  Resume:  {rm}\n  Cover:   {cm}\n  PDF:     {pdf}")
        log_application(config.resolve(settings.tracker_csv), posting, "Saved",
                        notes=f"Draft generated. Fit {app.fit_score}/100.")
        store.record_strategy(angle)
        store.record_run({"url": url, "ats": posting.ats, "company": posting.company,
                          "role": posting.role, "status": "Saved", "mode": "draft",
                          "fit_score": app.fit_score, "angle": angle,
                          "missing_keywords": app.missing_keywords})
        store.save()
        return

    # ---- review / auto mode: drive the browser ----
    profile_dir = config.resolve(settings.browser_profile_dir)
    with browser_session(profile_dir, headless=settings.headless) as (pw, context, page):
        print(f"\nOpening {url}")
        page.goto(url, wait_until="domcontentloaded", timeout=60000)
        _settle(page)

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

        gaps = store.known_gaps(posting.ats)
        if gaps:
            print(f"  Heads-up — fields often needing manual entry on {posting.ats}: "
                  f"{', '.join(gaps)}")

        print(f"  Tailoring resume + cover letter with Claude (angle: {angle})...")
        app = tailor_application(model=settings.model, master_resume=master_resume,
                                 posting=posting, extra_context=context_text, angle=angle)
        if not posting.company:
            posting.company = app.company
        if not posting.role:
            posting.role = app.role

        rm, cm, pdf = _write_materials(settings, app, posting, pw=pw)
        _print_summary(posting, app)
        print(f"  Saved: {rm.name}, {cm.name}, {pdf.name}")

        # choose resume to upload: explicit profile override, else tailored PDF
        resume_pdf = config.resolve(profile["resume_pdf"]) if profile.get("resume_pdf") else pdf

        # Navigate to the actual application form (Lever /apply, Greenhouse/Ashby
        # "Apply" button) before filling — the JD page often has no form fields.
        adapter.open_application_form(page)

        print("  Filling the application form...")
        report = adapter.fill(page, profile, resume_pdf, _plain(app.cover_letter_markdown), posting)
        # Learned answers fill custom/screener questions the core adapter skips.
        answers = store.merged_answers(seed_answers(profile))
        adapter.fill_learned(page, answers, report)
        if report.filled:
            print(f"    Filled: {', '.join(report.filled)}")
        if report.skipped:
            print(f"    Left for you: {', '.join(report.skipped)}")
        for note in report.notes:
            print(f"    Note: {note}")

        # Remember what filled vs. skipped per ATS so future runs warn about gaps.
        for f in report.filled:
            store.record_field(posting.ats, f.replace("[learned] ", ""), True)
        for s in report.skipped:
            store.record_field(posting.ats, s, False)

        def _finish(status: str, note: str, feedback: dict[str, Any] | None = None) -> None:
            log_application(config.resolve(settings.tracker_csv), posting, status, notes=note)
            store.record_strategy(angle, (feedback or {}).get("rating"))
            store.record_run({"url": url, "ats": posting.ats, "company": posting.company,
                              "role": posting.role, "status": status, "mode": mode,
                              "fit_score": app.fit_score, "angle": angle,
                              "missing_keywords": app.missing_keywords,
                              "filled": report.filled, "skipped": report.skipped,
                              "feedback": feedback or {}})
            store.save()

        if mode == "auto":
            _try_submit(page)
            _finish("Applied", f"Auto-submitted. Fit {app.fit_score}/100.")
            print("  Submitted (auto mode).")
            return

        # review mode: hand control to the human
        print("\n  >>> Review the form in the browser window. <<<")
        choice = input("  [Enter]=I submitted it / s=skip / q=quit: ").strip().lower()
        if choice == "q":
            raise KeyboardInterrupt
        if choice == "s":
            fb = _collect_feedback(store, posting.ats) if settings.collect_feedback else {}
            _finish("Saved", f"Prepared, not submitted. Fit {app.fit_score}/100.", fb)
            print("  Logged as Saved (not submitted).")
            return
        fb = _collect_feedback(store, posting.ats) if settings.collect_feedback else {}
        _finish("Applied", f"Reviewed and submitted by user. Fit {app.fit_score}/100.", fb)
        print("  Logged as Applied. Learnings saved.")


def show_stats(settings: config.Settings) -> None:
    """Print the jobs-applied funnel (from applications.csv) + what the agent has learned."""
    import csv as _csv
    from collections import Counter

    csv_path = config.resolve(settings.tracker_csv)
    status_counts: Counter[str] = Counter()
    if csv_path.exists():
        with csv_path.open(newline="") as f:
            for row in _csv.DictReader(f):
                status_counts[(row.get("status") or "?").strip() or "?"] += 1

    print("\n=== Jobs pipeline (applications.csv) ===")
    if status_counts:
        for status in ["Saved", "Applied", "Screening", "Interview", "Offer",
                       "Rejected", "Withdrawn"]:
            if status_counts.get(status):
                print(f"  {status:<11} {status_counts[status]}")
        for status, n in status_counts.items():
            if status not in {"Saved", "Applied", "Screening", "Interview", "Offer",
                              "Rejected", "Withdrawn"}:
                print(f"  {status:<11} {n}")
        applied = sum(v for k, v in status_counts.items() if k != "Saved")
        responses = sum(status_counts.get(s, 0) for s in ("Screening", "Interview", "Offer"))
        if applied:
            print(f"  response rate: {round(100 * responses / applied)}% ({responses}/{applied})")
    else:
        print("  (no applications logged yet)")

    store = Store.load(config.store_path())
    s = store.summary()

    # Conversion by platform: join each tracked URL's current status with the ATS the
    # agent recorded for it. "Advanced" = reached Screening or beyond.
    url_to_ats = {r.get("url"): r.get("ats") for r in store.data["runs"] if r.get("url")}
    advanced = {"Screening", "Interview", "Offer"}
    conv: dict[str, dict[str, int]] = {}
    if csv_path.exists():
        with csv_path.open(newline="") as f:
            for row in _csv.DictReader(f):
                ats = url_to_ats.get((row.get("url") or "").strip())
                st = (row.get("status") or "").strip()
                if not ats or st in ("", "Saved"):
                    continue
                c = conv.setdefault(ats, {"applied": 0, "advanced": 0})
                c["applied"] += 1
                if st in advanced:
                    c["advanced"] += 1

    print("\n=== Agent learnings ===")
    print(f"  runs recorded:   {s['runs']}  (applied: {s['applied']})")
    print(f"  learned answers: {s['learned_answers']}")
    if s["avg_rating"] is not None:
        print(f"  avg tailoring rating: {s['avg_rating']}/5")
    if s["per_ats"]:
        print("  fill reliability by platform:")
        for ats, st in sorted(s["per_ats"].items()):
            print(f"    {ats:<11} {st['fill_rate']}%  ({st['filled']} filled / {st['skipped']} skipped)")
    if conv:
        print("  conversion by platform (reached screening+):")
        for ats, c in sorted(conv.items(), key=lambda kv: kv[1]["advanced"], reverse=True):
            rate = round(100 * c["advanced"] / c["applied"]) if c["applied"] else 0
            print(f"    {ats:<11} {rate}%  ({c['advanced']}/{c['applied']})")
    if store.data["strategies"]:
        print("  cover-letter A/B (avg rating · uses):")
        for name in COVER_ANGLES:
            stt = store.data["strategies"].get(name)
            if stt and stt["uses"]:
                avg = store.strategy_avg(name)
                avg_s = f"{avg:.1f}" if avg is not None else "—"
                print(f"    {name:<14} {avg_s}  ·  {stt['uses']} uses")
        best = store.pick_strategy(list(COVER_ANGLES))
        print(f"    -> currently favoring: {best}")
    ctx = store.learnings_context()
    if ctx:
        print(f"\n  Recurring gaps fed into tailoring:\n    {ctx}")


def rank(urls: list[str], settings: config.Settings, profile: dict[str, Any],
         master_resume: str) -> None:
    """Scrape + score each posting, then write a sorted shortlist.md. No form filling."""
    results: list[JobScore] = []
    profile_dir = config.resolve(settings.browser_profile_dir)
    with browser_session(profile_dir, headless=settings.headless) as (pw, context, page):
        for i, url in enumerate(urls, 1):
            print(f"[{i}/{len(urls)}] scoring {url}")
            posting = JobPosting(url=url)
            try:
                page.goto(url, wait_until="domcontentloaded", timeout=45000)
                _settle(page)
                html = ""
                try:
                    html = page.content()
                except Exception:
                    pass
                posting.ats = detect_ats(url, html)
                adapter = get_adapter(posting.ats)
                posting.company, posting.role = _extract_meta(page)
                posting.description = adapter.get_job_description(page)
                score = score_posting(model=settings.model, master_resume=master_resume,
                                      posting=posting)
                results.append(score)
                print(f"    {score.fit_score}/100  remote={score.remote_friendly}  "
                      f"sponsorship={score.sponsorship}  {score.role} @ {score.company}")
            except Exception as e:
                print(f"    skipped ({e})")
                continue

    out = config.REPO_ROOT / "shortlist.md"
    _write_shortlist(results, out)
    print(f"\nWrote {out} ({len(results)} scored).")


def _write_shortlist(results: list[JobScore], out_path: Path) -> None:
    results = sorted(results, key=lambda r: r.fit_score, reverse=True)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        "# Shortlist — ranked by fit",
        "",
        "Sorted by Claude's fit score. `remote`/`sponsorship` are read from each job",
        "description (sponsorship reflects only what the posting states — verify employers",
        "on h1bgrader.com regardless). Highest-fit roles first.",
        "",
        "| Fit | Remote | Sponsorship | Role | Company | Gaps |",
        "| ---:| :----- | :---------- | :--- | :------ | :--- |",
    ]
    for r in results:
        gaps = ", ".join(r.missing_keywords[:4]) if r.missing_keywords else "—"
        lines.append(
            f"| {r.fit_score} | {r.remote_friendly} | {r.sponsorship} | "
            f"{r.role or '?'} | {r.company or '?'} | {gaps} |"
        )
    lines += ["", "## Notes per role", ""]
    for r in results:
        lines.append(f"- **{r.fit_score}/100 — {r.role} @ {r.company}** "
                     f"(remote: {r.remote_friendly}, sponsorship: {r.sponsorship}). "
                     f"{r.fit_summary}")
    out_path.write_text("\n".join(lines) + "\n")


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
