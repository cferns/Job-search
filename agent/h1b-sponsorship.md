# H1B Sponsorship — targeting & verification

You need an employer willing to sponsor an H1B. This guide helps you filter the
`urls.txt` list to companies that actually sponsor, and verify any employer before
spending effort on an application.

> Your `profile.yaml` is set with `needs_sponsorship: true`, so the agent answers
> work-authorization form questions truthfully. Visa status is **not** mentioned in
> cover letters — only in the explicit form field.

## The reality

- **Large, established US tech companies** routinely sponsor H1B (and file green cards).
- **Early-stage startups** (seed/Series A, < ~100 people) usually do **not** — sponsorship
  costs money and legal overhead they often skip. Don't waste a tailored application on them
  without checking.
- **Non-US-HQ companies** (e.g. UK/EU/AU) may sponsor in *their* country, not necessarily a
  US H1B — verify the specific posting's location and sponsorship.
- A posting that says "we do not provide visa sponsorship" is a hard no — skip it.

## Verify ANY employer in 60 seconds (do this before applying)

These databases show each company's actual H1B/LCA filing history with the U.S.
Department of Labor:

- **h1bgrader.com** — search the company, see LCA counts by year, job titles, salaries
- **myvisajobs.com** — H1B + green card (PERM) history per employer
- **USCIS H1B Employer Data Hub** — official government filing data
- **h1bvisajobs.com** — H1B-filtered job board (500K+ LCA records)
- **Built In — "Companies That Sponsor H-1B Visas"** — curated list
- **github.com/jobright-ai/Daily-H1B-Jobs-In-Tech** — daily-updated H1B PM/SWE jobs

Rule of thumb: if a company filed H1B LCAs in the last 1-2 years (especially for PM/TPM/
"program manager" titles), it sponsors. If zero filings ever, assume it won't.

## How your list breaks down (best-effort — VERIFY each on h1bgrader before applying)

**Likely sponsors (large/established US tech with H1B history):**
- Databricks ✅ *(confirmed: 381 H1B LCAs in 2025, ~$150k median)*
- OpenAI, Anthropic, DeepMind/Google — frontier AI labs, established sponsors
- Okta, DigitalOcean, Unity, Coinbase, Workato, Reltio, ABBYY, Ironclad, SingleStore,
  Bloomreach, Flexport, Yext, Justworks, Spring Health, Aledade, Hopper, WorkOS, MeridianLink
- (Most filed H1Bs recently — confirm the specific year/title on h1bgrader.)

**Verify carefully — fully-distributed or sponsorship-cautious:**
- Zapier, Toptal, 15Five, Jobgether (aggregator) — distributed companies sometimes can't or
  won't sponsor in all locations. Check the posting and h1bgrader.

**Non-US HQ (sponsorship may be for their home country, not US H1B):**
- Mistral AI (FR), Moss (DE), Xero (NZ/AU), Financial Times (UK), Plotly (CA), Symend (CA)

**Less likely (early-stage startups — confirm before investing time):**
- Cape, Credit Genie, Blank Metal, Mind Robotics, Protege, Snorkel AI(*), Arize AI(*),
  Rula, Togal, Machinify, EvenUp, Replit(*), Jerry.ai, Quest Analytics, WorkWave,
  Mulligan Funding, Mixbook, Verana Health, Verantos, Incode, ScienceLogic, Suzy, Netomi
- (*) some of these are well-funded and may sponsor — h1bgrader will tell you.

## Suggested workflow

1. For each role you like, search the company on **h1bgrader.com**.
2. If it shows recent H1B filings (ideally for PM/TPM titles) → keep it; run the agent.
3. If zero filings or "no sponsorship" in the JD → delete that line from `urls.txt`.
4. Prioritize the confirmed sponsors (Databricks, the AI labs, the established-tech tier).

## Optional: faster targeting

The H1B job boards above (h1bvisajobs.com, jobright.ai, Built In list) let you start from
*only* sponsoring employers. Pull TPM/PM roles there, drop the URLs into `urls.txt`, and the
agent tailors + applies as usual — but every company is pre-filtered for sponsorship.
