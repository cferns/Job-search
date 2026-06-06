"""Tailor a resume + cover letter to a specific job description using the Claude API."""
from __future__ import annotations

import anthropic

from .models import JobPosting, JobScore, TailoredApplication

SYSTEM = """You are an expert technical recruiter and resume writer. You tailor a \
candidate's master resume and write a cover letter for a specific job posting.

Rules:
- Use ONLY facts present in the master resume. Never invent employers, titles, dates,
  metrics, degrees, or skills. Do not exaggerate. Honesty is mandatory.
- Tailoring means selecting, reordering, and rephrasing the candidate's real experience
  to mirror the job description's priorities and language — not fabricating new content.
- The tailored resume must stay truthful but emphasize the most relevant experience first,
  and adopt keyword phrasing from the JD where it genuinely matches the candidate.
- Keep the tailored resume to roughly one to two pages of content, in clean Markdown.
- The cover letter is 250-350 words, 3-4 short paragraphs: a specific hook tied to the
  company, ONE quantified achievement that maps to the role, a connection to their needs,
  and a concise close. No clichés, no filler.
- fit_score (0-100) is your honest assessment of match strength based on the resume vs JD.
- missing_keywords lists important JD requirements the resume does not clearly evidence,
  so the candidate knows the real gaps before applying."""

# A/B cover-letter angles. The agent rotates these and learns which your ratings prefer.
COVER_ANGLES = {
    "impact-first": "Open the cover letter with your single strongest quantified "
                    "achievement, then connect it directly to this role.",
    "mission-fit": "Open with a specific, genuine reason this company/mission appeals, "
                   "then tie your relevant experience to it.",
    "problem-solver": "Open by naming a concrete problem this role likely needs solved, "
                      "then show how you've solved a similar one (with a metric).",
}

USER_TEMPLATE = """# Master resume (source of truth — use only these facts)

{master_resume}

# Job posting

Company: {company}
Role: {role}
Location: {location}
URL: {url}

## Job description
{description}

# Extra candidate context
{extra_context}

Produce the tailored application now."""


def tailor_application(
    *,
    model: str,
    master_resume: str,
    posting: JobPosting,
    extra_context: str = "",
    angle: str = "",
) -> TailoredApplication:
    """Call Claude to produce a tailored resume + cover letter as structured output."""
    client = anthropic.Anthropic()

    user = USER_TEMPLATE.format(
        master_resume=master_resume,
        company=posting.company or "(unknown)",
        role=posting.role or "(unknown)",
        location=posting.location or "(unspecified)",
        url=posting.url,
        description=posting.description or "(description not captured — infer from role/company)",
        extra_context=extra_context or "(none)",
    )
    if angle in COVER_ANGLES:
        user += f"\n\n# Cover letter angle for this application\n{COVER_ANGLES[angle]}"

    response = client.messages.parse(
        model=model,
        max_tokens=16000,  # room for adaptive thinking + full resume + cover letter
        thinking={"type": "adaptive"},
        system=SYSTEM,
        messages=[{"role": "user", "content": user}],
        output_format=TailoredApplication,
    )

    if response.stop_reason == "refusal" or response.parsed_output is None:
        raise RuntimeError(
            "Tailoring failed: the model did not return a parseable application "
            f"(stop_reason={response.stop_reason})."
        )
    return response.parsed_output


SCORE_SYSTEM = """You triage job postings for a candidate. Given the candidate's master \
resume and a job posting, you output a concise match assessment — NOT a full application.

- fit_score (0-100): honest match strength of the candidate's real experience vs the JD.
- fit_summary: ONE sentence on the core reason for the score.
- missing_keywords: the few most important JD requirements the resume doesn't evidence.
- remote_friendly: read the JD/location. "yes" if remote is offered, "no" if clearly
  onsite-only, "unclear" if not stated.
- sponsorship: read the JD ONLY. "offers" if it says visa/H1B sponsorship is available,
  "no sponsorship" if it says sponsorship is NOT available, "not mentioned" otherwise.
  Do not guess from company reputation — report only what the posting states."""

SCORE_USER = """# Candidate master resume
{master_resume}

# Job posting
Company: {company}
Role: {role}
Location: {location}
URL: {url}

## Job description
{description}

Assess the match now."""


def score_posting(*, model: str, master_resume: str, posting: JobPosting) -> JobScore:
    """Cheap triage: fit score + remote/sponsorship signals, no resume/cover generation."""
    client = anthropic.Anthropic()
    user = SCORE_USER.format(
        master_resume=master_resume,
        company=posting.company or "(unknown)",
        role=posting.role or "(unknown)",
        location=posting.location or "(unspecified)",
        url=posting.url,
        description=posting.description or "(not captured)",
    )
    response = client.messages.parse(
        model=model,
        max_tokens=2000,
        thinking={"type": "adaptive"},
        system=SCORE_SYSTEM,
        messages=[{"role": "user", "content": user}],
        output_format=JobScore,
    )
    if response.stop_reason == "refusal" or response.parsed_output is None:
        raise RuntimeError(f"Scoring failed (stop_reason={response.stop_reason}).")
    return response.parsed_output


QA_SYSTEM = """You answer ONE job-application question for a candidate, using only facts in \
their master resume. Be specific, truthful, and concise — never invent employers, metrics, \
titles, dates, or skills. Plain text only (no markdown, no preamble like 'Sure' or 'Here is'). \
Keep it to 1–2 short paragraphs unless the question clearly asks for a list. Write in first \
person as the candidate."""


def answer_question(*, model: str, master_resume: str, posting: JobPosting,
                    question: str, extra_context: str = "") -> str:
    """Generate a truthful, grounded answer to an arbitrary application question."""
    client = anthropic.Anthropic()
    user = (
        f"# Candidate master resume (only source of facts)\n{master_resume}\n\n"
        f"# Job\n{posting.role} at {posting.company}\n"
        f"JD (may be partial):\n{(posting.description or '')[:4000]}\n\n"
        f"# Extra context\n{extra_context or '(none)'}\n\n"
        f"# Application question\n{question}\n\n"
        f"Write only the answer, in plain text."
    )
    resp = client.messages.create(
        model=model,
        max_tokens=1200,
        thinking={"type": "adaptive"},
        system=QA_SYSTEM,
        messages=[{"role": "user", "content": user}],
    )
    return "".join(b.text for b in resp.content if b.type == "text").strip()
