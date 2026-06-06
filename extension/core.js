// Shared engine used by both the popup and the Job Search dashboard.

const SEARCHES = [
  ["LinkedIn (remote)", (q) => "https://www.linkedin.com/jobs/search/?keywords=" + encodeURIComponent(q) + "&f_WT=2"],
  ["Indeed (remote)", (q) => "https://www.indeed.com/jobs?q=" + encodeURIComponent(q) + "&l=Remote"],
  ["Greenhouse/Lever/Ashby", (q) => "https://www.google.com/search?q=" + encodeURIComponent(q + " (site:boards.greenhouse.io OR site:jobs.lever.co OR site:jobs.ashbyhq.com)")],
  ["Remote + H1B", (q) => "https://www.google.com/search?q=" + encodeURIComponent(q + " remote H1B visa sponsorship jobs")],
];

function isJobUrl(u) {
  return /(boards|job-boards)\.greenhouse\.io\/.+\/jobs\/|jobs\.lever\.co\/[^/]+\/[0-9a-f-]{8,}|jobs\.ashbyhq\.com\/[^/]+\/[0-9a-f-]{8,}|myworkdayjobs\.com\/.+\/job\/|careers?\.[^/]+\/jobs?\/|\/jobs?\/[0-9]{4,}/i.test(u || "");
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitTabComplete(tabId, timeout = 25000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try { const t = await chrome.tabs.get(tabId); if (t.status === "complete") return; } catch (e) { return; }
    await sleep(400);
  }
}

async function getCfg() {
  const c = await chrome.storage.local.get(["apiKey", "model", "resume", "profile", "learned", "resumeFile"]);
  c.model = c.model || "claude-sonnet-4-6"; c.resume = c.resume || ""; c.profile = c.profile || "";
  return c;
}

// ---------- injected page functions (must be self-contained) ----------
function scrapeFields() {
  const isVis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 1 && r.height > 1 && s.visibility !== "hidden" && s.display !== "none"; };
  const txt = (el) => (el && el.innerText ? el.innerText.trim() : "");
  const groupQuestion = (el) => {
    let n = el;
    for (let i = 0; i < 8 && n; i++) { n = n.parentElement; if (!n) break;
      if (n.matches('fieldset,[role="radiogroup"],[role="group"],.application-question,li,[class*="question"],[class*="field"]')) {
        const lab = n.querySelector(".application-label, legend, label, h2, h3, h4");
        const t = txt(lab) || txt(n).split("\n")[0]; if (t && t.length > 3) return t.slice(0, 180); } }
    return "";
  };
  const optionLabel = (el) => {
    if (el.id) { const l = document.querySelector('label[for="' + CSS.escape(el.id) + '"]'); if (txt(l)) return txt(l); }
    const wrap = el.closest("label"); if (txt(wrap)) return txt(wrap);
    const sib = el.nextElementSibling; if (txt(sib)) return txt(sib);
    return el.value || "option";
  };
  const labelFor = (el) => {
    const al = el.getAttribute("aria-label"); if (al && al.trim()) return al.trim();
    const lid = el.getAttribute("aria-labelledby"); if (lid) { const t = document.getElementById(lid.split(" ")[0]); if (txt(t)) return txt(t); }
    if (el.id) { const l = document.querySelector('label[for="' + CSS.escape(el.id) + '"]'); if (txt(l)) return txt(l); }
    let n = el;
    for (let i = 0; i < 6 && n; i++) { n = n.parentElement; if (!n) break;
      const l = n.querySelector('label,.application-label,legend,[class*="label"],[class*="question"]');
      if (txt(l) && txt(l).length > 2) return txt(l).split("\n")[0].slice(0, 160); }
    return el.getAttribute("placeholder") || el.getAttribute("name") || "";
  };
  let idx = 0; const out = []; const groups = {};
  document.querySelectorAll('input,textarea,select,[role="radio"],[role="checkbox"]').forEach((el) => {
    const tag = el.tagName.toLowerCase(); const type = (el.getAttribute("type") || "").toLowerCase(); const role = (el.getAttribute("role") || "").toLowerCase();
    if (["hidden", "submit", "button", "file", "image", "reset"].includes(type)) return;
    if (!isVis(el)) return;
    const isChoice = (tag === "input" && (type === "radio" || type === "checkbox")) || role === "radio" || role === "checkbox";
    if (isChoice) {
      const name = el.getAttribute("name") || ("grp_" + (groupQuestion(el) || idx));
      el.setAttribute("data-ja", idx);
      const opt = { label: optionLabel(el) || "opt" + idx, ja: idx };
      if (groups[name] === undefined) { groups[name] = out.length; out.push({ kind: "radio", label: groupQuestion(el), options: [opt] }); }
      else out[groups[name]].options.push(opt);
      idx++; return;
    }
    if (tag === "select") { if (el.selectedIndex > 0 && el.value) return; } else if (el.value && el.value.trim()) return;
    el.setAttribute("data-ja", idx);
    const f = { ja: idx, kind: tag === "select" ? "select" : (tag === "textarea" ? "textarea" : "text"), label: labelFor(el) };
    if (tag === "select") f.options = [...el.options].map((o) => o.textContent.trim()).filter(Boolean);
    out.push(f); idx++;
  });
  return { fields: out, jd: (document.body.innerText || "").slice(0, 6000), url: location.href };
}

async function applyActions(actions) {
  const sleep2 = (ms) => new Promise((r) => setTimeout(r, ms));
  const setNativeValue = (el, value) => {
    const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
    setter.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true }));
  };
  const isCombo = (el) => el.getAttribute("role") === "combobox" || el.getAttribute("aria-autocomplete") || el.getAttribute("aria-controls") || el.getAttribute("aria-expanded") !== null || /select|combobox|typeahead|autocomplete|location/i.test((el.className || "") + (el.id || "") + (el.name || ""));
  const fillCombo = async (el, value) => {
    el.focus(); setNativeValue(el, value); const k = value.slice(-1);
    el.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: k })); el.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: k }));
    for (let w = 0; w < 4; w++) {
      await sleep2(500);
      const want = value.toLowerCase().split(",")[0].trim();
      const opts = [...document.querySelectorAll('[role="option"],ul[role="listbox"] li,.select__option,[class*="option"],[class*="suggestion"],[class*="menu"] li')].filter((o) => o.offsetParent !== null && o.innerText && o.innerText.trim());
      const pick = opts.find((o) => o.innerText.toLowerCase().includes(want)) || opts[0];
      if (pick) { pick.click(); return true; }
    }
    el.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "ArrowDown" })); el.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Enter" })); return false;
  };
  let n = 0;
  for (const a of actions || []) {
    try {
      const el = document.querySelector('[data-ja="' + a.ja + '"]'); if (!el) continue;
      if (a.action === "click") { el.click(); n++; }
      else if (a.action === "select") {
        const opt = [...el.options].find((o) => o.textContent.trim().toLowerCase() === String(a.value).trim().toLowerCase()) || [...el.options].find((o) => o.textContent.trim().toLowerCase().includes(String(a.value).trim().toLowerCase()));
        if (opt) { el.value = opt.value; el.dispatchEvent(new Event("change", { bubbles: true })); n++; }
      } else if (a.action === "type" && a.value) {
        if (isCombo(el)) { await fillCombo(el, a.value); n++; } else { setNativeValue(el, a.value); n++; }
      }
    } catch (e) { /* skip */ }
  }
  return n;
}

async function applyResume(file) {
  try {
    const all = [...document.querySelectorAll('input[type="file"]')];
    if (!all.length || !file || !file.dataUrl) return 0;
    let target = all.find((i) => /resume|cv/i.test((i.name || "") + (i.id || "") + (i.getAttribute("aria-label") || "") + (i.closest("label") ? i.closest("label").innerText : "")));
    if (!target) target = all[0];
    const res = await fetch(file.dataUrl); const blob = await res.blob();
    const f = new File([blob], file.name || "resume.pdf", { type: file.type || "application/pdf" });
    const dt = new DataTransfer(); dt.items.add(f); target.files = dt.files;
    target.dispatchEvent(new Event("input", { bubbles: true })); target.dispatchEvent(new Event("change", { bubbles: true }));
    return 1;
  } catch (e) { return 0; }
}

function clickApply() {
  const cands = [...document.querySelectorAll("a,button")].filter((e) => e.offsetParent !== null && /^apply\b|apply for|apply now|submit application/i.test((e.innerText || "").trim()));
  if (cands[0]) { cands[0].click(); return true; }
  return false;
}

function scrapeAnswers() {
  const txt = (el) => (el && el.innerText ? el.innerText.trim() : "");
  const labelUp = (el) => {
    const al = el.getAttribute("aria-label"); if (al && al.trim()) return al.trim();
    if (el.id) { const l = document.querySelector('label[for="' + CSS.escape(el.id) + '"]'); if (txt(l)) return txt(l); }
    let n = el; for (let i = 0; i < 6 && n; i++) { n = n.parentElement; if (!n) break;
      const l = n.querySelector('label,.application-label,legend,[class*="label"],[class*="question"]');
      if (txt(l) && txt(l).length > 2) return txt(l).split("\n")[0].slice(0, 180); }
    return el.getAttribute("placeholder") || el.getAttribute("name") || "";
  };
  const groupQ = (el) => { let n = el; for (let i = 0; i < 8 && n; i++) { n = n.parentElement; if (!n) break;
    if (n.matches('fieldset,[role="radiogroup"],.application-question,li,[class*="question"]')) { const lab = n.querySelector(".application-label, legend, label"); const t = txt(lab) || txt(n).split("\n")[0]; if (t && t.length > 3) return t.slice(0, 180); } } return ""; };
  const out = [];
  document.querySelectorAll("input,textarea,select").forEach((el) => {
    const tag = el.tagName.toLowerCase(); const type = (el.getAttribute("type") || "").toLowerCase();
    if (["hidden", "submit", "button", "file", "image", "reset", "password"].includes(type)) return;
    if (tag === "input" && (type === "radio" || type === "checkbox")) {
      if (el.checked) { const q = groupQ(el); const wrap = el.closest("label"); const a = txt(wrap) || el.value; if (q && a) out.push({ question: q, answer: a }); }
    } else { const v = tag === "select" ? (el.options[el.selectedIndex] ? el.options[el.selectedIndex].text : el.value) : el.value; if (v && v.trim()) out.push({ question: labelUp(el), answer: v.trim() }); }
  });
  return out;
}

// ---------- extension-context functions ----------
const SYSTEM = `You fill a job-application form for a candidate. You get a JSON list of empty fields \
(each: numeric id "ja", "kind", its "label"/question, and "options" for selects/radios). \
Return ONLY JSON: {"actions":[...]}. Each action: \
{"ja":N,"action":"type","value":"..."} for text/textarea; \
{"ja":N,"action":"select","value":"exact option text"} for a <select>; \
{"ja":N,"action":"click"} where ja is the OPTION's id, to pick a radio/checkbox. \
Use ONLY facts from the candidate profile/resume — never invent. Omit optional fields you can't \
answer. For radio groups emit one click on the correct option's ja. For essays, write a concise, \
truthful, tailored answer. Match the candidate's real work-authorization, sponsorship, and location.`;

async function callClaude(cfg, data) {
  const learnedTxt = cfg.learned && Object.keys(cfg.learned).length
    ? "\n\n# Saved answers (reuse when a field's question matches — but the Candidate profile above WINS on any conflict)\n" + Object.entries(cfg.learned).map(([q, a]) => "Q: " + q + "\nA: " + a).join("\n") : "";
  const user = "# Candidate profile\n" + cfg.profile + "\n\n# Master resume\n" + cfg.resume + learnedTxt +
    "\n\n# Page URL\n" + data.url + "\n\n# Page text (for context)\n" + data.jd +
    "\n\n# Empty form fields\n" + JSON.stringify(data.fields).slice(0, 14000) + "\n\nReturn the JSON actions now.";
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": cfg.apiKey, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
    body: JSON.stringify({ model: cfg.model, max_tokens: 4000, system: SYSTEM, messages: [{ role: "user", content: user }] }),
  });
  if (!resp.ok) throw new Error("API " + resp.status + ": " + (await resp.text()).slice(0, 200));
  const j = await resp.json();
  let t = (j.content || []).filter((b) => b.type === "text").map((b) => b.text).join("").trim();
  if (t.startsWith("```")) t = t.replace(/^```[a-z]*\n?/, "").replace(/```$/, "").trim();
  return JSON.parse(t).actions || [];
}

// Live web search via Claude's web_search tool -> returns [{company,title,url,description}].
async function searchJobs(cfg, query, count) {
  count = count || 12;
  const sys = "You are a job-search assistant. Use web_search to find CURRENT, OPEN job postings " +
    "matching the candidate's criteria. Strongly prefer direct application pages on Greenhouse " +
    "(boards.greenhouse.io / job-boards.greenhouse.io), Lever (jobs.lever.co), Ashby " +
    "(jobs.ashbyhq.com), or the employer's own careers site. For EACH posting, also judge the " +
    "candidate's realistic chances using the profile/resume provided: set \"confidence\" to an " +
    "integer 0-100 = the calibrated likelihood THIS candidate lands an interview given their " +
    "background AND the current competitive market (be realistic, not optimistic — most strong-fit " +
    "roles are 50-75, reach roles lower). Add a one-sentence \"fit_reason\". " +
    "Return ONLY a JSON array (no prose, no markdown) of up to " + count + " items: " +
    '[{"company":"...","title":"...","url":"...","description":"one short sentence","confidence":NN,"fit_reason":"..."}]. ' +
    "The url MUST be a direct link to a specific posting, not a search page.";
  const user = "# Candidate profile\n" + cfg.profile + "\n\n# Master resume\n" + cfg.resume +
    "\n\n# Search criteria\n" + query + "\n\nFind matching current postings and score each.";
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": cfg.apiKey, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
    body: JSON.stringify({
      model: cfg.model, max_tokens: 6000,
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 6 }],
      system: sys,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!resp.ok) throw new Error("API " + resp.status + ": " + (await resp.text()).slice(0, 200));
  const j = await resp.json();
  const txt = (j.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
  const m = txt.match(/\[[\s\S]*\]/);
  if (!m) return [];
  try { return JSON.parse(m[0]); } catch (e) { return []; }
}

// Score a batch of jobs (no web search) -> [{i, confidence, fit_reason}] in input order.
async function scoreJobs(cfg, items) {
  const list = items.map((it, i) => ({ i, company: it.company || "", title: it.title || "", desc: it.desc || "" }));
  const sys = "You rate a candidate's realistic chance of landing an interview for each job, given " +
    "their profile/resume and the current competitive market. Be calibrated: strong fits 50-75, " +
    "reach roles lower, weak fits under 30. Return ONLY a JSON array (no prose), one object per " +
    'input item with the SAME "i": [{"i":N,"confidence":NN,"fit_reason":"one short sentence"}].';
  const user = "# Candidate profile\n" + cfg.profile + "\n\n# Master resume\n" + cfg.resume +
    "\n\n# Jobs to score\n" + JSON.stringify(list).slice(0, 13000) + "\n\nReturn the JSON array now.";
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": cfg.apiKey, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
    body: JSON.stringify({ model: cfg.model, max_tokens: 4000, system: sys, messages: [{ role: "user", content: user }] }),
  });
  if (!resp.ok) throw new Error("API " + resp.status + ": " + (await resp.text()).slice(0, 200));
  const j = await resp.json();
  const t = (j.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
  const m = t.match(/\[[\s\S]*\]/);
  if (!m) return [];
  try { return JSON.parse(m[0]); } catch (e) { return []; }
}

// Scrape (all frames) -> Claude -> fill -> resume. Tries clicking "Apply" once if no form found.
async function runFillOnTab(tabId, cfg, onStatus) {
  const status = onStatus || (() => {});
  const scan = async () => {
    const all = await chrome.scripting.executeScript({ target: { tabId, allFrames: true }, func: scrapeFields });
    return all.filter((r) => r.result && r.result.fields && r.result.fields.length).sort((a, b) => b.result.fields.length - a.result.fields.length);
  };
  status("Reading the form…");
  let cands = await scan();
  if (!cands.length) {
    status("Opening the application form…");
    await chrome.scripting.executeScript({ target: { tabId, allFrames: true }, func: clickApply });
    await sleep(2500); cands = await scan();
  }
  if (!cands.length) return { error: "no form found", filled: 0 };
  const best = cands[0]; const data = best.result; const ft = { tabId, frameIds: [best.frameId] };
  status("Asking Claude to answer " + data.fields.length + " fields…");
  const actions = await callClaude(cfg, data);
  status("Filling…");
  const r2 = await chrome.scripting.executeScript({ target: ft, func: applyActions, args: [actions] });
  let resume = false;
  if (cfg.resumeFile && cfg.resumeFile.dataUrl) { const r3 = await chrome.scripting.executeScript({ target: ft, func: applyResume, args: [cfg.resumeFile] }); resume = !!(r3[0] && r3[0].result); }
  return { filled: (r2[0] && r2[0].result) || 0, fields: data.fields.length, resume, jd: data.jd };
}
