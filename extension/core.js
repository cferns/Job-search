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

// Ensure access to all sites so we can read embedded (cross-origin) application iframes.
// Prompts once ("Allow on all sites"); silent thereafter.
async function ensureAccess() {
  try {
    if (await chrome.permissions.contains({ origins: ["*://*/*"] })) return true;
    return await chrome.permissions.request({ origins: ["*://*/*"] });
  } catch (e) { return true; }
}

async function getCfg() {
  const c = await chrome.storage.local.get(["apiKey", "model", "resume", "profile", "learned", "resumeFile", "tailorUpload"]);
  c.model = c.model || "claude-sonnet-4-6"; c.resume = c.resume || ""; c.profile = c.profile || "";
  c.tailorUpload = c.tailorUpload !== false; // default on
  return c;
}

// ---- chosen save folder (File System Access API) ----
function idbHandle(action, val) {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open("ja-fs", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("h");
    r.onsuccess = () => {
      const db = r.result;
      const tx = db.transaction("h", action === "get" ? "readonly" : "readwrite");
      const st = tx.objectStore("h");
      const op = action === "get" ? st.get("dir") : (action === "clear" ? st.delete("dir") : st.put(val, "dir"));
      op.onsuccess = () => resolve(action === "get" ? op.result : true);
      op.onerror = () => reject(op.error);
    };
    r.onerror = () => reject(r.error);
  });
}

async function saveToFolder(filename, blob) {
  let dir;
  try { dir = await idbHandle("get"); } catch (e) { return false; }
  if (!dir) return false;
  try {
    if ((await dir.queryPermission({ mode: "readwrite" })) !== "granted") {
      if ((await dir.requestPermission({ mode: "readwrite" })) !== "granted") return false;
    }
    const fh = await dir.getFileHandle(filename, { create: true });
    const w = await fh.createWritable(); await w.write(blob); await w.close();
    return true;
  } catch (e) { return false; }
}

// ---- in-browser PDF generation (no library): plain text/Markdown -> data URL ----
function mdToBlocks(md) {
  const blocks = [];
  (md || "").split(/\r?\n/).forEach((raw) => {
    let line = raw.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1");
    if (/^\s*$/.test(line)) { blocks.push({ text: "" }); return; }
    let m;
    if ((m = line.match(/^#\s+(.*)/))) blocks.push({ text: m[1], bold: true, size: 16 });
    else if ((m = line.match(/^##\s+(.*)/))) blocks.push({ text: m[1], bold: true, size: 12 });
    else if ((m = line.match(/^###\s+(.*)/))) blocks.push({ text: m[1], bold: true, size: 11 });
    else if ((m = line.match(/^\s*[-*]\s+(.*)/))) blocks.push({ text: "• " + m[1], size: 10 });
    else blocks.push({ text: line.replace(/^#+\s*/, ""), size: 10 });
  });
  return blocks;
}

function makePdf(blocks) {
  const margin = 54, pw = 612, ph = 792, usable = pw - 2 * margin;
  const pages = []; let cur = []; let y = ph - margin;
  const wrap = (text, size) => {
    const max = Math.max(8, Math.floor(usable / (size * 0.5)));
    const words = text.split(/\s+/); const out = []; let line = "";
    for (const w of words) { if ((line + " " + w).trim().length > max) { if (line) out.push(line); line = w; } else line = (line ? line + " " : "") + w; }
    if (line) out.push(line); return out.length ? out : [""];
  };
  for (const b of blocks) {
    const size = b.size || 10; const font = b.bold ? "F2" : "F1"; const leading = size * 1.35;
    if (b.text === "") { y -= leading * 0.6; if (y < margin) { pages.push(cur); cur = []; y = ph - margin; } continue; }
    for (const ln of wrap(b.text, size)) {
      if (y - leading < margin) { pages.push(cur); cur = []; y = ph - margin; }
      y -= leading; cur.push({ text: ln, font, size, x: margin, y });
    }
  }
  if (cur.length) pages.push(cur);
  if (!pages.length) pages.push([]);
  const esc = (s) => s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)").replace(/[^\x20-\x7e]/g, "");
  const fontHelv = 3, fontBold = 4;
  const pageObjNum = (i) => 5 + 2 * i, contentObjNum = (i) => 6 + 2 * i;
  const objText = [];
  objText[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objText[2] = "<< /Type /Pages /Count " + pages.length + " /Kids [" + pages.map((_, i) => pageObjNum(i) + " 0 R").join(" ") + "] >>";
  objText[fontHelv] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  objText[fontBold] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>";
  pages.forEach((lines, i) => {
    let stream = "";
    for (const l of lines) stream += "BT /" + l.font + " " + l.size + " Tf " + l.x + " " + l.y.toFixed(1) + " Td (" + esc(l.text) + ") Tj ET\n";
    objText[pageObjNum(i)] = "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " + pw + " " + ph + "] /Resources << /Font << /F1 " + fontHelv + " 0 R /F2 " + fontBold + " 0 R >> >> /Contents " + contentObjNum(i) + " 0 R >>";
    objText[contentObjNum(i)] = "<< /Length " + stream.length + " >>\nstream\n" + stream + "endstream";
  });
  const maxObj = contentObjNum(pages.length - 1);
  let pdf = "%PDF-1.4\n"; const offsets = [];
  for (let n = 1; n <= maxObj; n++) { offsets[n] = pdf.length; pdf += n + " 0 obj\n" + (objText[n] || "<< >>") + "\nendobj\n"; }
  const xref = pdf.length;
  pdf += "xref\n0 " + (maxObj + 1) + "\n0000000000 65535 f \n";
  for (let n = 1; n <= maxObj; n++) pdf += String(offsets[n]).padStart(10, "0") + " 00000 n \n";
  pdf += "trailer\n<< /Size " + (maxObj + 1) + " /Root 1 0 R >>\nstartxref\n" + xref + "\n%%EOF";
  return "data:application/pdf;base64," + btoa(pdf);
}

// Tailor a resume + cover letter to this JD -> {resume_markdown, cover_letter}.
async function tailorDocs(cfg, data) {
  const sys = "You tailor a candidate's resume and write a cover letter for a specific job, using " +
    "ONLY facts from their master resume — never invent employers, titles, dates, metrics, or skills. " +
    'Return ONLY JSON: {"resume_markdown":"...","cover_letter":"..."}. ' +
    "resume_markdown: a COMPLETE tailored resume in Markdown (name, contact line, summary, experience " +
    "with bullets, education, skills), reordered/reworded to match the job, ~1-2 pages. " +
    "cover_letter: 250-320 words, plain text, addressed to the hiring team, specific to this role.";
  const user = "# Master resume\n" + cfg.resume + "\n\n# Candidate profile\n" + cfg.profile +
    "\n\n# Job (URL " + data.url + ")\n" + (data.jd || "").slice(0, 4500) + "\n\nProduce the JSON now.";
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": cfg.apiKey, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
    body: JSON.stringify({ model: cfg.model, max_tokens: 6000, system: sys, messages: [{ role: "user", content: user }] }),
  });
  if (!resp.ok) throw new Error("API " + resp.status + ": " + (await resp.text()).slice(0, 200));
  const j = await resp.json();
  let t = (j.content || []).filter((b) => b.type === "text").map((b) => b.text).join("").trim();
  if (t.startsWith("```")) t = t.replace(/^```[a-z]*\n?/, "").replace(/```$/, "").trim();
  try { return JSON.parse(t); } catch (e) {
    const m = t.match(/\{[\s\S]*\}/); if (m) { try { return JSON.parse(m[0]); } catch (e2) {} }
    return null;
  }
}

// Upload specific files to file inputs matched by a keyword regex on their label/name.
async function applyNamedFiles(items) {
  const deepAll = (sel) => { const r = []; const w = (n) => { try { n.querySelectorAll(sel).forEach((e) => r.push(e)); } catch (e) {} try { n.querySelectorAll("*").forEach((e) => { if (e.shadowRoot) w(e.shadowRoot); }); } catch (e) {} }; w(document); return r; };
  const all = deepAll('input[type="file"]');
  if (!all.length) return 0;
  let n = 0;
  for (const it of items) {
    if (!it || !it.dataUrl) continue;
    const re = new RegExp(it.match, "i");
    let target = all.find((i) => re.test((i.name || "") + " " + (i.id || "") + " " + (i.getAttribute("aria-label") || "") + " " + (i.closest("label") ? i.closest("label").innerText : "")));
    if (!target && it.fallbackFirst) target = all[0];
    if (!target) continue;
    try {
      const res = await fetch(it.dataUrl); const blob = await res.blob();
      const f = new File([blob], it.name, { type: "application/pdf" });
      const dt = new DataTransfer(); dt.items.add(f); target.files = dt.files;
      target.dispatchEvent(new Event("input", { bubbles: true })); target.dispatchEvent(new Event("change", { bubbles: true })); n++;
    } catch (e) { /* skip */ }
  }
  return n;
}

// ---------- injected page functions (must be self-contained) ----------
function scrapeFields() {
  const deepAll = (sel) => { const r = []; const w = (n) => { try { n.querySelectorAll(sel).forEach((e) => r.push(e)); } catch (e) {} try { n.querySelectorAll("*").forEach((e) => { if (e.shadowRoot) w(e.shadowRoot); }); } catch (e) {} }; w(document); return r; };
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
  // Usable = not display:none/visibility:hidden; keep zero-size fields if they have a real
  // label (custom career sites restyle inputs to 0-size behind styled widgets).
  const usable = (el) => {
    const s = getComputedStyle(el);
    if (s.display === "none" || s.visibility === "hidden") return false;
    const r = el.getBoundingClientRect();
    if (r.width > 1 && r.height > 1) return true;
    const lab = labelFor(el);
    return !!(lab && lab.length > 2);
  };
  let idx = 0; const out = []; const groups = {};
  deepAll('input,textarea,select,[role="radio"],[role="checkbox"]').forEach((el) => {
    const tag = el.tagName.toLowerCase(); const type = (el.getAttribute("type") || "").toLowerCase(); const role = (el.getAttribute("role") || "").toLowerCase();
    if (["hidden", "submit", "button", "file", "image", "reset"].includes(type)) return;
    if (!usable(el)) return;
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
  return { fields: out, total: deepAll("input,textarea,select").length, jd: (document.body.innerText || "").slice(0, 6000), url: location.href };
}

async function applyActions(actions) {
  const deepAll = (sel) => { const r = []; const w = (n) => { try { n.querySelectorAll(sel).forEach((e) => r.push(e)); } catch (e) {} try { n.querySelectorAll("*").forEach((e) => { if (e.shadowRoot) w(e.shadowRoot); }); } catch (e) {} }; w(document); return r; };
  const deepOne = (sel) => deepAll(sel)[0];
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
      const opts = deepAll('[role="option"],ul[role="listbox"] li,.select__option,[class*="option"],[class*="suggestion"],[class*="menu"] li').filter((o) => o.offsetParent !== null && o.innerText && o.innerText.trim());
      const pick = opts.find((o) => o.innerText.toLowerCase().includes(want)) || opts[0];
      if (pick) { pick.click(); return true; }
    }
    el.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "ArrowDown" })); el.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Enter" })); return false;
  };
  let n = 0;
  for (const a of actions || []) {
    try {
      const el = deepOne('[data-ja="' + a.ja + '"]'); if (!el) continue;
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
  const deepAll = (sel) => { const r = []; const w = (n) => { try { n.querySelectorAll(sel).forEach((e) => r.push(e)); } catch (e) {} try { n.querySelectorAll("*").forEach((e) => { if (e.shadowRoot) w(e.shadowRoot); }); } catch (e) {} }; w(document); return r; };
  try {
    const all = deepAll('input[type="file"]');
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
  const deepAll = (sel) => { const r = []; const w = (n) => { try { n.querySelectorAll(sel).forEach((e) => r.push(e)); } catch (e) {} try { n.querySelectorAll("*").forEach((e) => { if (e.shadowRoot) w(e.shadowRoot); }); } catch (e) {} }; w(document); return r; };
  const cands = deepAll("a,button").filter((e) => e.offsetParent !== null && /^apply\b|apply for|apply now|submit application/i.test((e.innerText || "").trim()));
  if (cands[0]) { cands[0].click(); return true; }
  return false;
}

function scrapeAnswers() {
  const deepAll = (sel) => { const r = []; const w = (n) => { try { n.querySelectorAll(sel).forEach((e) => r.push(e)); } catch (e) {} try { n.querySelectorAll("*").forEach((e) => { if (e.shadowRoot) w(e.shadowRoot); }); } catch (e) {} }; w(document); return r; };
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
  deepAll("input,textarea,select").forEach((el) => {
    const tag = el.tagName.toLowerCase(); const type = (el.getAttribute("type") || "").toLowerCase();
    if (["hidden", "submit", "button", "file", "image", "reset", "password"].includes(type)) return;
    if (tag === "input" && (type === "radio" || type === "checkbox")) {
      if (el.checked) { const q = groupQ(el); const wrap = el.closest("label"); const a = txt(wrap) || el.value; if (q && a) out.push({ question: q, answer: a }); }
    } else { const v = tag === "select" ? (el.options[el.selectedIndex] ? el.options[el.selectedIndex].text : el.value) : el.value; if (v && v.trim()) out.push({ question: labelUp(el), answer: v.trim() }); }
  });
  return out;
}

function pendingRequired() {
  const deepAll = (sel) => { const r = []; const w = (n) => { try { n.querySelectorAll(sel).forEach((e) => r.push(e)); } catch (e) {} try { n.querySelectorAll("*").forEach((e) => { if (e.shadowRoot) w(e.shadowRoot); }); } catch (e) {} }; w(document); return r; };
  const txt = (el) => (el && el.innerText ? el.innerText.trim() : "");
  const labelOf = (el) => {
    const al = el.getAttribute("aria-label"); if (al && al.trim()) return al.trim();
    if (el.id) { const l = document.querySelector('label[for="' + CSS.escape(el.id) + '"]'); if (txt(l)) return txt(l); }
    let n = el; for (let i = 0; i < 6 && n; i++) { n = n.parentElement; if (!n) break;
      const l = n.querySelector('label,.application-label,legend,[class*="label"],[class*="question"]');
      if (txt(l) && txt(l).length > 2) return txt(l).split("\n")[0].slice(0, 60); }
    return el.getAttribute("placeholder") || el.getAttribute("name") || "";
  };
  const out = []; const seen = new Set();
  deepAll('[required],[aria-required="true"]').forEach((el) => {
    const tag = el.tagName.toLowerCase(); const type = (el.getAttribute("type") || "").toLowerCase();
    if (!["input", "textarea", "select"].includes(tag)) return;
    let empty;
    if (type === "checkbox" || type === "radio") { const name = el.getAttribute("name"); empty = name ? !deepAll('input[name="' + name + '"]').some((x) => x.checked) : !el.checked; }
    else if (tag === "select") empty = !el.value;
    else empty = !(el.value && el.value.trim());
    if (!empty) return;
    const lab = (labelOf(el) || "").trim().slice(0, 50);
    if (!lab || seen.has(lab)) return; seen.add(lab); out.push(lab);
  });
  return out.slice(0, 12);
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
async function runFillOnTab(tabId, cfg, onStatus, meta) {
  const status = onStatus || (() => {});
  const scanRaw = async () => await chrome.scripting.executeScript({ target: { tabId, allFrames: true }, func: scrapeFields });
  const pick = (raw) => raw.filter((r) => r.result && r.result.fields && r.result.fields.length).sort((a, b) => b.result.fields.length - a.result.fields.length);
  status("Reading the form…");
  let raw = await scanRaw(); let cands = pick(raw);
  if (!cands.length) {
    status("Opening the application form…");
    await chrome.scripting.executeScript({ target: { tabId, allFrames: true }, func: clickApply });
    await sleep(2500); raw = await scanRaw(); cands = pick(raw);
  }
  if (!cands.length) {
    const frames = raw.length;
    const totalInputs = raw.reduce((a, r) => a + ((r.result && r.result.total) || 0), 0);
    const perFrame = raw.map((r) => {
      const x = r.result || {};
      let host = "?"; try { host = new URL(x.url).hostname.replace(/^www\./, ""); } catch (e) {}
      return host + " " + ((x.fields && x.fields.length) || 0) + "/" + (x.total || 0);
    });
    return { error: "no form found", filled: 0, frames, totalInputs, perFrame };
  }
  const primary = cands[0];
  const data = primary.result;
  // Fill every frame that holds a real form (>=2 fields), not just the top one — handles
  // forms that aren't in the frame with the most inputs.
  const toFill = cands.filter((c) => c.result.fields.length >= 2);
  if (!toFill.length) toFill.push(primary);

  // Build the tailored resume + cover letter (PDF items) once, from the primary JD.
  let items = null, savedFolder = false;
  if (cfg.tailorUpload && cfg.resume) {
    try {
      const arch = (await chrome.storage.local.get("tailoredArchive")).tailoredArchive || [];
      const prior = [...arch].reverse().find((e) => e.url === data.url && e.resumeDataUrl);
      if (prior) {
        status("Reusing tailored documents for this posting…");
        items = [{ match: "resume|cv", dataUrl: prior.resumeDataUrl, name: "Resume.pdf", fallbackFirst: true }];
        if (prior.coverDataUrl) items.push({ match: "cover|letter", dataUrl: prior.coverDataUrl, name: "Cover-Letter.pdf" });
      } else {
        status("Tailoring resume + cover letter…");
        const docs = await tailorDocs(cfg, data);
        if (docs && docs.resume_markdown) {
          items = [{ match: "resume|cv", dataUrl: makePdf(mdToBlocks(docs.resume_markdown)), name: "Resume.pdf", fallbackFirst: true }];
          if (docs.cover_letter) items.push({ match: "cover|letter", dataUrl: makePdf(mdToBlocks(docs.cover_letter)), name: "Cover-Letter.pdf" });
          const ts = new Date().toISOString();
          const titleStr = (meta && meta.title) || data.url;
          const companyStr = (meta && meta.company) || "";
          const slug = (companyStr + "-" + titleStr).toLowerCase().replace(/https?:\/\//, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "job";
          try {
            const entry = { id: Date.now().toString(36), company: companyStr, title: titleStr, url: data.url, ts, resumeDataUrl: items[0].dataUrl, coverDataUrl: items[1] ? items[1].dataUrl : "", resumeMd: docs.resume_markdown, coverMd: docs.cover_letter || "" };
            arch.push(entry); while (arch.length > 80) arch.shift();
            await chrome.storage.local.set({ lastTailored: { ...entry, date: ts.slice(0, 10) }, tailoredArchive: arch });
          } catch (e) {}
          try {
            const d = ts.slice(0, 10);
            const rb = await (await fetch(items[0].dataUrl)).blob();
            savedFolder = await saveToFolder(slug + "-resume-" + d + ".pdf", rb);
            if (items[1]) { const cb = await (await fetch(items[1].dataUrl)).blob(); await saveToFolder(slug + "-cover-letter-" + d + ".pdf", cb); }
          } catch (e) {}
        }
      }
    } catch (e) { /* fall back to static resume per-frame */ }
  }

  let totalFilled = 0, resume = false, cover = false, pending = []; const seen = new Set();
  for (const c of toFill) {
    const ftc = { tabId, frameIds: [c.frameId] };
    status("Filling…");
    try {
      const actions = await callClaude(cfg, c.result);
      const rr = await chrome.scripting.executeScript({ target: ftc, func: applyActions, args: [actions] });
      totalFilled += (rr[0] && rr[0].result) || 0;
    } catch (e) {}
    if (items) {
      const ru = await chrome.scripting.executeScript({ target: ftc, func: applyNamedFiles, args: [items] });
      const cnt = (ru[0] && ru[0].result) || 0; if (cnt >= 1) resume = true; if (cnt >= 2) cover = true;
    } else if (cfg.resumeFile && cfg.resumeFile.dataUrl) {
      const r3 = await chrome.scripting.executeScript({ target: ftc, func: applyResume, args: [cfg.resumeFile] });
      if (r3[0] && r3[0].result) resume = true;
    }
    try { const pr = await chrome.scripting.executeScript({ target: ftc, func: pendingRequired }); (pr[0] && pr[0].result || []).forEach((x) => { if (!seen.has(x)) { seen.add(x); pending.push(x); } }); } catch (e) {}
  }
  return { filled: totalFilled, fields: data.fields.length, resume, cover, savedFolder, pending, jd: data.jd };
}
