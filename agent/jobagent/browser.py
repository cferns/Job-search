"""Playwright session management and Markdown -> PDF rendering."""
from __future__ import annotations

from contextlib import contextmanager
from pathlib import Path

import markdown as md_lib
from playwright.sync_api import Playwright, sync_playwright

# Minimal print stylesheet so generated resume PDFs look clean.
_PDF_CSS = """
body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 10.5pt;
       line-height: 1.4; color: #1a1a1a; max-width: 7.5in; margin: 0 auto; }
h1 { font-size: 20pt; margin: 0 0 2px; }
h2 { font-size: 13pt; border-bottom: 1px solid #ccc; padding-bottom: 2px;
     margin: 14px 0 6px; }
h3 { font-size: 11.5pt; margin: 10px 0 2px; }
ul { margin: 4px 0 8px; padding-left: 18px; }
li { margin: 2px 0; }
p { margin: 4px 0; }
a { color: #1a1a1a; text-decoration: none; }
em { color: #555; }
"""


@contextmanager
def browser_session(user_data_dir: Path, headless: bool = False):
    """Persistent-context browser so the user's logins survive across runs.

    Yields (playwright, context, page). The playwright handle is exposed so callers
    can launch an additional headless browser (e.g. for PDF rendering) from the SAME
    instance — starting a second sync_playwright() in one thread would error.
    """
    user_data_dir.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        context = p.chromium.launch_persistent_context(
            user_data_dir=str(user_data_dir),
            headless=headless,
            args=["--start-maximized"],
            no_viewport=True,
        )
        try:
            page = context.pages[0] if context.pages else context.new_page()
            yield p, context, page
        finally:
            context.close()


def _render(pw: Playwright, html: str, out_path: Path) -> None:
    browser = pw.chromium.launch(headless=True)
    try:
        page = browser.new_page()
        page.set_content(html, wait_until="load")
        page.pdf(
            path=str(out_path),
            format="Letter",
            margin={"top": "0.5in", "bottom": "0.5in", "left": "0.6in", "right": "0.6in"},
            print_background=True,
        )
    finally:
        browser.close()


def render_markdown_to_pdf(markdown_text: str, out_path: Path, pw: Playwright | None = None) -> Path:
    """Render Markdown to a clean PDF using a headless Chromium.

    page.pdf() requires headless Chromium, so we always launch a dedicated headless
    browser. Pass `pw` (the active Playwright from browser_session) to reuse it; if
    omitted (e.g. draft mode, no browser open) we start our own instance.
    """
    out_path.parent.mkdir(parents=True, exist_ok=True)
    html_body = md_lib.markdown(markdown_text, extensions=["extra"])
    html = f"<!doctype html><html><head><meta charset='utf-8'>" \
           f"<style>{_PDF_CSS}</style></head><body>{html_body}</body></html>"

    if pw is not None:
        _render(pw, html, out_path)
    else:
        with sync_playwright() as p:
            _render(p, html, out_path)
    return out_path
