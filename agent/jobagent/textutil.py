"""Pure-Python text helpers (no heavy deps) so they're easy to unit-test."""
from __future__ import annotations

import re

_TITLE_NOISE = [
    r"^job application for\s+",
    r"\s*[-|·]\s*(lever|greenhouse|ashby|workday|careers?)\b.*$",
    r"\s*\|\s*.*careers.*$",
]


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:60] or "job"


def markdown_to_text(markdown_text: str) -> str:
    """Strip light Markdown markup so cover-letter text fits plain-text form fields."""
    t = markdown_text
    t = re.sub(r"^#{1,6}\s*", "", t, flags=re.MULTILINE)    # headings
    t = re.sub(r"\*\*(.+?)\*\*", r"\1", t)                   # bold
    t = re.sub(r"(?<!\*)\*(?!\s)(.+?)\*", r"\1", t)          # italics
    t = re.sub(r"^\s*[-*]\s+", "- ", t, flags=re.MULTILINE)  # bullets
    return t.strip()


def clean_title(raw: str) -> str:
    """Remove ATS boilerplate from a page title before splitting role/company."""
    t = raw.strip()
    for pat in _TITLE_NOISE:
        t = re.sub(pat, "", t, flags=re.IGNORECASE)
    return t.strip(" -|·")


def split_role_company(title: str) -> tuple[str, str]:
    """Best-effort (role, company) from a cleaned page/title string."""
    t = clean_title(title)
    for sep in [" at ", " @ ", " - ", " | ", " – ", " — "]:
        if sep in t:
            a, b = (s.strip() for s in t.split(sep, 1))
            # "Role at Company" / "Role - Company"
            return a, b
    return t, ""
