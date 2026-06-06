"""Detect which ATS / job platform a URL belongs to."""
from __future__ import annotations

from urllib.parse import urlparse

# host substring -> adapter key
_HOST_MATCHERS = [
    ("boards.greenhouse.io", "greenhouse"),
    ("job-boards.greenhouse.io", "greenhouse"),
    ("greenhouse.io", "greenhouse"),
    ("jobs.lever.co", "lever"),
    ("lever.co", "lever"),
    ("jobs.ashbyhq.com", "ashby"),
    ("ashbyhq.com", "ashby"),
    ("myworkdayjobs.com", "workday"),
    ("workday.com", "workday"),
    ("linkedin.com", "linkedin"),
    ("indeed.com", "indeed"),
]


def detect_ats(url: str, page_html: str = "") -> str:
    host = (urlparse(url).hostname or "").lower()
    for needle, key in _HOST_MATCHERS:
        if needle in host:
            return key

    # Fall back to DOM fingerprints (e.g. an embedded Greenhouse iframe).
    html = page_html.lower()
    if "greenhouse.io" in html or "grnhse" in html:
        return "greenhouse"
    if "lever.co" in html:
        return "lever"
    if "ashbyhq" in html:
        return "ashby"
    if "myworkdayjobs" in html or "workday" in html:
        return "workday"
    return "generic"
