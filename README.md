# Job Search — Clinton Fernandes

A lightweight, no-install toolkit for running a job search end to end.

## What's here

```
.
├── tracker/
│   └── index.html              # Job application tracker — open in any browser
├── resume/
│   ├── master-resume.md        # Single source of truth (the full resume)
│   └── tailored/               # One tailored copy per application
├── templates/
│   └── cover-letter-template.md
└── applications.csv            # Optional: plain-text backup of your pipeline
```

## 1. Track applications

Open **`tracker/index.html`** in your browser (double-click it). No server, no install.

- Add / edit / delete applications with company, role, location, status, dates, comp,
  source, posting URL, contact, and notes.
- Pipeline statuses: Saved → Applied → Screening → Interview → Offer (plus Rejected / Withdrawn).
- Live search, status filter, sortable columns, and summary stats (incl. response rate).
- **Next-action dates** highlight in yellow, turn red ⚠ when overdue — your built-in follow-up nudge.
- **Export CSV** to back up to `applications.csv` and commit it to git; **Import CSV** to restore.

> Data is stored in your browser's `localStorage` (private to that browser). Export to CSV and
> commit it if you want a portable, version-controlled record.

## 2. Tailor your resume

1. Keep **`resume/master-resume.md`** complete — never trim it.
2. For each role, copy it to `resume/tailored/company-role.md`.
3. Cut and re-order bullets to mirror the job description's language and priorities; aim for 1–2 pages.
4. Export to PDF (e.g. open in any Markdown editor → print to PDF, or `pandoc file.md -o file.pdf`).

## 3. Write the cover letter

Start from **`templates/cover-letter-template.md`** — it's pre-loaded with your strongest
quantified wins (MLOps 6mo→<1mo, $25M recommendation demand, 615-director migration). Swap in the
company specifics and pick the one story that best matches the JD.

## Suggested workflow per application

1. Add the role to the tracker as **Saved**.
2. Tailor the resume + cover letter.
3. Submit → mark **Applied**, set a **Next action date** ~1 week out for follow-up.
4. Update status as you progress; log notes after every touchpoint.
5. Periodically **Export CSV** and `git commit` to keep a durable history.
