"""Typed structures shared across the agent."""
from __future__ import annotations

from dataclasses import dataclass, field
from pydantic import BaseModel


class TailoredApplication(BaseModel):
    """Structured output returned by the Claude tailoring call."""

    company: str
    role: str
    fit_score: int  # 0-100, how well the candidate matches the posting
    fit_summary: str  # 2-3 sentences: why this is/ isn't a strong match
    missing_keywords: list[str]  # JD keywords not well-covered by the resume
    tailored_resume_markdown: str
    cover_letter_markdown: str


class JobScore(BaseModel):
    """Lightweight triage output — fit + remote/sponsorship signals, no full materials."""

    company: str
    role: str
    location: str
    fit_score: int  # 0-100
    fit_summary: str  # one sentence
    missing_keywords: list[str]
    remote_friendly: str  # "yes" | "no" | "unclear"  (from the JD)
    sponsorship: str  # "offers" | "no sponsorship" | "not mentioned"  (from the JD)


@dataclass
class JobPosting:
    url: str
    company: str = ""
    role: str = ""
    location: str = ""
    description: str = ""
    ats: str = "generic"


@dataclass
class FillReport:
    filled: list[str] = field(default_factory=list)   # fields successfully filled
    skipped: list[str] = field(default_factory=list)  # fields not found / left for human
    notes: list[str] = field(default_factory=list)
