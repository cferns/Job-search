"""Playwright session management and Markdown -> PDF rendering."""
from __future__ import annotations

from contextlib import contextmanager
from pathlib import Path

import markdown as md_lib
from playwright.sync_api import sync_playwright

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
    """Persistent-context browser so the user's logins survive across runs."""
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
            yield context, page
        finally:
            context.close()


def render_markdown_to_pdf(markdown_text: str, out_path: Path) -> Path:
    """Render Markdown to a clean one/two-page PDF using a headless Chromium."""
    out_path.parent.mkdir(parents=True, exist_ok=True)
    html_body = md_lib.markdown(markdown_text, extensions=["extra"])
    html = f"<!doctype html><html><head><meta charset='utf-8'>" \
           f"<style>{_PDF_CSS}</style></head><body>{html_body}</body></html>"

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.set_content(html, wait_until="load")
        page.pdf(
            path=str(out_path),
            format="Letter",
            margin={"top": "0.5in", "bottom": "0.5in", "left": "0.6in", "right": "0.6in"},
            print_background=True,
        )
        browser.close()
    return out_path
