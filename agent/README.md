# Job Application Agent

A human-in-the-loop agent that, for a given job posting URL:

1. Opens the posting in a real browser (your logins persist between runs).
2. Detects the ATS (Greenhouse, Lever, Ashby, Workday, LinkedIn, Indeed).
3. Scrapes the job description.
4. Tailors your resume **and** writes a cover letter with the Claude API (using
   `resume/master-resume.md` as the single source of truth — it never invents facts).
5. Fills the application form with your profile data and uploads the tailored resume PDF.
6. **Pauses for you to review and submit** (default), then logs everything to
   `applications.csv` so it shows up in the tracker.

> **Honest scope.** This is built for *your own* job search with *your own* accounts.
> - **Greenhouse / Lever / Ashby** automate reliably — this is where the agent shines.
> - **Workday** is multi-step; the agent fills page 1 and you drive the rest.
> - **LinkedIn / Indeed** aggressively block automation, so the agent does **not**
>   auto-submit there (that risks an account ban). It scrapes the JD, generates your
>   tailored materials, and leaves the form for you to complete manually.
> - Default mode is **review-before-submit**. Nothing is submitted without you.

## Setup

```bash
cd agent
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python -m playwright install chromium      # one-time browser download

cp config/profile.example.yaml  config/profile.yaml     # then fill in your details
cp config/settings.example.yaml config/settings.yaml    # adjust if you like

export ANTHROPIC_API_KEY=sk-ant-...        # your Anthropic API key
```

`config/profile.yaml`, `config/settings.yaml`, and the browser profile are **gitignored** —
they hold your personal data and logged-in sessions.

## Usage

```bash
# Tailor + fill one posting, then review & submit yourself (default)
python -m jobagent.cli apply "https://boards.greenhouse.io/acme/jobs/123"

# A batch from a file (one URL per line)
python -m jobagent.cli apply --file urls.txt

# Draft only — generate tailored resume + cover letter, no browser, no form filling
python -m jobagent.cli draft "https://jobs.lever.co/acme/abc"

# Rank — triage a list: scrape + score fit, detect remote + sponsorship, write shortlist.md
python -m jobagent.cli rank --file urls.txt

# Stats — jobs pipeline (from applications.csv) + what the agent has learned
python -m jobagent.cli stats
```

## The learning loop (the agent gets better as you use it)

The agent keeps a memory in `agent/data/learnings.json` (gitignored — it holds your
answers) and uses it to improve every run:

1. **Answer bank.** Seeded from your `profile.yaml` (work authorization, sponsorship, years,
   EEO, links…), so custom screener questions fill from the very first run. After each
   application it asks two quick questions — *rate the tailoring 1–5* and *which fields did
   you fill by hand?* (`label=value; label2=value2`) — and **remembers those answers**, so the
   next posting that asks the same question is filled automatically. (Disable with
   `collect_feedback: false`.)
2. **Per-platform reliability.** It records which fields filled vs. were skipped per ATS, and
   warns you up front about fields that usually need manual entry on that platform.
3. **Sharper tailoring.** Recurring JD themes your resume under-covered across past postings
   are fed back into the tailoring prompt (surfacing genuinely relevant experience — never
   fabricating).
4. **Jobs-applied view.** `stats` shows your pipeline (Saved/Applied/Interview/Offer…),
   response rate, average tailoring rating, fill reliability per platform, and the recurring
   gaps it's learned.

### Triage first with `rank` (recommended for long lists)

`rank` opens each posting, scrapes the JD, and has Claude score the match **cheaply**
(no resume/cover-letter generation) while reading the **remote** and **visa sponsorship**
signals straight from the job description. It writes `shortlist.md` — a table sorted by fit
score — so you apply to the strongest, remote, sponsor-friendly roles first instead of
working a raw list top to bottom.

```bash
python -m jobagent.cli rank --file urls.txt   # -> writes ./shortlist.md
# then apply to the top matches:
python -m jobagent.cli apply "<top url from shortlist>"
```

> `sponsorship` in the shortlist reflects only what the posting states — always confirm the
> employer's H1B history on h1bgrader.com (see `h1b-sponsorship.md`).

**First run with LinkedIn/Indeed/Workday:** the browser opens with a persistent profile,
so log into those sites once in that window. Your session is reused on later runs.

### Modes (`submit_mode` in settings, or `--mode`)

| Mode     | What it does                                                            |
| -------- | ---------------------------------------------------------------------- |
| `review` | Fills everything, pauses for you to review and click submit (default). |
| `auto`   | Clicks submit without review. Higher ToS/quality risk — use sparingly. |
| `draft`  | Generates tailored resume + cover letter only. No browser.            |

## What gets produced per posting

- `resume/tailored/<company>-<role>-resume.md` and `.pdf` (the PDF is uploaded)
- `resume/tailored/<company>-<role>-cover-letter.md`
- A row appended to `applications.csv` (Applied / Saved), visible in `tracker/index.html`

## How tailoring works

`jobagent/tailor.py` calls the Claude API (`messages.parse` with a structured schema,
adaptive thinking, model from settings — default `claude-opus-4-8`). It returns a tailored
resume, a cover letter, a fit score, and a list of JD keywords your resume doesn't yet
evidence — so you see the real gaps before applying.

## Adding a new ATS

Drop a `jobagent/adapters/<name>.py` subclassing `BaseAdapter` (implement
`get_job_description` and `fill`), then register it in `jobagent/adapters/__init__.py`
and add a host match in `jobagent/detect.py`.

## Safe re-runs

`apply` automatically **skips URLs already logged as `Applied`** in `applications.csv`, so
re-running a list won't double-apply (and a failed batch resumes where it left off). Pass
`--force` to include them anyway. `draft` always regenerates.

The agent also navigates to the real **application form** before filling (Lever `/apply`,
Greenhouse/Ashby "Apply" button) — except LinkedIn/Indeed, which it never auto-advances.

## Tests

```bash
cd agent
python tests/test_helpers.py     # stdlib runner, no extra deps
# or: python -m pytest tests/
```

## Limitations & cautions

- CAPTCHAs, SSO/login walls, and unusual custom questions always need you. That's expected
  — the agent does the tailoring and the boilerplate; you handle judgment and submission.
- Auto-submitting to LinkedIn/Indeed is intentionally not supported.
- Review the tailored resume before it's uploaded — you are responsible for what you submit.
