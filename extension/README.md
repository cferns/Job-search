# Job Application Autofill — Chrome Extension

Fills the job-application form **you're looking at**, in **your** browser (your logins, your
session), using Claude + your resume. You review and submit. No Python, no terminal.

## Why this instead of the agent
- No install/setup — load it once.
- Runs in your real, logged-in browser → no separate automated browser, fewer bot/login blocks.
- Works on whatever live posting you open → no stale URLs.
- You stay in control: it fills, you review and click submit.

It does **not** solve CAPTCHAs, and it does **not** click submit for you (by design).

## Install (one time, ~1 minute)
1. Open Chrome → `chrome://extensions`
2. Toggle **Developer mode** on (top-right).
3. Click **Load unpacked** → select this `extension/` folder.
4. Click the extension's **Details → Extension options** (or the "Settings" link in the popup).
5. Paste your **Anthropic API key** (from console.anthropic.com). Your resume + profile are
   pre-filled — edit if needed, add your LinkedIn URL — then **Save**.

The API key and resume are stored **locally in your browser only** (chrome.storage), never sent
anywhere except directly to Anthropic's API.

## Use
1. Go to a job posting and open its **application form** (the page with the fields — e.g. the
   Lever `/apply` page, or after clicking "Apply").
2. Click the extension icon → **Tailor & Fill this form**.
3. Wait ~10–30s. It reads the form, asks Claude for answers, and fills text boxes, dropdowns,
   and radio questions (work auth, sponsorship, etc.).
4. **Review everything**, fix anything it left or got wrong, then click the site's **Submit**.

## Notes
- If it says "No empty fields found," you're probably on the job *description*, not the
  application form — click "Apply" first.
- Pick the model in Settings: `claude-sonnet-4-6` (fast) or `claude-opus-4-8` (highest quality).
- It only fills **empty** fields, so you can run it again after fixing things without it
  overwriting your edits.
