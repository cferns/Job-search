# Job Search — Clinton Fernandes

An end-to-end job-search toolkit: a no-install application **tracker**, a tailoring source
of truth, conversion **assets** (interview/outreach/LinkedIn), and a learning **agent** that
tailors materials with the Claude API, fills application forms, and gets better as you use it.

## Repository map

```
.
├── tracker/
│   └── index.html              # Application tracker — open in any browser (localStorage + CSV)
├── resume/
│   ├── master-resume.md        # Single source of truth (full resume)
│   └── tailored/               # Per-application tailored resumes/cover letters/PDFs (generated)
├── templates/
│   └── cover-letter-template.md
├── job-search-kit/             # Conversion assets (interview, outreach, LinkedIn, positioning)
│   ├── interview-prep.md       #   STAR stories + TPM/PM question bank
│   ├── outreach-templates.md   #   referral/recruiter messages + H1B framing
│   ├── linkedin-profile.md     #   keyword-optimized headline + About
│   └── positioning-one-pager.md
├── agent/                      # The apply agent (Python + Playwright + Claude API)
│   ├── jobagent/               #   package: cli, runner, tailor, adapters, store, …
│   ├── tests/                  #   stdlib + pytest unit tests
│   ├── urls.txt                #   curated, sponsor-friendly target roles
│   ├── h1b-sponsorship.md      #   H1B targeting & verification guide
│   ├── data/                   #   learning store (gitignored — holds your answers)
│   └── README.md               #   agent setup & full usage
└── applications.csv            # Pipeline record, shared by the tracker and the agent
```

---

## 1. Application tracker — `tracker/index.html`

Double-click to open in any browser. No server, no install.
- Add/edit/delete applications: company, role, location, status, dates, comp, source, URL,
  contact, notes.
- Pipeline: Saved → Applied → Screening → Interview → Offer (+ Rejected / Withdrawn).
- Live search, status filter, sortable columns, summary stats incl. **response rate**.
- **Next-action dates** turn yellow when due, red ⚠ when overdue.
- **CSV export/import** — back up to `applications.csv` (the same file the agent writes).

## 2. Resume & cover letter

- **`resume/master-resume.md`** — your complete history; never trim it. The agent uses it as
  the factual source of truth for tailoring (and is instructed never to invent facts).
- **`templates/cover-letter-template.md`** — manual template, pre-loaded with your strongest
  wins, if you'd rather write one by hand.
- **`resume/tailored/`** — where the agent writes each tailored resume `.md`, cover letter
  `.md`, and the uploaded `.pdf` (generated files are gitignored).

## 3. Job search kit — `job-search-kit/`

The agent gets you volume; these get you **conversion**:
- **interview-prep.md** — 7 STAR stories from your real wins + a TPM/PM question bank + pitch.
- **outreach-templates.md** — referral, recruiter, and hiring-manager messages, follow-ups,
  and the right way to frame H1B sponsorship.
- **linkedin-profile.md** — keyword-optimized headline + About so recruiters find you.
- **positioning-one-pager.md** — value prop, 3 case studies, 30/60-second pitches.

## 4. The apply agent — `agent/`

A human-in-the-loop agent that, per job posting URL: detects the ATS → scrapes the JD →
**tailors a resume + cover letter with the Claude API** → renders a PDF → navigates to the
real application form → fills it → **pauses for you to review and submit** → logs and learns.

### Commands

| Command | What it does |
| ------- | ------------ |
| `apply <url…> / --file urls.txt` | Tailor, fill, and (review mode) pause for you to submit. Skips already-applied URLs; `--force` to override. |
| `draft <url…>` | Generate tailored resume + cover letter only — no browser, no form filling. |
| `rank --file urls.txt` | Scrape + **score fit** for each role and read **remote** + **visa-sponsorship** signals from the JD; writes a fit-sorted `shortlist.md`. |
| `stats` | Jobs pipeline, response rate, **conversion by platform**, fill reliability, A/B standings, learned answers. |
| `outcome <url> <status>` | Update a role's status (Applied→Interview→Offer…); feeds conversion stats. |

**Submit modes** (`settings.yaml` / `--mode`): `review` (fill, you submit — default) ·
`auto` (fill + submit) · `draft` (materials only).

### Tailoring (Claude API)
Uses the official Anthropic SDK — structured output (`messages.parse`) with adaptive
thinking; default model `claude-opus-4-8` (configurable). Returns a tailored resume, cover
letter, a **fit score**, and the **JD keywords your resume doesn't yet evidence**.

### Per-platform scope (honest)
- **Greenhouse / Lever / Ashby** — automate well (form navigation + field fill).
- **Workday** — fills page 1; you drive the multi-step flow.
- **LinkedIn / Indeed** — scrape + draft only; the agent never auto-submits (avoids bans).

### The learning loop (it improves with use)
Stored in `agent/data/learnings.json` (gitignored — holds your answers):
1. **Answer bank** — seeded from your profile so custom screener questions (work auth,
   sponsorship, years, EEO, links) fill from run #1; grows from your corrections.
2. **Feedback capture** — after each application it asks *rate the tailoring 1–5* and *which
   fields did you fill by hand?* and remembers those answers for next time.
3. **Per-platform reliability** — tracks fill success per ATS and warns about common manual
   fields before you review.
4. **A/B cover-letter angles** — rotates impact-first / mission-fit / problem-solver; your
   ratings drive a bandit that learns the winner.
5. **Outcome tracking** — `outcome` updates status and powers conversion-by-platform.
6. **Sharper tailoring** — recurring JD themes your resume under-covered are fed back into the
   prompt (surface real experience, never fabricate).

### H1B sponsorship
Profile is set to answer work-authorization questions truthfully; visa status is kept out of
cover letters. See [`agent/h1b-sponsorship.md`](agent/h1b-sponsorship.md) for verifying any
employer (h1bgrader/myvisajobs) and a sponsor-tiered breakdown of the target list.

### Curated targets
**`agent/urls.txt`** — curated TPM/PM Data·AI·ML roles on Greenhouse/Lever/Ashby (incl. a
remote-focused set), ready for `rank` / `apply`. Verify each opens before relying on it.

### Setup & tests
```bash
cd agent
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python -m playwright install chromium
cp config/profile.example.yaml  config/profile.yaml     # fill in
cp config/settings.example.yaml config/settings.yaml
export ANTHROPIC_API_KEY=sk-ant-...
python tests/test_helpers.py && python tests/test_store.py   # 11 unit tests
```
Full agent docs: [`agent/README.md`](agent/README.md).

---

## Recommended end-to-end workflow

1. **Set up once** — update LinkedIn from the kit; fill `agent/config/profile.yaml`.
2. **Triage** — `rank --file urls.txt`, open `shortlist.md`, pick high-fit / remote /
   sponsor-friendly roles; verify sponsors on h1bgrader.
3. **Referral first** — use the outreach templates before applying cold (biggest lever).
4. **Apply** — `apply` the shortlist (review mode); the agent tailors, fills, and learns.
5. **Track outcomes** — `outcome <url> Interview` as roles progress; check `stats`.
6. **Prep** — rehearse the STAR stories so you convert the moment a recruiter replies.

## Privacy
Personal config (`agent/config/profile.yaml`, `settings.yaml`), the learning store
(`agent/data/`), the browser profile, and generated PDFs are **gitignored** — they hold
personal data and stay on your machine.
